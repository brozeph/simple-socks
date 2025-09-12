import socks5 from '../src/socks5.js';

// Replace these with the local IPs on your machine
const 
  hosts = ['10.0.0.1', '10.0.0.2', '10.0.0.3'],
  port = 1080;

hosts.forEach((host) => {
  const server = socks5.createServer();

  server.on('listening', () => {
    const addr = server.address();

    // addr.address should match the host below, not 0.0.0.0
    console.log('listening on %s:%d', addr.address, addr.port);
  });

  server.on('error', (err) => {
    console.error('error on %s:%d -> %s', host, port, err.message);
  });

  // Use the options form so we can force an exclusive bind
  // This ensures nothing is listening on 0.0.0.0 for the same port
  server.listen({ exclusive: true, host, port });
});

