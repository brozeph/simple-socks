// Demonstrates enabling GSSAPI/Negotiate with a provider backed by `kerberos`.
//
// Prerequisites on the host:
// - A service principal available to the server, e.g., rcmd/<hostname>@REALM
// - Keytab accessible to the process (if required by your Kerberos setup)
// - npm install kerberos

import createKerberosProvider from './gssapiKerberosProvider.js';
import socks5 from '../src/socks5.js';

const port = 1080;

const server = socks5.createServer({
  gssapi: {
    enabled: true,
    provider: createKerberosProvider({
      // Adjust service/hostname/principal for your environment.
      service: 'rcmd'
      // hostname: 'my-host.example.com', // defaults to os.hostname()
      // principal: 'rcmd/my-host.example.com@EXAMPLE.COM', // optional explicit SPN
    })
  }
});

server.on('handshake', () => {
  console.log('new socks5 client');
});

server.on('authenticate', (username) => {
  console.log('GSSAPI authenticated principal:', username);
});

server.on('authenticateError', (username, err) => {
  console.error('authentication failed for principal:', username);
  console.error(err);
});

server.on('proxyConnect', (info) => {
  console.log('connected to remote server at %s:%d', info.address, info.port);
});

server.on('proxyError', (err) => {
  console.error('unable to connect to remote server');
  console.error(err);
});

server.listen(port, () => {
  console.log('SOCKS5 proxy server with GSSAPI started on 0.0.0.0:%d', port);
});

