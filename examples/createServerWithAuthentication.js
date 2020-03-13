const
	socks5 = require('../dist/socks5'),
	server = socks5.createServer({
		authenticate : function (username, password, socket, callback) {
			// verify username/password
			if (username !== 'foo' || password !== 'bar') {
				// respond with auth failure (can be any error)
				return setImmediate(callback, new Error('invalid credentials'));
			}

			// return successful authentication
			return setImmediate(callback);
		}
	});

// start listening!
server.listen(1080);

server.on('handshake', function () {
	console.log();
	console.log('------------------------------------------------------------');
	console.log('new client connection');
});

// When authentication succeeds
server.on('authenticate', function (username) {
	console.log('user %s successfully authenticated!', username);
});

// When authentication fails
server.on('authenticateError', function (username, err) {
	console.log('user %s failed to authenticate...', username);
	console.log(err);
});

// When a reqest arrives for a remote destination
server.on('proxyConnect', function (info, destination) {
	console.log('connected to remote server at %s:%d', info.address, info.port);

	destination.on('data', function (data) {
		console.log(data.length);
	});
});

server.on('proxyData', function (data) {
	console.log(data.length);
});

// When an error occurs connecting to remote destination
server.on('proxyError', function (err) {
	console.error('unable to connect to remote server');
	console.error(err);
});

// When a proxy connection ends
server.on('proxyEnd', function (response, args) {
	console.log('socket closed with code %d', response);
	console.log(args);
	console.log();
});
