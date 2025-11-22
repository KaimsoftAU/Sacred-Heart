import type { NetworkCallbacks } from '../network/Network';
import type { PlayerData } from '../Player';
import type { TreeData } from '../Tree';

/**
 * GameNetworkHandler Class - Handles all network events for the Game
 * 
 * Purpose:
 * - Separates network event handling from game logic
 * - Game class provides callbacks for what to do when events occur
 * - This class handles the raw network events and calls appropriate callbacks
 * 
 * Benefits:
 * - Game class stays focused on game logic
 * - Network handling is isolated and testable
 * - Easy to add new network events without cluttering Game class
 */
export class GameNetworkHandler {
    // Callbacks provided by Game class
    private onPlayerMoveCallback: (data: PlayerData) => void;
    private onPlayerLeftCallback: (playerId: string) => void;
    private onPlayersUpdateCallback: (players: PlayerData[]) => void;
    private onMessageCallback: (data: { playerId: string; username: string; message: string }) => void;
    private socketIdGetter: () => string;
    private onTreeUpdateCallback?: (treeData: TreeData) => void;
    private onTreesUpdateCallback?: (trees: TreeData[]) => void;
    private onWoodcuttingRewardCallback?: (data: { logs: number; xp: number; treeId: string }) => void;
    private onTreeShakeCallback?: (data: { treeId: string; playerId: string }) => void;

    /**
     * Constructor: Store callbacks from Game class
     * @param onPlayerMove - Called when a player moves
     * @param onPlayerLeft - Called when a player disconnects
     * @param onPlayersUpdate - Called for bulk player updates
     * @param getSocketId - Function to get our socket ID
     * @param onMessage - Called when chat message arrives
     */
    constructor(
        onPlayerMove: (data: PlayerData) => void,
        onPlayerLeft: (playerId: string) => void,
        onPlayersUpdate: (players: PlayerData[]) => void,
        getSocketId: () => string,
        onMessage: (data: { playerId: string; username: string; message: string }) => void,
        onTreeUpdate?: (treeData: TreeData) => void,
        onTreesUpdate?: (trees: TreeData[]) => void,
        onWoodcuttingReward?: (data: { logs: number; xp: number; treeId: string }) => void,
        onTreeShake?: (data: { treeId: string; playerId: string }) => void
    ) {
        this.onPlayerMoveCallback = onPlayerMove;
        this.onPlayerLeftCallback = onPlayerLeft;
        this.onPlayersUpdateCallback = onPlayersUpdate;
        this.socketIdGetter = getSocketId;
        this.onMessageCallback = onMessage;
        this.onTreeUpdateCallback = onTreeUpdate;
        this.onTreesUpdateCallback = onTreesUpdate;
        this.onWoodcuttingRewardCallback = onWoodcuttingReward;
        this.onTreeShakeCallback = onTreeShake;
    }

    public getNetworkCallbacks(): NetworkCallbacks {
        return {
            onConnect: () => this.handleConnect(),
            onDisconnect: () => this.handleDisconnect(),
            onWelcome: (data) => this.handleWelcome(data),
            onPlayerJoined: (data) => this.handlePlayerJoined(data),
            onPlayerLeft: (data) => this.handlePlayerLeft(data),
            onPlayerMove: (data) => this.handlePlayerMove(data),
            onPlayersUpdate: (players) => this.handlePlayersUpdate(players),
            onPlayerMessage: (data) => this.handlePlayerMessage(data),
            onConnectionError: (error) => this.handleConnectionError(error),
            onTreeUpdate: this.onTreeUpdateCallback,
            onTreesUpdate: this.onTreesUpdateCallback,
            onWoodcuttingReward: this.onWoodcuttingRewardCallback,
            onTreeShake: this.onTreeShakeCallback
        };
    }

    private handleConnect(): void {
        console.log('Game network: Connected');
    }

    private handleDisconnect(): void {
        console.log('Game network: Disconnected from server');
    }

    private handleWelcome(data: any): void {
        console.log('Game network: Welcome data:', data);
    }

    private handlePlayerJoined(_data: any): void {
        console.log('Game network: Player joined notification');
    }

    private handlePlayerLeft(data: { playerId: string; totalPlayers: number }): void {
        this.onPlayerLeftCallback(data.playerId);
    }

    private handlePlayerMove(data: PlayerData): void {
        this.onPlayerMoveCallback(data);
    }

    private handlePlayersUpdate(players: PlayerData[]): void {
        const filteredPlayers = players.filter(p => p.id !== this.socketIdGetter());
        this.onPlayersUpdateCallback(filteredPlayers);
    }

    private handlePlayerMessage(data: any): void {
        console.log('Game network: Player message:', data);
        this.onMessageCallback(data);
    }

    private handleConnectionError(error: Error): void {
        console.error('Game network: Connection error:', error);
    }
}
