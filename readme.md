# Simple Socks Server

Creates a simple SOCKS5 server and exposes additional SOCKS5 proxy events.

[![Build Status](https://travis-ci.org/brozeph/simple-socks.svg?branch=master)](https://travis-ci.org/brozeph/simple-socks)

## Installation

```
npm install simple-socks
```

## Example Usage

In the [examples](examples/) folder exists two examples, one that requires no authentication and one that requires username/password authentication. Below is a basic no authentication example:

```javascript
'use strict';

var
	socks5 = require('simple-socks'),
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

### Running The Examples

#### No Authentication

For a SOCKS5 server that does not require authentication, look at [examples/createServer.js](examples/createServer.js):

```bash
node examples/createServer
```

In a separate terminal window:

```bash
curl http://www.google.com --socks5 127.0.0.1:1080
```

#### Username/Password Authentication

For a SOCKS5 server that requires username/password authentication, look at [examples/createServerWithAuthentication.js](examples/createServerWithAuthentication.js):

```bash
node examples/createServerWithAuthentication
```

In a separate terminal window:

```bash
curl http://www.google.com --socks5 127.0.0.1:1080 --proxy-user foo:bar
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

This method accepts an optional `options` argument:

* `options.authentication` - A callback for authentication

#### authentication

To make the socks5 server require username/password authentication, supply a function callback in the options as follows:

```javascript
var socks5 = require('simple-socks');

var options = {
	authenticate : function (username, password, callback) {
		if (username === 'foo' && password === 'bar') {
			return setImmediate(callback);
		}

		return setImmediate(callback, new Error('incorrect username and password'));
	}
};

var server = socks5.createServer(options);

// begin listening and require user/pass authentication
server.listen(1080);
```

The authenticate callback accepts three arguments:

* username - username of the proxy user
* password - password of the proxy user
* callback - callback for authentication... if authentication is successful, the callback should be called with no arguments

## Events

The socks5 server supports all events that exist on a native [net.Server](http://nodejs.org/api/net.html#net_class_net_server) object. Additionally, the following events have been added that are specific to the SOCKS5 proxy:

* [handshake](#handshake) - The first event fired and it occurs when a new SOCKS5 client proxy negotiation occurs
* [authenticate](#authenticate) - When username/password authentication is configured (see above), this event is fired when a successful authentication occurs
* [authenticateError](#authenticateerror) - When username/password authentication is configured, this event is fired when authentication fails
* [proxyConnect](#proxyconnect) - After handshake and optional authentication, this event is emitted upon successful connection with the remote destination
* [proxyError](#proxyerror) - If connection to the remote destination fails, this event is emitted
* [proxyData](#proxydata) - When data is recieved from the remote destination, this event is fired
* [proxyEnd](#proxyend) - This event is emitted when the SOCKS5 client connection is closed for any reason

**Note:**

This module exports the above events as constants for convenience purposes via the property `events`:

```javascript
console.log(socks5.events);
```

Outputs the following:

```javascript
{ AUTHENTICATION: 'authenticate',
  AUTHENTICATION_ERROR: 'authenticateError',
  HANDSHAKE: 'handshake',
  PROXY_CONNECT: 'proxyConnect',
  PROXY_DATA: 'proxyData',
  PROXY_END: 'proxyEnd',
  PROXY_ERROR: 'proxyError' }
```

### handshake

This is event is emitted when a socks5 client connects to the server. The callback accepts a single argument:

* socket - this is the originating TCP [net.Socket](http://nodejs.org/api/net.html#net_class_net_socket)

```javascript
// When a new request is initiated
server.on('handshake', function (socket) {
	console.log('new socks5 client from %s:%d', socket.remoteAddress, socket.remotePort);
});
```

### authenticate

This event is emitted when successful authentication occurs. The callback accepts a single argument:

* username - the username of the successfully authenticated SOCKS5 proxy user

```javascript
// When authentication succeeds
server.on('authenticate', function (username) {
	console.log('user %s successfully authenticated!', username);
});
```

### authenticateError

This event is emitted when authentication is not successful. The callback accepts the following arguments:

* username - the username of the SOCKS5 proxy user
* err - the error returned to the `options.authenticate` callback

```javascript
// When authentication fails
server.on('authenticateError', function (username, err) {
	console.log('user %s failed to authenticate...', username);
	console.error(err);
});
```

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
