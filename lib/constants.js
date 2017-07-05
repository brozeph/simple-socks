/**
 * Created by vpotseluyko on 7/5/17.
 */


module.exports.EVENTS = {
    AUTHENTICATION: 'authenticate',
    AUTHENTICATION_ERROR: 'authenticateError',
    HANDSHAKE: 'handshake',
    PROXY_CONNECT: 'proxyConnect',
    PROXY_DATA: 'proxyData',
    PROXY_END: 'proxyEnd',
    PROXY_ERROR: 'proxyError'
};

module.exports.RFC_1928_ATYP = {
    IPV4: 0x01,
    DOMAINNAME: 0x03,
    IPV6: 0x04
};

module.exports.RFC_1928_COMMANDS = {
    CONNECT: 0x01,
    BIND: 0x02,
    UDP_ASSOCIATE: 0x03
};

module.exports.RFC_1928_METHODS = {
    NO_AUTHENTICATION_REQUIRED: 0x00,
    GSSAPI: 0x01,
    BASIC_AUTHENTICATION: 0x02,
    NO_ACCEPTABLE_METHODS: 0xff
};

module.exports.RFC_1928_REPLIES = {
    SUCCEEDED: 0x00,
    GENERAL_FAILURE: 0x01,
    CONNECTION_NOT_ALLOWED: 0x02,
    NETWORK_UNREACHABLE: 0x03,
    HOST_UNREACHABLE: 0x04,
    CONNECTION_REFUSED: 0x05,
    TTL_EXPIRED: 0x06,
    COMMAND_NOT_SUPPORTED: 0x07,
    ADDRESS_TYPE_NOT_SUPPORTED: 0x08
};

module.exports.RFC_1928_VERSION = 0x05;
module.exports.RFC_1929_REPLIES = {
    SUCCEEDED: 0x00,
    GENERAL_FAILURE: 0xff
};

module.exports.RFC_1929_VERSION = 0x01;