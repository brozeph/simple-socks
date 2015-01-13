'use strict';

var
	socks5 = require('../lib'),
	server = socks5.createServer().listen(1080);

// When a reqest arrives for a remote destination
server.on('proxyConnect', function (host, port) {
	console.log('connected to remote server at %s:%d', host, port);
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
});
