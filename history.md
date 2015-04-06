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
