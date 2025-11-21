import type { Socket } from 'socket.io-client';
import type { PlayerData } from '../Player';

export interface PlayerCallbacks {
    onWelcome?: (data: any) => void;
    onPlayerJoined?: (data: any) => void;
    onPlayerLeft?: (data: { playerId: string; totalPlayers: number }) => void;
    onPlayersUpdate?: (players: PlayerData[]) => void;
}

export class PlayerNetwork {
    private socket: Socket;
    private callbacks: PlayerCallbacks;

    constructor(socket: Socket, callbacks: PlayerCallbacks) {
        this.socket = socket;
        this.callbacks = callbacks;
        this.setupListeners();
    }

    private setupListeners(): void {
        this.socket.on('welcome', (data) => {
            console.log('Welcome message:', data);
            if (this.callbacks.onWelcome) {
                this.callbacks.onWelcome(data);
            }
        });

        this.socket.on('playerJoined', (data) => {
            console.log('Player joined:', data);
            if (this.callbacks.onPlayerJoined) {
                this.callbacks.onPlayerJoined(data);
            }
        });

        this.socket.on('playerLeft', (data) => {
            console.log('Player left:', data.playerId);
            if (this.callbacks.onPlayerLeft) {
                this.callbacks.onPlayerLeft(data);
            }
        });

        this.socket.on('playersUpdate', (players: PlayerData[]) => {
            if (this.callbacks.onPlayersUpdate) {
                this.callbacks.onPlayersUpdate(players);
            }
        });
    }
}
