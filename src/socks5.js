import {
	RFC_1928_ATYP,
	RFC_1928_COMMANDS,
	RFC_1928_METHODS,
	RFC_1928_REPLIES,
	RFC_1928_VERSION,
	RFC_1929_REPLIES,
	RFC_1929_VERSION
} from './constants';

import binary from 'binary';
import domain from 'domain';
import net from 'net';
import put from 'put';

	// module specific events
const
	EVENTS = {
		AUTHENTICATION : 'authenticate',
		AUTHENTICATION_ERROR : 'authenticateError',
		CONNECTION_FILTER : 'connectionFilter',
		HANDSHAKE : 'handshake',
		PROXY_CONNECT : 'proxyConnect',
		PROXY_DATA : 'proxyData',
		PROXY_END : 'proxyEnd',
		PROXY_ERROR : 'proxyError'
	},
	LENGTH_RFC_1928_ATYP = 4;

/**
 * The following RFCs may be useful as background:
 *
 * https://www.ietf.org/rfc/rfc1928.txt - NO_AUTH SOCKS5
 * https://www.ietf.org/rfc/rfc1929.txt - USERNAME/PASSWORD SOCKS5
 *
 **/
class SocksServer {
	constructor (options) {
		let self = this;

		this.activeSessions = [];
		this.options = options || {};
		this.server = net.createServer((socket) => {
			socket.on('error', (err) => {
				self.server.emit(EVENTS.PROXY_ERROR, err);
			});

			/**
			 * +----+------+----------+------+----------+
			 * |VER | ULEN |  UNAME   | PLEN |  PASSWD  |
			 * +----+------+----------+------+----------+
			 * | 1  |  1   | 1 to 255 |  1   | 1 to 255 |
			 * +----+------+----------+------+----------+
			 *
			 *
			 * @param {Buffer} buffer - a buffer
			 * @returns {undefined}
			 **/
			function authenticate (buffer) {
				let authDomain = domain.create();

				binary
					.stream(buffer)
					.word8('ver')
					.word8('ulen')
					.buffer('uname', 'ulen')
					.word8('plen')
					.buffer('passwd', 'plen')
					.tap((args) => {
						// capture the raw buffer
						args.requestBuffer = buffer;

						// verify version is appropriate
						if (args.ver !== RFC_1929_VERSION) {
							return end(RFC_1929_REPLIES.GENERAL_FAILURE, args);
						}

						authDomain.on('error', (err) => {
							// emit failed authentication event
							self.server.emit(
								EVENTS.AUTHENTICATION_ERROR,
								args.uname.toString(),
								err);

							// respond with auth failure
							return end(RFC_1929_REPLIES.GENERAL_FAILURE, args);
						});

						// perform authentication
						self.options.authenticate(
							args.uname.toString(),
							args.passwd.toString(),
							socket,
							authDomain.intercept(() => {
								// emit successful authentication event
								self.server.emit(EVENTS.AUTHENTICATION, args.uname.toString());

								// respond with success...
								let responseBuffer = put()
									.word8(RFC_1929_VERSION)
									.word8(RFC_1929_REPLIES.SUCCEEDED)
									.buffer();

								// respond then listen for cmd and dst info
								socket.write(responseBuffer, () => {
									// now listen for more details
									socket.once('data', connect);
								});
						}));
					});
			}

			/**
			 * +----+-----+-------+------+----------+----------+
			 * |VER | CMD |  RSV  | ATYP | DST.ADDR | DST.PORT |
			 * +----+-----+-------+------+----------+----------+
			 * | 1  |  1  | X'00' |  1   | Variable |    2     |
			 * +----+-----+-------+------+----------+----------+
			 *
			 * @param {Buffer} buffer - a buffer
			 * @returns {undefined}
			 **/
			function connect (buffer) {
				let binaryStream = binary.stream(buffer);

				binaryStream
					.word8('ver')
					.word8('cmd')
					.word8('rsv')
					.word8('atyp')
					.tap((args) => {
						// capture the raw buffer
						args.requestBuffer = buffer;

						// verify version is appropriate
						if (args.ver !== RFC_1928_VERSION) {
							return end(RFC_1928_REPLIES.GENERAL_FAILURE, args);
						}

						// append socket to active sessions
						self.activeSessions.push(socket);

						// create dst
						args.dst = {};

						// ipv4
						if (args.atyp === RFC_1928_ATYP.IPV4) {
							binaryStream
								.buffer('addr.buf', LENGTH_RFC_1928_ATYP)
								.tap((args) => {
									args.dst.addr = [].slice.call(args.addr.buf).join('.');
								});

						// domain name
						} else if (args.atyp === RFC_1928_ATYP.DOMAINNAME) {
							binaryStream
								.word8('addr.size')
								.buffer('addr.buf', 'addr.size')
								.tap((args) => {
									args.dst.addr = args.addr.buf.toString();
								});

						// ipv6
						} else if (args.atyp === RFC_1928_ATYP.IPV6) {
							binaryStream
								.word32be('addr.a')
								.word32be('addr.b')
								.word32be('addr.c')
								.word32be('addr.d')
								.tap((args) => {
									args.dst.addr = [];

									// extract the parts of the ipv6 address
									['a', 'b', 'c', 'd'].forEach((x) => {
										x = args.addr[x];

										// convert DWORD to two WORD values and append
										/* eslint no-magic-numbers : 0 */
										args.dst.addr.push(((x & 0xffff0000) >> 16).toString(16));
										args.dst.addr.push(((x & 0xffff)).toString(16));
									});

									// format ipv6 address as string
									args.dst.addr = args.dst.addr.join(':');
								});

						// unsupported address type
						} else {
							return end(RFC_1928_REPLIES.ADDRESS_TYPE_NOT_SUPPORTED, args);
						}
					})
					.word16bu('dst.port')
					.tap((args) => {
						if (args.cmd === RFC_1928_COMMANDS.CONNECT) {
							let
								connectionFilter = self.options.connectionFilter,
								connectionFilterDomain = domain.create();

							// if no connection filter is provided, stub one
							if (!connectionFilter || typeof connectionFilter !== 'function') {
								connectionFilter = (port, address, socket, callback) => setImmediate(callback);
							}

							// capture connection filter errors
							connectionFilterDomain.on('error', (err) => {
								// emit failed destination connection event
								self.server.emit(
									EVENTS.CONNECTION_FILTER,
									args.dst.port,
									args.dst.addr,
									err);

								// respond with failure
								return end(RFC_1929_REPLIES.CONNECTION_NOT_ALLOWED, args);
							});

							// perform connection
							return connectionFilter(
								args.dst.port,
								args.dst.addr,
								socket,
								connectionFilterDomain.intercept(() => {
									let destination = net.createConnection(
										args.dst.port,
										args.dst.addr,
										() => {
											// prepare a success response
											let responseBuffer = Buffer.alloc(args.requestBuffer.length);
											args.requestBuffer.copy(responseBuffer);
											responseBuffer[1] = RFC_1928_REPLIES.SUCCEEDED;

											// write acknowledgement to client...
											socket.write(responseBuffer, () => {
												// listen for data bi-directionally
												destination.pipe(socket);
												socket.pipe(destination);
											});
										});

									// capture successful connection
									destination.on('connect', () => {
										let info = {
											host : args.dst.addr,
											port : args.dst.port
										};

										// emit connection event
										self.server.emit(EVENTS.PROXY_CONNECT, info, destination);

										// capture and emit proxied connection data
										destination.on('data', (data) => {
											self.server.emit(EVENTS.PROXY_DATA, data);
										});
									});

									// capture connection errors and response appropriately
									destination.on('error', (err) => {
										// notify of connection error
										err.addr = args.dst.addr;
										err.atyp = args.atyp;
										err.port = args.dst.port;

										self.server.emit(EVENTS.PROXY_ERROR, err);

										if (err.code && err.code === 'EADDRNOTAVAIL') {
											return end(RFC_1928_REPLIES.HOST_UNREACHABLE, args);
										}

										if (err.code && err.code === 'ECONNREFUSED') {
											return end(RFC_1928_REPLIES.CONNECTION_REFUSED, args);
										}

										return end(RFC_1928_REPLIES.NETWORK_UNREACHABLE, args);
									});
								}));
						} else {
							// bind and udp associate commands
							return end(RFC_1928_REPLIES.SUCCEEDED, args);
						}
					});
			}

			/**
			 * +----+-----+-------+------+----------+----------+
			 * |VER | REP |  RSV  | ATYP | BND.ADDR | BND.PORT |
			 * +----+-----+-------+------+----------+----------+
			 * | 1  |  1  | X'00' |  1   | Variable |    2     |
			 * +----+-----+-------+------+----------+----------+
			 *
			 * @param {Buffer} response - a buffer representing the response
			 * @param {object} args - arguments to supply to the proxy end event
			 * @returns {undefined}
			 **/
			function end (response, args) {
				// either use the raw buffer (if available) or create a new one
				let responseBuffer = args.requestBuffer || put()
					.word8(RFC_1928_VERSION)
					.word8(response)
					.buffer();

				// set the response as appropriate
				responseBuffer[1] = response;

				// respond then end the connection
				try {
					socket.end(responseBuffer);
				} catch (ex) {
					socket.destroy();
				}

				// indicate end of connection
				self.server.emit(EVENTS.PROXY_END, response, args);
			}

			/**
			 * +----+----------+----------+
			 * |VER | NMETHODS | METHODS  |
			 * +----+----------+----------+
			 * | 1  |    1     | 1 to 255 |
			 * +----+----------+----------+
			 *
			 * @param {Buffer} buffer - a buffer
			 * @returns {undefined}
			 **/
			function handshake (buffer) {
				binary
					.stream(buffer)
					.word8('ver')
					.word8('nmethods')
					.buffer('methods', 'nmethods')
					.tap((args) => {
						// verify version is appropriate
						if (args.ver !== RFC_1928_VERSION) {
							return end(RFC_1928_REPLIES.GENERAL_FAILURE, args);
						}

						// convert methods buffer to an array
						let
							acceptedMethods = [].slice.call(args.methods).reduce((methods, method) => {
								methods[method] = true;
								return methods;
							}, {}),
							basicAuth = typeof self.options.authenticate === 'function',
							next = connect,
							noAuth = !basicAuth &&
								typeof acceptedMethods[0] !== 'undefined' &&
								acceptedMethods[0],
							responseBuffer = put()
								.word8(RFC_1928_VERSION)
								.word8(RFC_1928_METHODS.NO_AUTHENTICATION_REQUIRED)
								.buffer();

						// check for basic auth configuration
						if (basicAuth) {
							responseBuffer[1] = RFC_1928_METHODS.BASIC_AUTHENTICATION;
							next = authenticate;

						// if NO AUTHENTICATION REQUIRED and
						} else if (!basicAuth && noAuth) {
							responseBuffer[1] = RFC_1928_METHODS.NO_AUTHENTICATION_REQUIRED;
							next = connect;

						// basic auth callback not provided and no auth is not supported
						} else {
							return end(RFC_1928_METHODS.NO_ACCEPTABLE_METHODS, args);
						}

						// respond then listen for cmd and dst info
						socket.write(responseBuffer, () => {
							// emit handshake event
							self.server.emit(EVENTS.HANDSHAKE, socket);

							// now listen for more details
							socket.once('data', next);
						});
					});
			}

			// capture the client handshake
			socket.once('data', handshake);

			// capture socket closure
			socket.once('end', () => {
				// remove the session from currently the active sessions list
				self.activeSessions.splice(self.activeSessions.indexOf(socket), 1);
			});
		});
	}
}

exports.createServer = (options) => {
	let socksServer = new SocksServer(options)
	return socksServer.server;
};
exports.events = EVENTS;
exports.SocksServer = SocksServer;
