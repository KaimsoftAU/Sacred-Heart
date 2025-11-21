import type { Player } from '../Player';
import type { PlayerHandler } from './PlayerHandler';
import type { Network } from '../network/Network';

/**
 * ChatMessage interface for React UI
 */
export interface ChatMessage {
    username: string;
    message: string;
    timestamp: number;
}

/**
 * ChatHandler - Manages chat messages and display
 * 
 * Responsibilities:
 * - Handle incoming messages from server
 * - Show messages above player heads
 * - Forward messages to React UI
 * - Send outgoing chat messages
 */
export class ChatHandler {
    private playerHandler: PlayerHandler;
    private localPlayer: Player | null;
    private onMessageReceived: (msg: ChatMessage) => void;
    private network: Network;

    constructor(
        playerHandler: PlayerHandler,
        localPlayer: Player | null,
        onMessageReceived: (msg: ChatMessage) => void,
        network: Network
    ) {
        this.playerHandler = playerHandler;
        this.localPlayer = localPlayer;
        this.onMessageReceived = onMessageReceived;
        this.network = network;
    }

    /**
     * Handle incoming chat message from another player
     * 1. Pass to React UI to display in chat box
     * 2. Show floating text above the sender's player mesh
     */
    public handleMessageReceived(data: { playerId: string; username: string; message: string }): void {
        // Send to React UI
        this.onMessageReceived({
            username: data.username,
            message: data.message,
            timestamp: Date.now()
        });

        // Show message above player's head in 3D world
        const player = this.playerHandler.getRemotePlayer(data.playerId);
        if (player) {
            player.showMessage(data.message);
        }
    }

    /**
     * Send a chat message
     * 1. Send to server (which broadcasts to other players)
     * 2. Show above local player's head
     */
    public sendMessage(message: string): void {
        this.network.sendMessage(message);
        this.showLocalPlayerMessage(message);
    }

    /**
     * Display message above local player's head
     */
    public showLocalPlayerMessage(message: string): void {
        if (this.localPlayer) {
            this.localPlayer.showMessage(message);
        }
    }

    /**
     * Update local player reference
     */
    public setLocalPlayer(player: Player | null): void {
        this.localPlayer = player;
    }
}
