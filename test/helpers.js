import net from 'net';

export function createEchoServer() {
	return new Promise((resolve, reject) => {
		const srv = net.createServer((sock) => {
			sock.on('data', (d) => sock.write(d));
		});
		srv.on('error', reject);
		srv.listen(0, '127.0.0.1', () => {
			const addr = srv.address();
			resolve({ server: srv, host: addr.address, port: addr.port });
		});
	});
}

export function connectTo(port, host = '127.0.0.1') {
	return new Promise((resolve, reject) => {
		const sock = net.createConnection({ port, host }, () => resolve(sock));
		sock.on('error', reject);
	});
}

export function once(emitter, event) {
	return new Promise((resolve) => emitter.once(event, resolve));
}

export function readExactly(socket, n) {
	return new Promise((resolve, reject) => {
		let buf = Buffer.alloc(0);
		const onData = (chunk) => {
			buf = Buffer.concat([buf, chunk]);
			if (buf.length >= n) {
				socket.off('data', onData);
				resolve(buf.slice(0, n));
			}
		};
		const onError = (err) => {
			socket.off('data', onData);
			reject(err);
		};
		socket.on('data', onData);
		socket.once('error', onError);
	});
}

export function buildSocks5Handshake(methods) {
	const arr = Array.isArray(methods) ? methods : [methods];
	return Buffer.from([0x05, arr.length, ...arr]);
}

export function buildSocks5ConnectRequest(host, port) {
	const parts = host.split('.').map((x) => parseInt(x, 10));
	const buf = Buffer.alloc(4 + 4 + 2);
	buf[0] = 0x05; // ver
	buf[1] = 0x01; // cmd CONNECT
	buf[2] = 0x00; // rsv
	buf[3] = 0x01; // atyp IPv4
	buf[4] = parts[0];
	buf[5] = parts[1];
	buf[6] = parts[2];
	buf[7] = parts[3];
	buf.writeUInt16BE(port, 8);
	return buf;
}

export function buildSocks5BasicAuth(username, password) {
	const u = Buffer.from(String(username));
	const p = Buffer.from(String(password));
	const buf = Buffer.alloc(2 + u.length + 1 + p.length);
	buf[0] = 0x01; // RFC 1929 ver
	buf[1] = u.length;
	u.copy(buf, 2);
	buf[2 + u.length] = p.length;
	p.copy(buf, 3 + u.length);
	return buf;
}
