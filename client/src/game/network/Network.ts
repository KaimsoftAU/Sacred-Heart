import { io, Socket } from 'socket.io-client';
import { ConnectionNetwork, type ConnectionCallbacks } from './Connection';
import { MovementNetwork } from './Movement';
import { PlayerNetwork, type PlayerCallbacks } from './Player';
import { ChatNetwork } from './Chat';
import type { PlayerData } from '../Player';

/**
 * Interface defining all possible network event callbacks
 * Game class provides implementations for these
 */
export interface NetworkCallbacks {
    onConnect?: () => void;                                                    // Connected to server
    onDisconnect?: () => void;                                                 // Disconnected from server
    onWelcome?: (data: any) => void;                                          // Initial welcome message
    onPlayerJoined?: (data: any) => void;                                     // Another player joined
    onPlayerLeft?: (data: { playerId: string; totalPlayers: number }) => void; // Player disconnected
    onPlayerMove?: (data: PlayerData) => void;                                // Player moved
    onPlayersUpdate?: (players: PlayerData[]) => void;                        // Bulk player update
    onPlayerMessage?: (data: any) => void;                                    // Chat message received
    onConnectionError?: (error: Error) => void;                               // Connection error
}

/**
 * Network Class - Main coordinator for all network communication
 * 
 * Architecture:
 * - Delegates specific functionality to specialized modules:
 *   - ConnectionNetwork: Connection lifecycle (connect, disconnect)
 *   - MovementNetwork: Player movement synchronization
 *   - PlayerNetwork: Player join/leave/update events
 *   - ChatNetwork: Chat message sending/receiving
 * 
 * This separation makes the code more maintainable and testable
 */
export class Network {
    private socket: Socket;
    private connection: ConnectionNetwork;
    private movement: MovementNetwork;
    private playerNetwork: PlayerNetwork;
    private chat: ChatNetwork;

    constructor(serverUrl: string, token: string, callbacks: NetworkCallbacks) {
        console.log('Connecting to game server with token:', token ? 'Token exists' : 'No token');

        // Connect to Socket.IO server
        this.socket = io(serverUrl, {
            auth: {
                token: token
            },
            transports: ['websocket', 'polling']
        });

        // Initialize network modules
        const connectionCallbacks: ConnectionCallbacks = {
            onConnect: callbacks.onConnect,
            onDisconnect: callbacks.onDisconnect,
            onConnectionError: callbacks.onConnectionError
        };
        this.connection = new ConnectionNetwork(this.socket, connectionCallbacks);

        this.movement = new MovementNetwork(this.socket);
        if (callbacks.onPlayerMove) {
            this.movement.onPlayerMove(callbacks.onPlayerMove);
        }

        const playerCallbacks: PlayerCallbacks = {
            onWelcome: callbacks.onWelcome,
            onPlayerJoined: callbacks.onPlayerJoined,
            onPlayerLeft: callbacks.onPlayerLeft,
            onPlayersUpdate: callbacks.onPlayersUpdate
        };
        this.playerNetwork = new PlayerNetwork(this.socket, playerCallbacks);

        this.chat = new ChatNetwork(this.socket);
        if (callbacks.onPlayerMessage) {
            this.chat.onPlayerMessage(callbacks.onPlayerMessage);
        }
    }

    public sendPlayerMove(position: { x: number; y: number; z: number }, rotation: { x: number; y: number; z: number }): void {
        this.movement.sendPlayerMove(position, rotation);
    }

    public sendMessage(message: string): void {
        this.chat.sendMessage(message);
    }

    public disconnect(): void {
        this.connection.disconnect();
    }

    public getSocketId(): string {
        return this.connection.getSocketId();
    }

    public isConnected(): boolean {
        return this.connection.isConnected();
    }
}
