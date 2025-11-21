import * as BABYLON from '@babylonjs/core';
import type { Tree } from '../Tree';
import type { PlayerHandler } from './PlayerHandler';

/**
 * InteractionHandler - Manages click/pointer interactions in the game
 * 
 * Responsibilities:
 * - Handle tree clicks for woodcutting
 * - Handle player clicks for target selection
 * - Deselect when clicking ground/empty space
 */
export class InteractionHandler {
    private scene: BABYLON.Scene;
    private trees: Map<string, Tree>;
    private playerHandler: PlayerHandler;
    private onTreeChop?: (treeId: string) => void;
    private onPlayerSelected?: (playerData: { name: string; health: number; maxHealth: number; mesh: BABYLON.Mesh | null } | null) => void;

    constructor(
        scene: BABYLON.Scene,
        trees: Map<string, Tree>,
        playerHandler: PlayerHandler,
        onTreeChop?: (treeId: string) => void,
        onPlayerSelected?: (playerData: { name: string; health: number; maxHealth: number; mesh: BABYLON.Mesh | null } | null) => void
    ) {
        this.scene = scene;
        this.trees = trees;
        this.playerHandler = playerHandler;
        this.onTreeChop = onTreeChop;
        this.onPlayerSelected = onPlayerSelected;
        
        this.setupPointerInteraction();
    }

    /**
     * Setup click interaction for trees and players
     * Uses raycasting to detect what was clicked
     */
    private setupPointerInteraction(): void {
        this.scene.onPointerDown = (evt, pickResult) => {
            // Only handle left click
            if (evt.button !== 0) return;

            // Check if we clicked something
            if (pickResult.hit && pickResult.pickedMesh) {
                const metadata = pickResult.pickedMesh.metadata;
                console.log('Clicked mesh:', pickResult.pickedMesh.name, 'Metadata:', metadata);
                
                // Check if it's a tree
                if (metadata && metadata.type === 'tree') {
                    this.handleTreeClick(metadata.treeId);
                }
                // Check if it's a player
                else if (metadata && metadata.type === 'player') {
                    this.handlePlayerClick(metadata.playerId);
                }
                // Clicked ground or something else - deselect
                else {
                    this.deselectPlayer();
                }
            }
            // Clicked nothing - deselect
            else {
                this.deselectPlayer();
            }
        };
    }

    /**
     * Handle tree click - trigger chopping
     */
    private handleTreeClick(treeId: string): void {
        const tree = this.trees.get(treeId);
        
        if (tree && tree.getIsAlive() && this.onTreeChop) {
            // Call the woodcutting handler directly
            this.onTreeChop(treeId);
        }
    }

    /**
     * Handle player click - show target frame UI
     */
    private handlePlayerClick(playerId: string): void {
        console.log('Clicked on player:', playerId, 'Remote players:', Array.from(this.playerHandler.getAllRemotePlayers().keys()));
        const player = this.playerHandler.getRemotePlayer(playerId);
        
        // Only show UI for remote players (not local player)
        if (player && this.onPlayerSelected) {
            console.log('Showing UI for player:', player.getUsername());
            this.onPlayerSelected({
                name: player.getUsername() || 'Unknown Player',
                health: player.getHealth(),
                maxHealth: player.getMaxHealth(),
                mesh: player.getMesh()
            });
        } else {
            console.log('Player not found or no callback:', { hasPlayer: !!player, hasCallback: !!this.onPlayerSelected });
        }
    }

    /**
     * Deselect player - hide target frame UI
     */
    private deselectPlayer(): void {
        if (this.onPlayerSelected) {
            this.onPlayerSelected(null);
        }
    }
}
