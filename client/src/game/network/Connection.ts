import type { Socket } from 'socket.io-client';

export interface ConnectionCallbacks {
    onConnect?: () => void;
    onDisconnect?: () => void;
    onConnectionError?: (error: Error) => void;
}

export class ConnectionNetwork {
    private socket: Socket;
    private callbacks: ConnectionCallbacks;

    constructor(socket: Socket, callbacks: ConnectionCallbacks) {
        this.socket = socket;
        this.callbacks = callbacks;
        this.setupListeners();
    }

    private setupListeners(): void {
        this.socket.on('connect', () => {
            console.log('Connected to game server:', this.socket.id);
            if (this.callbacks.onConnect) {
                this.callbacks.onConnect();
            }
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error.message);
            if (this.callbacks.onConnectionError) {
                this.callbacks.onConnectionError(error);
            }
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from game server');
            if (this.callbacks.onDisconnect) {
                this.callbacks.onDisconnect();
            }
        });
    }

    public getSocketId(): string {
        return this.socket.id || '';
    }

    public isConnected(): boolean {
        return this.socket.connected;
    }

    public disconnect(): void {
        this.socket.disconnect();
    }
}
