import assert from 'assert';
import EventEmitter from 'events';
import net from 'net';
import socks5 from '../src/socks5.js';
import {
	buildSocks5BasicAuth,
	buildSocks5ConnectRequest,
	buildSocks5Handshake,
	connectTo,
	createEchoServer,
	once,
	readExactly,
} from './helpers.js';

async function test(name, fn) {
	try {
		await fn();
		console.log('✓', name);
	} catch (err) {
		console.error('✗', name);
		console.error(err);
		process.exitCode = 1;
	}
}

function listenServer(srv) {
	return new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
}

function closeServer(srv) {
	return new Promise((resolve) => srv.close(() => resolve()));
}

function reservePortThenClose() {
	return new Promise((resolve, reject) => {
		const srv = net.createServer();
		srv.on('error', reject);
		srv.listen(0, '127.0.0.1', () => {
			const addr = srv.address();
			srv.close((err) => {
				if (err) {
					reject(err);
					return;
				}
				resolve(addr.port);
			});
		});
	});
}

function createMockDestinationSocket(error) {
	const destination = new EventEmitter();
	destination.pipe = () => destination;
	destination.setTimeout = () => destination;
	destination.destroy = () => destination;
	setImmediate(() => {
		destination.emit('error', error);
	});
	return destination;
}

function createMockPendingDestinationSocket() {
	const destination = new EventEmitter();
	let timeoutId;
	destination.pipe = () => destination;
	destination.setTimeout = (ms) => {
		if (timeoutId) {
			clearTimeout(timeoutId);
			timeoutId = undefined;
		}
		if (ms > 0) {
			timeoutId = setTimeout(() => {
				destination.emit('timeout');
			}, ms);
		}
		return destination;
	};
	destination.destroy = (err) => {
		if (timeoutId) {
			clearTimeout(timeoutId);
			timeoutId = undefined;
		}
		if (err) {
			setImmediate(() => destination.emit('error', err));
		}
		setImmediate(() => destination.emit('close', Boolean(err)));
		return destination;
	};
	return destination;
}

await test('no-auth: connect to local echo', async () => {
	const echo = await createEchoServer();
	const app = socks5.createServer();
	await listenServer(app);
	const addr = app.address();

	const client = await connectTo(addr.port, addr.address);
	client.write(buildSocks5Handshake(0x00));
	const res = await readExactly(client, 2);
	assert.strictEqual(res[0], 0x05);
	assert.strictEqual(res[1], 0x00);

	const req = buildSocks5ConnectRequest(echo.host, echo.port);
	client.write(req);
	const res2 = await readExactly(client, 2);
	assert.strictEqual(res2[0], 0x05);
	assert.strictEqual(res2[1], 0x00);

	client.end();
	await closeServer(app);
	await closeServer(echo.server);
});

await test('basic-auth success: proceed to connect', async () => {
	const echo = await createEchoServer();
	const app = socks5.createServer({
		authenticate(username, password, _socket, cb) {
			if (username === 'foo' && password === 'bar') return setImmediate(cb);
			return setImmediate(cb, new Error('bad creds'));
		},
	});
	await listenServer(app);
	const addr = app.address();

	const client = await connectTo(addr.port, addr.address);
	client.write(buildSocks5Handshake([0x00, 0x02]));
	const res = await readExactly(client, 2);
	assert.strictEqual(res[0], 0x05);
	assert.strictEqual(res[1], 0x02);

	client.write(buildSocks5BasicAuth('foo', 'bar'));
	const authRes = await readExactly(client, 2);
	assert.strictEqual(authRes[0], 0x01);
	assert.strictEqual(authRes[1], 0x00);

	const req = buildSocks5ConnectRequest(echo.host, echo.port);
	client.write(req);
	const res2 = await readExactly(client, 2);
	assert.strictEqual(res2[0], 0x05);
	assert.strictEqual(res2[1], 0x00);

	client.end();
	await closeServer(app);
	await closeServer(echo.server);
});

await test('gssapi selection with dummy provider', async () => {
	// dummy provider just calls back success on first chunk
	const provider = {
		authenticate(socket, _first, cb) {
			setImmediate(() => cb(null, 'user@REALM'));
		},
	};

	const echo = await createEchoServer();
	const app = socks5.createServer({ gssapi: { enabled: true, provider } });
	await listenServer(app);
	const addr = app.address();

	const client = await connectTo(addr.port, addr.address);
	client.write(buildSocks5Handshake(0x01));
	const res = await readExactly(client, 2);
	assert.strictEqual(res[0], 0x05);
	assert.strictEqual(res[1], 0x01); // GSSAPI selected

	// trigger gssapi() handler with a single byte
	client.write(Buffer.from([0x00]));

	const req = buildSocks5ConnectRequest(echo.host, echo.port);
	// give provider a tick to install the next 'data' handler
	await new Promise((r) => setTimeout(r, 10));
	client.write(req);

	const res2 = await readExactly(client, 2);
	assert.strictEqual(res2[0], 0x05);
	assert.strictEqual(res2[1], 0x00);

	client.end();
	await closeServer(app);
	await closeServer(echo.server);
});

await test('activeSessions returns to 0 after idle timeout', async () => {
	const echo = await createEchoServer();
	// Use the class to access activeSessions
	const serverImpl = new socks5.SocksServer({ idleTimeout: 50 });
	const app = serverImpl.server;
	await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
	const addr = app.address();

	const client = await connectTo(addr.port, addr.address);
	// Offer no-auth
	client.write(buildSocks5Handshake(0x00));
	await readExactly(client, 2); // selection

	// Send CONNECT to echo server
	client.write(buildSocks5ConnectRequest(echo.host, echo.port));
	await readExactly(client, 2); // success

	// Wait a tick to ensure session tracking updates
	await new Promise((r) => setTimeout(r, 10));
	if (serverImpl.activeSessions.length !== 1) {
		throw new Error(`expected activeSessions=1, got ${serverImpl.activeSessions.length}`);
	}

	// Now wait longer than idleTimeout; sockets should time out and be destroyed
	await new Promise((r) => setTimeout(r, 120));

	if (serverImpl.activeSessions.length !== 0) {
		throw new Error(`expected activeSessions=0 after timeout, got ${serverImpl.activeSessions.length}`);
	}

	client.destroy();
	await closeServer(app);
	await closeServer(echo.server);
});

await test('destinationIdleTimeout destroys idle destination socket', async () => {
	const echo = await createEchoServer();
	const app = socks5.createServer({ destinationIdleTimeout: 50 });
	await listenServer(app);
	const addr = app.address();

	const client = await connectTo(addr.port, addr.address);
	client.write(buildSocks5Handshake(0x00));
	const selection = await readExactly(client, 2);
	assert.strictEqual(selection[0], 0x05);
	assert.strictEqual(selection[1], 0x00);

	client.write(buildSocks5ConnectRequest(echo.host, echo.port));
	const connectResponse = await readExactly(client, 2);
	assert.strictEqual(connectResponse[0], 0x05);
	assert.strictEqual(connectResponse[1], 0x00);

	const disconnect = await Promise.race([
		once(app, 'proxyDisconnect'),
		new Promise((_, reject) =>
			setTimeout(
				() => reject(new Error('expected proxyDisconnect from destinationIdleTimeout')),
				500,
			)
		),
	]);
	assert.ok(disconnect);

	client.destroy();
	await closeServer(app);
	await closeServer(echo.server);
});

await test('connectTimeout fails destination connection when connect phase is too slow', async () => {
	const app = socks5.createServer({ connectTimeout: 25, destinationIdleTimeout: 0 });
	await listenServer(app);
	const addr = app.address();
	const client = await connectTo(addr.port, addr.address);

	client.write(buildSocks5Handshake(0x00));
	const selection = await readExactly(client, 2);
	assert.strictEqual(selection[0], 0x05);
	assert.strictEqual(selection[1], 0x00);

	const originalCreateConnection = net.createConnection;
	try {
		net.createConnection = () => createMockPendingDestinationSocket();

		const proxyErrorPromise = once(app, 'proxyError');
		client.write(buildSocks5ConnectRequest('127.0.0.1', 80));
		const response = await readExactly(client, 2);
		assert.strictEqual(response[0], 0x05);
		assert.strictEqual(response[1], 0x03);

		const proxyError = await proxyErrorPromise;
		assert.strictEqual(proxyError.code, 'ETIMEDOUT');
	} finally {
		net.createConnection = originalCreateConnection;
		client.destroy();
		await closeServer(app);
	}
});

await test('invalid handshake version returns general failure', async () => {
	const app = socks5.createServer();
	await listenServer(app);
	const addr = app.address();

	const client = await connectTo(addr.port, addr.address);
	client.write(Buffer.from([0x04, 0x01, 0x00]));
	const res = await readExactly(client, 2);
	assert.strictEqual(res[0], 0x05);
	assert.strictEqual(res[1], 0x01);

	client.destroy();
	await closeServer(app);
});

await test('basic-auth server returns no acceptable methods for no-auth-only client', async () => {
	const app = socks5.createServer({
		authenticate(_username, _password, _socket, cb) {
			return setImmediate(cb);
		},
	});
	await listenServer(app);
	const addr = app.address();

	const client = await connectTo(addr.port, addr.address);
	client.write(buildSocks5Handshake(0x00));
	const res = await readExactly(client, 2);
	assert.strictEqual(res[0], 0x05);
	assert.strictEqual(res[1], 0xff);

	client.destroy();
	await closeServer(app);
});

await test('basic-auth rejects empty password by default', async () => {
	const app = socks5.createServer({
		authenticate(_username, _password, _socket, cb) {
			return setImmediate(cb);
		},
	});
	await listenServer(app);
	const addr = app.address();

	const client = await connectTo(addr.port, addr.address);
	client.write(buildSocks5Handshake([0x00, 0x02]));
	const selection = await readExactly(client, 2);
	assert.strictEqual(selection[0], 0x05);
	assert.strictEqual(selection[1], 0x02);

	client.write(buildSocks5BasicAuth('foo', ''));
	const authResponse = await readExactly(client, 2);
	assert.strictEqual(authResponse[0], 0x01);
	assert.strictEqual(authResponse[1], 0xff);

	client.destroy();
	await closeServer(app);
});

await test('basic-auth rejects empty username by default', async () => {
	const app = socks5.createServer({
		authenticate(_username, _password, _socket, cb) {
			return setImmediate(cb);
		},
	});
	await listenServer(app);
	const addr = app.address();

	const client = await connectTo(addr.port, addr.address);
	client.write(buildSocks5Handshake([0x00, 0x02]));
	const selection = await readExactly(client, 2);
	assert.strictEqual(selection[0], 0x05);
	assert.strictEqual(selection[1], 0x02);

	client.write(buildSocks5BasicAuth('', 'bar'));
	const authResponse = await readExactly(client, 2);
	assert.strictEqual(authResponse[0], 0x01);
	assert.strictEqual(authResponse[1], 0xff);

	client.destroy();
	await closeServer(app);
});

await test('compatAuth allowEmptyPassword lets callback decide authentication', async () => {
	const app = socks5.createServer({
		authenticate(username, password, _socket, cb) {
			if (username === 'foo' && password === '') return setImmediate(cb);
			return setImmediate(cb, new Error('bad creds'));
		},
		compatAuth: { allowEmptyPassword: true },
	});
	await listenServer(app);
	const addr = app.address();

	const client = await connectTo(addr.port, addr.address);
	client.write(buildSocks5Handshake([0x00, 0x02]));
	const selection = await readExactly(client, 2);
	assert.strictEqual(selection[0], 0x05);
	assert.strictEqual(selection[1], 0x02);

	client.write(buildSocks5BasicAuth('foo', ''));
	const authResponse = await readExactly(client, 2);
	assert.strictEqual(authResponse[0], 0x01);
	assert.strictEqual(authResponse[1], 0x00);

	client.destroy();
	await closeServer(app);
});

await test('compatAuth does not bypass method negotiation when BASIC is absent', async () => {
	const app = socks5.createServer({
		authenticate(_username, _password, _socket, cb) {
			return setImmediate(cb);
		},
		compatAuth: { allowEmptyPassword: true },
	});
	await listenServer(app);
	const addr = app.address();

	const client = await connectTo(addr.port, addr.address);
	client.write(buildSocks5Handshake(0x00));
	const res = await readExactly(client, 2);
	assert.strictEqual(res[0], 0x05);
	assert.strictEqual(res[1], 0xff);

	client.destroy();
	await closeServer(app);
});

await test('compatAuth strictMethodNegotiation=false is rejected', async () => {
	assert.throws(
		() => socks5.createServer({ compatAuth: { strictMethodNegotiation: false } }),
		/strictMethodNegotiation=false is not supported/,
	);
});

await test('bind command receives success response and closes', async () => {
	const app = socks5.createServer();
	await listenServer(app);
	const addr = app.address();

	const client = await connectTo(addr.port, addr.address);
	client.write(buildSocks5Handshake(0x00));
	const selection = await readExactly(client, 2);
	assert.strictEqual(selection[0], 0x05);
	assert.strictEqual(selection[1], 0x00);

	const bindRequest = buildSocks5ConnectRequest('127.0.0.1', 80);
	bindRequest[1] = 0x02; // BIND
	client.write(bindRequest);
	const response = await readExactly(client, 2);
	assert.strictEqual(response[0], 0x05);
	assert.strictEqual(response[1], 0x00);

	client.destroy();
	await closeServer(app);
});

await test('connect to closed port emits proxyError and returns connection refused', async () => {
	const app = socks5.createServer();
	await listenServer(app);
	const addr = app.address();
	const closedPort = await reservePortThenClose();

	const client = await connectTo(addr.port, addr.address);
	client.write(buildSocks5Handshake(0x00));
	const selection = await readExactly(client, 2);
	assert.strictEqual(selection[0], 0x05);
	assert.strictEqual(selection[1], 0x00);

	const proxyErrorPromise = once(app, 'proxyError');
	client.write(buildSocks5ConnectRequest('127.0.0.1', closedPort));
	const response = await readExactly(client, 2);
	assert.strictEqual(response[0], 0x05);
	assert.strictEqual(response[1], 0x05);

	const proxyError = await proxyErrorPromise;
	assert.strictEqual(proxyError.code, 'ECONNREFUSED');

	client.destroy();
	await closeServer(app);
});

await test('proxyData event is emitted when client sends tunneled payload', async () => {
	const echo = await createEchoServer();
	const app = socks5.createServer();
	await listenServer(app);
	const addr = app.address();

	const client = await connectTo(addr.port, addr.address);
	client.write(buildSocks5Handshake(0x00));
	const selection = await readExactly(client, 2);
	assert.strictEqual(selection[0], 0x05);
	assert.strictEqual(selection[1], 0x00);

	client.write(buildSocks5ConnectRequest(echo.host, echo.port));
	const connectResponse = await readExactly(client, 2);
	assert.strictEqual(connectResponse[0], 0x05);
	assert.strictEqual(connectResponse[1], 0x00);

	const proxyDataPromise = once(app, 'proxyData');
	const payload = Buffer.from('ping');
	client.write(payload);
	const proxied = await proxyDataPromise;
	assert.strictEqual(Buffer.compare(proxied, payload), 0);

	client.destroy();
	await closeServer(app);
	await closeServer(echo.server);
});

await test('maps EADDRNOTAVAIL to host unreachable response', async () => {
	const app = socks5.createServer();
	await listenServer(app);
	const addr = app.address();
	const client = await connectTo(addr.port, addr.address);

	client.write(buildSocks5Handshake(0x00));
	const selection = await readExactly(client, 2);
	assert.strictEqual(selection[0], 0x05);
	assert.strictEqual(selection[1], 0x00);

	const originalCreateConnection = net.createConnection;
	try {
		net.createConnection = () =>
			createMockDestinationSocket(Object.assign(new Error('unreachable host'), { code: 'EADDRNOTAVAIL' }));

		client.write(buildSocks5ConnectRequest('10.255.255.1', 80));
		const response = await readExactly(client, 2);
		assert.strictEqual(response[0], 0x05);
		assert.strictEqual(response[1], 0x04);
	} finally {
		net.createConnection = originalCreateConnection;
		client.destroy();
		await closeServer(app);
	}
});

await test('maps unknown destination error to network unreachable response', async () => {
	const app = socks5.createServer();
	await listenServer(app);
	const addr = app.address();
	const client = await connectTo(addr.port, addr.address);

	client.write(buildSocks5Handshake(0x00));
	const selection = await readExactly(client, 2);
	assert.strictEqual(selection[0], 0x05);
	assert.strictEqual(selection[1], 0x00);

	const originalCreateConnection = net.createConnection;
	try {
		net.createConnection = () =>
			createMockDestinationSocket(Object.assign(new Error('network down'), { code: 'ENETDOWN' }));

		client.write(buildSocks5ConnectRequest('127.0.0.1', 80));
		const response = await readExactly(client, 2);
		assert.strictEqual(response[0], 0x05);
		assert.strictEqual(response[1], 0x03);
	} finally {
		net.createConnection = originalCreateConnection;
		client.destroy();
		await closeServer(app);
	}
});

await test('falls back to socket.destroy when socket.end throws in end()', async () => {
	const app = socks5.createServer();
	await listenServer(app);
	const addr = app.address();

	app.once('handshake', (serverSocket) => {
		serverSocket.end = () => {
			throw new Error('forced end failure');
		};
	});

	const client = await connectTo(addr.port, addr.address);
	client.write(buildSocks5Handshake(0x00));
	const selection = await readExactly(client, 2);
	assert.strictEqual(selection[0], 0x05);
	assert.strictEqual(selection[1], 0x00);

	const connectReq = buildSocks5ConnectRequest('127.0.0.1', 80);
	connectReq[0] = 0x04; // invalid version for connect() -> triggers end()
	client.write(connectReq);

	const proxyEndPromise = once(app, 'proxyEnd');
	const responseCode = await proxyEndPromise;
	assert.strictEqual(responseCode, 0x01);

	client.destroy();
	await closeServer(app);
});

// Exit non-zero on failures (handled in test wrapper)
