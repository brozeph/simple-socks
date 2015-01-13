# Simple Socks Server

Creates a simple SOCKS5 server and exposes several events.

## Installation

```
npm install simple-socks
```

## Example

The following example exists at [examples/createServer.js](examples/createServer.js):

```javascript
'use strict';

var
socks5 = require('../lib'),
server = socks5.createServer().listen(1080);

// When a reqest arrives for a remote destination
server.on('proxyConnect', function (info, destination) {
	console.log('connected to remote server at %s:%d', info.host, info.port);

	destination.on('data', function (data) {
		console.log(data.length);
	});
});

// When data arrives from the remote connection
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
});
```

### Running The Example

```bash
node examples/createServer
```

In a separate terminal window:

```bash
curl http://www.google.com --socks5 127.0.0.1:1080
```

## Methods

### createServer

Creates an instances of a SOCKS5 proxy server:

```javascript
var server = require('simple-socks').createServer();

server.listen(1080, '0.0.0.0', function () {
	console.log('SOCKS5 proxy server started on 0.0.0.0:1080');
});
```

## Events

### proxyConnect

This event is emitted each time a connection is requested to a remote destination. The callback accepts two arguments:

* info - object with two fields
	* host - the TCP address of the remote server
	* port - the TCP port of the remote server
* destination - the destination TCP [net.Socket](http://nodejs.org/api/net.html#net_class_net_socket)

```javascript
// When a reqest arrives for a remote destination
server.on('proxyConnect', function (info, destination) {
	console.log('connected to remote server at %s:%d', info.host, info.port);
});
```

### proxyData

This event is emitted each time a remote connection returns data:

```javascript
// When a reqest arrives for a remote destination
server.on('proxyData', function (data) {
	console.log('data received from remote destination: %d', data.length);
});
```

**Note:** This can also be accomplished by listening to the `data` event on the `destination` connection received in the `proxyConnect` event:

```javascript
// When a reqest arrives for a remote destination
server.on('proxyConnect', function (info, destination) {
	destination.on('data', function (data) {
		console.log('data received from remote destination: %d', data.length);
	});
});
```

### proxyError

In the event that a network error occurs attempting to create communication with the destination, this event is raised.

```javascript
// When an error occurs connecting to remote destination
server.on('proxyError', function (err) {
	console.error('unable to connect to remote server');
	console.error(err);
});
```

### proxyEnd

When a socket connection is closed by the server, the `proxyEnd` event is emitted. It returns two arguments in the callback:

* response - the specific [RFC 1928](https://www.ietf.org/rfc/rfc1928.txt) documented response code
* args - [RFC 1928](https://www.ietf.org/rfc/rfc1928.txt) fields for the proxy request including
	* `ver`
	* `cmd`
	* `atype`
	* `dst.addr`
	* `dst.port`

```javascript
// When a proxy connection ends
server.on('proxyEnd', function (response, args) {
	console.log('socket closed with code %d', response);
	console.log(args);
});
```
