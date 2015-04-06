var
	domain = require('domain'),

	binary = require('binary'),
	net = require('net'),
	put = require('put'),

	// module specific events
	EVENTS = {
		AUTHENTICATION : 'authenticate',
		AUTHENTICATION_ERROR : 'authenticateError',
		HANDSHAKE : 'handshake',
		PROXY_CONNECT : 'proxyConnect',
		PROXY_DATA : 'proxyData',
		PROXY_END : 'proxyEnd',
		PROXY_ERROR : 'proxyError'
	},

	RFC_1928_ATYP = {
		IPV4 : 0x01,
		DOMAINNAME : 0x03,
		IPV6 : 0x04
	},

	RFC_1928_COMMANDS = {
		CONNECT : 0x01,
		BIND : 0x02,
		UDP_ASSOCIATE : 0x03
	},

	RFC_1928_METHODS = {
		NO_AUTHENTICATION_REQUIRED : 0x00,
		GSSAPI : 0x01,
		BASIC_AUTHENTICATION : 0x02,
		NO_ACCEPTABLE_METHODS : 0xff
	},

	RFC_1928_REPLIES = {
		SUCCEEDED : 0x00,
		GENERAL_FAILURE : 0x01,
		CONNECTION_NOT_ALLOWED : 0x02,
		NETWORK_UNREACHABLE : 0x03,
		HOST_UNREACHABLE : 0x04,
		CONNECTION_REFUSED : 0x05,
		TTL_EXPIRED : 0x06,
		COMMAND_NOT_SUPPORTED : 0x07,
		ADDRESS_TYPE_NOT_SUPPORTED : 0x08
	},

	RFC_1928_VERSION = 0x05,

	RFC_1929_REPLIES = {
		SUCCEEDED : 0x00,
		GENERAL_FAILURE : 0xff
	},

	RFC_1929_VERSION = 0x01;

/**
 * The following RFCs may be useful as background:
 *
 * https://www.ietf.org/rfc/rfc1928.txt - NO_AUTH SOCKS5
 * https://www.ietf.org/rfc/rfc1929.txt - USERNAME/PASSWORD SOCKS5
 *
 **/
module.exports = (function (self) {
	'use strict';

	// local state
	self.activeSessions = [];
	self.options = {};
	self.server = null;

	function Session (socket) {

		/**
		 * +----+------+----------+------+----------+
		 * |VER | ULEN |  UNAME   | PLEN |  PASSWD  |
		 * +----+------+----------+------+----------+
		 * | 1  |  1   | 1 to 255 |  1   | 1 to 255 |
		 * +----+------+----------+------+----------+
		 **/
		function authenticate (buffer) {
			var authDomain = domain.create();

			binary
				.stream(buffer)
				.word8('ver')
				.word8('ulen')
				.buffer('uname', 'ulen')
				.word8('plen')
				.buffer('passwd', 'plen')
				.tap(function (args) {
					// capture the raw buffer
					args.requestBuffer = buffer;

					// verify version is appropriate
					if (args.ver !== RFC_1929_VERSION) {
						return end(RFC_1929_REPLIES.GENERAL_FAILURE, args);
					}

					authDomain.on('error', function (err) {
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
						authDomain.intercept(function () {
							// emit successful authentication event
							self.server.emit(EVENTS.AUTHENTICATION, args.uname.toString());

							// respond with success...
							var responseBuffer = put()
								.word8(RFC_1929_VERSION)
								.word8(RFC_1929_REPLIES.SUCCEEDED)
								.buffer();

							// respond then listen for cmd and dst info
							socket.write(responseBuffer, function () {
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
		 **/
		function connect (buffer) {
			binary
				.stream(buffer)
				.word8('ver')
				.word8('cmd')
				.word8('rsv')
				.word8('atyp')
				.tap(function (args) {
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
						this
							.buffer('addr.buf', 4)
							.tap(function (args) {
								args.dst.addr = [].slice.call(args.addr.buf).join('.');
							});

					// domain name
					} else if (args.atyp === RFC_1928_ATYP.DOMAINNAME) {
						this
							.word8('addr.size')
							.buffer('addr.buf', 'addr.size')
							.tap(function (args) {
								args.dst.addr = args.addr.buf.toString();
							});

					// ipv6
					} else if (args.atyp === RFC_1928_ATYP.IPV6) {
						this
							.word32be('addr.a')
							.word32be('addr.b')
							.word32be('addr.c')
							.word32be('addr.d')
							.tap(function (args) {
								args.dst.addr = ['a', 'b', 'c', 'd'].map(function (x) {
									return args.addr[x].toString(16);
								});
							});

					// unsupported address type
					} else {
						return end(RFC_1928_REPLIES.ADDRESS_TYPE_NOT_SUPPORTED, args);
					}
				})
				.word16bu('dst.port')
				.tap(function (args) {
					if (args.cmd === RFC_1928_COMMANDS.CONNECT) {
						var destination = net.createConnection(
							args.dst.port,
							args.dst.addr,
							function () {
								// prepare a success response
								var responseBuffer = new Buffer(args.requestBuffer.length);
								args.requestBuffer.copy(responseBuffer);
								responseBuffer[1] = RFC_1928_REPLIES.SUCCEEDED;

								// write acknowledgement to client...
								socket.write(responseBuffer, function () {
									// listen for data bi-directionally
									destination.pipe(socket);
									socket.pipe(destination);
								});
							});

						// capture successful connection
						destination.on('connect', function () {
							var info = {
								host : args.dst.addr,
								port : args.dst.port
							};

							// emit connection event
							self.server.emit(EVENTS.PROXY_CONNECT, info, destination);

							// capture and emit proxied connection data
							destination.on('data', function (data) {
								self.server.emit(EVENTS.PROXY_DATA, data);
							});
						});

						// capture connection errors and response appropriately
						destination.on('error', function (err) {
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
		 **/
		function end (response, args) {
			// either use the raw buffer (if available) or create a new one
			var responseBuffer = args.requestBuffer || put()
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
		 **/
		function handshake (buffer) {
			binary
				.stream(buffer)
				.word8('ver')
				.word8('nmethods')
				.buffer('methods', 'nmethods')
				.tap(function (args) {
					// verify version is appropriate
					if (args.ver !== RFC_1928_VERSION) {
						return end(RFC_1928_REPLIES.GENERAL_FAILURE, args);
					}

					// convert methods buffer to an array
					var
						acceptedMethods = [].slice.call(args.methods).reduce(function (methods, method) {
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
					socket.write(responseBuffer, function () {
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
		socket.once('end', function () {
			// remove the session from currently the active sessions list
			self.activeSessions.splice(self.activeSessions.indexOf(socket), 1);
		});
	}

	/**
	 * Creates a TCP SOCKS5 proxy server
	 **/
	self.createServer = function (options) {
		self.options = options || {};

		self.server = net.createServer(Session);

		return self.server;
	};

	return self;
}({}));
