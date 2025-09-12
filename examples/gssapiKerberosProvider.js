// Minimal GSSAPI provider example using the `kerberos` (node-kerberos) package.
// Notes:
// - This is a starting point; RFC 1961 protection/MIC negotiation is noted as TODO.
// - Requires: npm install kerberos
// - Service principal (SPN) typically looks like: 'rcmd/your-hostname@YOUR.REALM'

/* eslint-disable no-await-in-loop, no-magic-numbers, curly, valid-jsdoc, no-constant-condition, callback-return */
import os from 'os';

// Reads a single RFC 1961-framed token from the socket using an internal buffer.
function createTokenIO(socket, firstChunk) {
  let buffer = Buffer.from(firstChunk || []);

  function append(chunk) {
    buffer = buffer.length ? Buffer.concat([buffer, chunk]) : Buffer.from(chunk);
  }

  async function readBytes(n) {
    while (buffer.length < n) {
      const chunk = await new Promise((resolve, reject) => {
        const onData = (data) => {
          socket.off('error', onError);
          socket.off('close', onClose);
          resolve(data);
        };
        const onError = (err) => {
          socket.off('data', onData);
          socket.off('close', onClose);
          reject(err);
        };
        const onClose = () => {
          socket.off('data', onData);
          socket.off('error', onError);
          reject(new Error('socket closed while reading GSS token'));
        };
        socket.once('data', onData);
        socket.once('error', onError);
        socket.once('close', onClose);
      });
      append(chunk);
    }
    const out = buffer.slice(0, n);
    buffer = buffer.slice(n);
    return out;
  }

  async function readToken() {
    const header = await readBytes(3);
    const ver = header.readUInt8(0);
    if (ver !== 0x01) throw new Error(`invalid GSSAPI version byte: ${ver}`);
    const len = header.readUInt16BE(1);
    if (len === 0) return Buffer.alloc(0);
    const token = await readBytes(len);
    return token;
  }

  function writeToken(token) {
    const t = Buffer.from(token || []);
    const out = Buffer.alloc(3 + t.length);
    out.writeUInt8(0x01, 0);
    out.writeUInt16BE(t.length, 1);
    t.copy(out, 3);
    socket.write(out);
  }

  return { readToken, writeToken };
}

function loadKerberos() {
  let mod;
  try {
    mod = require('kerberos');
  } catch (e) {
    const err = new Error('kerberos module not found. Install with: npm install kerberos');
    err.cause = e;
    throw err;
  }

  // Support both ESM and CJS shapes
  return mod.default || mod;
}

/**
 * A minimal provider implementing the contract expected by src/socks5.js Phase 1.
 *
 * Options:
 * - service: string, default 'rcmd'
 * - hostname: string, default os.hostname()
 * - principal: explicit SPN, e.g., 'rcmd/host@REALM' (overrides service+hostname)
 * - keytab: optional, path to keytab (depends on kerberos module support)
 */
function createKerberosProvider(options = {}) {
  const service = options.service || 'rcmd';
  const hostname = options.hostname || os.hostname();
  const principal = options.principal || `${service}/${hostname}`;

  return {
    async authenticate(socket, firstChunk, callback) {
      let kerberos;
      try {
        kerberos = await loadKerberos();
      } catch (e) {
        callback(e);
        return;
      }

      const { readToken, writeToken } = createTokenIO(socket, firstChunk);

      // API compatibility: mongodb kerberos exposes initializeServer(principal, cb)
      const initServer = kerberos.initializeServer || kerberos.KerberosServer || (kerberos.default && kerberos.default.initializeServer);
      if (!initServer) {
        callback(new Error('Unsupported kerberos module API: expected initializeServer'));
        return;
      }

      try {
        // Create server context
        const server = await new Promise((resolve, reject) => {
          if (typeof initServer === 'function' && initServer.length >= 2) {
            // initializeServer(principal, cb)
            initServer(principal, (err, srv) => (err ? reject(err) : resolve(srv)));
          } else if (typeof kerberos.KerberosServer === 'function') {
            // new KerberosServer(principal)
            try {
              resolve(new kerberos.KerberosServer(principal));
            } catch (e) {
              reject(e);
            }
          } else {
            reject(new Error('Unable to construct kerberos server context'));
          }
        });

        // Context token exchange loop
        // Many implementations expose server.step(input, cb) -> output
        const step = (input) => new Promise((resolve, reject) => {
          if (typeof server.step === 'function') {
            // Some APIs expect base64; try Buffer/string passthrough first
            try {
              server.step(input, (err, out) => (err ? reject(err) : resolve(out)));
            } catch (e) {
              reject(e);
            }
          } else {
            reject(new Error('kerberos server context missing step()'));
          }
        });

        // Receive first token from client
        let inToken = await readToken();
        // Step until no output token is produced (context established)
        while (true) {
          const outToken = await step(inToken);
          if (outToken && outToken.length) {
            writeToken(Buffer.isBuffer(outToken) ? outToken : Buffer.from(outToken));
          }

          // Read next token if client has more to send
          // If the context is established, some implementations provide server.contextComplete
          // We conservatively attempt to read another token and break on empty.
          try {
            inToken = await readToken();
            if (!inToken || inToken.length === 0) break;
          } catch (e) {
            // If no more tokens, assume context is established
            break;
          }
        }

        // TODO: RFC 1961 protection-level negotiation and MIC verification.
        // Many clients will proceed with NONE. Some may require MIC; implement per 
        // your environment using server MIC methods.
        const principalName = server.username || server.user || server.principal || principal;
        callback(null, principalName);
      } catch (err) {
        callback(err);
      }
    }
  };
}

export default createKerberosProvider;
