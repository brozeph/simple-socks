var Socks = require('./socks5');

module.exports = Socks;

module.exports.createServer = function (options) {
  return new Socks(options);
};

