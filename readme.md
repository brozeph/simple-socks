# Simple Socks Server

Creates a simple SOCKS5 server and exposes additional SOCKS5 proxy events.

[![Build Status](https://travis-ci.org/brozeph/simple-socks.svg?branch=master)](https://travis-ci.org/brozeph/simple-socks)

## Installation

```
npm install simple-socks
```

## Example Usage

In the [examples](examples/) folder exists two examples, one that requires no authentication and one that requires username/password authentication. Below is an example with no authentication:

```javascript
const
  socks5 = require('simple-socks'),
  server = socks5.createServer().listen(1080);

// When a reqest arrives for a remote destination
server.on('proxyConnect', (info, destination) => {
  console.log('connected to remote server at %s:%d', info.address, info.port);

  destination.on('data', (data) => {
    console.log(data.length);
  });
});

// When data arrives from the remote connection
server.on('proxyData', (data) => {
  console.log(data.length);
});

// When an error occurs connecting to remote destination
server.on('proxyError', (err) => {
  console.error('unable to connect to remote server');
  console.error(err);
});

// When a request for a remote destination ends
server.on('proxyDisconnect', (originInfo, destinationInfo, hadError) => {
  console.log(
    'client %s:%d request has disconnected from remote server at %s:%d with %serror',
    originInfo.address,
    originInfo.port,
    destinationInfo.address,
    destinationInfo.port,
    hadError ? '' : 'no ');
});

// When a proxy connection ends
server.on('proxyEnd', (response, args) => {
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

#### Connection Filter

For a SOCKS5 server that can perform either origin or destination (or both!) address filtering, look at [examples/createServerConnectionFilter.js](examples/createServerConnectionFilter.js):

```bash
node examples/createServerConnectionFilter
```

In a separate terminal window:

```bash
curl http://www.us.gov --socks5 127.0.0.1:1080 # allowed
curl http://www.google.com --socks5 127.0.0.1:1080 # denied
```

## Methods

### createServer

Factory method that creates an instance of a SOCKS5 proxy server:

```javascript
const server = require('simple-socks').createServer();

server.listen(1080, '0.0.0.0', function () {
  console.log('SOCKS5 proxy server started on 0.0.0.0:1080');
});
```

This method accepts an optional `options` argument:

* `options.authentication` - A callback for authentication
* `options.connectionFilter` - A callback for connection filtering

#### authentication

To make the socks5 server require username/password authentication, supply a function callback in the options as follows:

```javascript
const socks5 = require('simple-socks');

const options = {
  authenticate : function (username, password, socket, callback) {
    if (username === 'foo' && password === 'bar') {
      return setImmediate(callback);
    }

    return setImmediate(callback, new Error('incorrect username and password'));
  }
};

const server = socks5.createServer(options);

// begin listening and require user/pass authentication
server.listen(1080);
```

The `authenticate` callback accepts three arguments:

* username - username of the proxy user
* password - password of the proxy user
* socket - the socket for the client connection
* callback - callback for authentication... if authentication is successful, the callback should be called with no arguments

#### connectionFilter

Allows you to filter incoming connections, based on either origin and/or destination, return `false` to disallow:

```javascript
server = socks5.createServer({
  connectionFilter : function (destination, origin, callback) {
    if (origin.address === '127.0.0.1') {
      console.log('denying access from %s:%s', origin.address, origin.port);

      return setImmediate(callback, new Error('access from specified origin is denied'));
    }

    if (destination.address === '10.0.0.1') {
      console.log('denying access to %s:%s', remote.address, remote.port);

      return setImmediate(callback, new Error('access to specified destination is denied'));
    }

    return setImmediate(callback);
  }
});
```

The `connectionFilter` callback accepts three arguments:

* destination - an information object containing details for destination connection
  * address - the TCP address of the remote server
  * port - the TCP port of the remote server
* origin - an information object containing details for origin connection
  * address - the TCP address of the origin (client) connection
  * port - the TCP port of the origin (client) connection
* callback - callback for destination and/or origin address validation... if connections are allowed to the destination address, the callback should be called with no arguments

For an example, see [examples/createServerConnectionFilter.js](examples/createServerConnectionFilter.js).

## Events

The socks5 server supports all events that exist on a native [net.Server](http://nodejs.org/api/net.html#net_class_net_server) object. Additionally, the following events have been added that are specific to the SOCKS5 proxy:

* [handshake](#handshake) - The first event fired and it occurs when a new SOCKS5 client proxy negotiation occurs
* [authenticate](#authenticate) - When username/password authentication is configured (see above), this event is fired when a successful authentication occurs
* [authenticateError](#authenticateerror) - When username/password authentication is configured, this event is fired when authentication fails
* [connectionFilter](#connectionfilter) - When a destination address is denied by the configured connection filter callback, this event is fired
* [proxyConnect](#proxyconnect) - After handshake and optional authentication, this event is emitted upon successful connection with the remote destination
* [proxyError](#proxyerror) - If connection to the remote destination fails, this event is emitted
* [proxyDisconnect](#proxydisconnect) - If a successful `proxyConnect` occurs, this event is emitted when the remote destination ends the connection
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
  CONNECTION_FILTER: 'connectionFilter',
  HANDSHAKE: 'handshake',
  PROXY_CONNECT: 'proxyConnect',
  PROXY_DATA: 'proxyData',
  PROXY_DISCONNECT: 'proxyDisconnect',
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

### connectionFilter

This event is emitted when a destination address and port is filtered by the `connectionFilter` callback. The callback accepts the following arguments:

* destination - an information object containing details for destination connection
  * address - the TCP address of the remote server
  * port - the TCP port of the remote server
* origin - an information object containing details for origin connection
  * address - the TCP address of the origin (client) connection
  * port - the TCP port of the origin (client) connection
* err - the error returned to the `options.connectionFilter` callback

```javascript
// When a destination connection is filtered
server.on('connectionFilter', function (port, address, err) {
  console.log('connection to %s:%s has been denied', address, port);
  console.error(err);
});
```

### proxyConnect

This event is emitted each time a connection is requested to a remote destination. The callback accepts two arguments:

* info - object with two fields
  * address - the TCP address of the remote (destination) server
  * port - the TCP port of the remote (destination) server
* destination - the destination TCP [net.Socket](http://nodejs.org/api/net.html#net_class_net_socket)

```javascript
// When a reqest arrives for a remote destination
server.on('proxyConnect', function (info, destination) {
  console.log('connected to remote server at %s:%d', info.address, info.port);
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

### proxyDisconnect

This event is emitted after a `proxyConnect` when a connection to a remote destination has ended. The callback accepts three arguments:

* originInfo - object with two fields
  * address - the TCP address of the origin of the request
  * port - the TCP port of the origin of the request
* destinationInfo - object with two fields
  * address - the TCP address of the remote (destination) server
  * port the TCP port of the remote (destination) server
* hadError - a Boolean indicating if a transmission error occurred after connecting with the remote (destination) server

```javascript
// When a request for a remote destination ends
server.on('proxyDisconnect', function (err) {
  console.log(
    'client %s:%d request has disconnected from remote server at %s:%d with %serror',
    originInfo.address,
    originInfo.port,
    destinationInfo.address,
    destinationInfo.port,
    hadError ? '' : 'no ');
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
