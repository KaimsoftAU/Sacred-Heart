import * as BABYLON from '@babylonjs/core';
import { Player, type PlayerData } from '../Player';

/**
 * PlayerHandler - Manages all player-related logic
 * 
 * Responsibilities:
 * - Create and track remote players
 * - Update player positions/rotations
 * - Remove disconnected players
 * - Handle bulk player updates
 */
export class PlayerHandler {
    private scene: BABYLON.Scene;
    private remotePlayers: Map<string, Player>;

    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
        this.remotePlayers = new Map();
    }

    /**
     * Update or create a remote player
     */
    public updateRemotePlayer(playerData: PlayerData): void {
        let remotePlayer = this.remotePlayers.get(playerData.id);

        if (!remotePlayer) {
            // Create new remote player
            remotePlayer = new Player(this.scene, playerData, false);
            this.remotePlayers.set(playerData.id, remotePlayer);
            console.log('Created remote player:', playerData.id, playerData.username);
        } else {
            // Update existing player
            remotePlayer.update(playerData);
        }
    }

    /**
     * Remove a disconnected player
     */
    public removeRemotePlayer(playerId: string): void {
        const remotePlayer = this.remotePlayers.get(playerId);
        if (remotePlayer) {
            console.log('Removing remote player:', playerId);
            remotePlayer.dispose();
            this.remotePlayers.delete(playerId);
        }
    }

    /**
     * Handle bulk player update (initial sync on connection)
     */
    public handlePlayersUpdate(players: PlayerData[]): void {
        console.log('Received players update:', players.length, 'players');
        players.forEach(playerData => {
            this.updateRemotePlayer(playerData);
        });
    }

    /**
     * Get a specific remote player
     */
    public getRemotePlayer(playerId: string): Player | undefined {
        return this.remotePlayers.get(playerId);
    }

    /**
     * Get all remote players
     */
    public getAllRemotePlayers(): Map<string, Player> {
        return this.remotePlayers;
    }

    /**
     * Clean up all remote players
     */
    public dispose(): void {
        this.remotePlayers.forEach((player, playerId) => {
            console.log('Cleaning up player:', playerId);
            player.dispose();
        });
        this.remotePlayers.clear();
    }
}
