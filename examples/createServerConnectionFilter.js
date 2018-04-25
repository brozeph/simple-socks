'use strict';

var
	socks5 = require('../lib'),
	server = socks5.createServer({
		connectionFilter : function (port, address, callback) {
			if (!/^172\.217\./.test(address)) { // google.com IP space (at time of writing this...)
				console.log('Not allowing connection to %s:%s', address, port);

				return setImmediate(callback, new Error('connection to destination address is denied'));
			}

			return setImmediate(callback);
		}
	});

server.on('connectionFilter', function (port, address, err) {
	console.log('connection to %s:%s has been denied', address, port);
	console.error(err);
});

// start listening!
server.listen(1080);

