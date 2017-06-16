# v0.2.7 - 2017/06/16

* Returning `socket` to the authentication callback based on pull-request from @dgramop

# v0.2.6 - 2017/03/06

* Fixed issue in support for ipv6 (thanks to @fabiensk)

# v0.2.5 - 2016/12/02

* Added ability to run multiple instances of the server at once (thank you to @pronskiy)
* Moved events to a constant that is exported via the module
* Updated tested versions of Node in Travis configuration

# v0.2.4 - 2015/04/09

* Ensuring any errors that emit from the underlying socket are surfaced to the proxy server

# v0.2.3 - 2015/04/05

* Fixing issue where unhandled exception bubbles from authentication

# v0.2.2 - 2015/01/15

* Merge pull request to resolve error with active session tracking

# v0.2.1 - 2015/01/15

* Fixing bug present when tracking active sessions

# v0.2.0 - 2015/01/13

* Added support for USERNAME/PASSWORD authentication ([RFC 1929](https://www.ietf.org/rfc/rfc1929.txt))
* Added event `proxyData` to TCP server object returned from `createServer` method
* Modified interface for `proxyConnect` event to also return the remote socket connection
* Updated documentation

# v0.1.0 - 2015/01/12

* Initial release of server
