'use strict';

var
	dns = require('dns'),
	socks5 = require('../lib'),
	server = socks5.createServer({
		connectionFilter : function (port, address, socket, callback) {
			return dns.reverse(address, function (err, hostnames) {
				if (!hostnames.length || !/amazonaws/.test(hostnames[0])) {
					console.log('Not allowing connection to %s:%s', address, port);

					return callback(new Error('connection to destination address is denied'));
				}

				return callback();
			});

		}
	});

server.on('connectionFilter', function (port, address, err) {
	console.log('connection to %s:%s has been denied', address, port);
	console.error(err);
});

// start listening!
server.listen(1080);

