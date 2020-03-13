const
	dns = require('dns'),
	socks5 = require('../dist/socks5'),
	server = socks5.createServer({
		connectionFilter : function (destination, origin, callback) {
			console.log('Attempting to connect to...');
			console.log(destination);
			console.log();
			console.log('Inbound origin of request is...');
			console.log(origin);

			return dns.reverse(destination.address, function (err, hostnames) {
				if (!hostnames || !hostnames.length || !/github/.test(hostnames[0])) {
					console.log('Not allowing connection to %s:%s', destination.address, destination.port);

					return callback(new Error('connection to destination address is denied (only github is allowed)'));
				}

				return callback();
			});

		}
	});

server.on('connectionFilter', function (destination, origin, err) {
	console.log('connection to %s:%s has been denied (only requests to github are allowed)', destination.address, destination.port);
	console.error(err);
});

// start listening!
server.listen(1080);
