'use strict';

var
	socks5 = require('../lib'),
	server = socks5.createServer({
		allow_connection : function (addr, port) {
			console.log('Not allowing to ' + addr);
			return false;
		}
	});

// start listening!
server.listen(1080);

