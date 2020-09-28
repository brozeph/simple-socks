# v2.1.0 - 2020/09/28

* Updated dependencies
* Added `proxyDisconnect` event per feature request in Issue #41

# v2.0.1 - 2020/03/12

* Removed `put` from `package.json`

# v2.0.0 - 2020/03/11

* Changed functionality for `connectionFilter` so that both the origin and the destination can be filtered
* Moved to `@babel/cli` from `babel-cli` as a dev-dependency
* Removed dependency on `put` and replaced with native `Buffer`

# v1.0.4 - 2020/03/11

* Updated dependencies

# v1.0.3 - 2019/08/17

* Updated dependencies

# v1.0.2 - 2019/01/12

* Fixed issue where IPv6 clients were failing

# v1.0.1 - 2019/01/11

* Tightened up the `.eslintrc.yml` file for a few additional tests

# v1.0.0 - 2019/01/10

* Added babel for transpile
* Fixed `(node:17070) [DEP0005] DeprecationWarning: Buffer() is deprecated` warning at runtime
* Moved to eslint instead of jshint
* Refactored constants for cleaner code
* Updated node.js dependencies for Travis-CI

# v0.3.0 - 2018/04/25

* Added `connectionFilter` option to provide ability to filter destination addresses (thanks to @slava-vishnyakov for implementation and @jfowl for review and advice)

# v0.2.7 - 2017/06/16

* Modifed the authentication callback to return a `socket` based on pull-request from @dgramop

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
