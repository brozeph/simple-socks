import { Server, Socket } from 'net';

export interface DestinationInfo {
	address: string;
	port: number;
}

export interface OriginInfo {
	address: string;
	port: number;
}

export type AuthenticateCallback = (err?: Error) => void;
export type ConnectionFilterCallback = (err?: Error) => void;

export type AuthenticateFn = (
	username: string,
	password: string,
	socket: Socket,
	callback: AuthenticateCallback,
) => void;

export type ConnectionFilterFn = (
	destination: DestinationInfo,
	origin: OriginInfo,
	callback: ConnectionFilterCallback,
) => void;

export interface Options {
	authenticate?: AuthenticateFn;
	connectionFilter?: ConnectionFilterFn;
	// Destroy sockets after this many ms of inactivity. 0 disables timeout.
	idleTimeout?: number;
	gssapi?: {
		enabled: boolean;
		// Phase 1 pluggable provider. If absent, GSSAPI is not selected.
		provider?: {
			authenticate: (
				socket: Socket,
				firstChunk: Buffer,
				callback: (err: Error | null, principal?: string) => void,
			) => void;
		};
	};
}

export class SocksServer {
	constructor(options?: Options);
	activeSessions: Socket[];
	options: Options;
	server: Server;
}

export const events: {
	readonly AUTHENTICATION: 'authenticate';
	readonly AUTHENTICATION_ERROR: 'authenticateError';
	readonly CONNECTION_FILTER: 'connectionFilter';
	readonly HANDSHAKE: 'handshake';
	readonly PROXY_CONNECT: 'proxyConnect';
	readonly PROXY_DATA: 'proxyData';
	readonly PROXY_DISCONNECT: 'proxyDisconnect';
	readonly PROXY_END: 'proxyEnd';
	readonly PROXY_ERROR: 'proxyError';
};

export function createServer(options?: Options): Server;

declare const _default: {
	SocksServer: typeof SocksServer;
	createServer: typeof createServer;
	events: typeof events;
};

export default _default;
