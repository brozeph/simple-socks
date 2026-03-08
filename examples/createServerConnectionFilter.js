import dns from 'dns';
import socks5 from '../src/socks5.js';

const port = 1080,
	server = socks5.createServer({
		connectionFilter(destination, origin, callback) {
			console.log('Attempting to connect to...');
			console.log(destination);
			console.log();
			console.log('Inbound origin of request is...');
			console.log(origin);

			return dns.reverse(destination.address, function(err, hostnames) {
				if (err) {
					console.error('DNS reverse lookup failed for %s', destination.address);
					console.error(err);

					// if the reverse lookup fails, we just deny the connection
					return callback(new Error('connection to destination address is denied (only github is allowed)'));
				}

				if (!hostnames || !hostnames.length || !/github/.test(hostnames[0])) {
					console.log('Not allowing connection to %s:%s', destination.address, destination.port);

					return callback(new Error('connection to destination address is denied (only github is allowed)'));
				}

				return callback();
			});
		},
	});

server.on('connectionFilter', function(destination, origin, err) {
	console.log(
		'connection to %s:%s has been denied (only requests to github are allowed)',
		destination.address,
		destination.port,
	);
	console.error(err);
});

// start listening!
server.listen(port);
