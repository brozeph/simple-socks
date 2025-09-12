import assert from 'assert';
import net from 'net';
import socks5 from '../src/socks5.js';
import {
  createEchoServer,
  connectTo,
  once,
  readExactly,
  buildSocks5Handshake,
  buildSocks5ConnectRequest,
  buildSocks5BasicAuth
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
    }
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
    }
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

// Exit non-zero on failures (handled in test wrapper)
