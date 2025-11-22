import * as BABYLON from '@babylonjs/core';
import type { Tree } from '../Tree';
import type { PlayerHandler } from './PlayerHandler';
import type { Player } from '../Player';
import type { WoodcuttingHandler } from './WoodcuttingHandler';

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
    private woodcuttingHandler: WoodcuttingHandler;
    private onTreeChop?: (treeId: string) => void;
    private onPlayerSelected?: (playerData: { name: string; health: number; maxHealth: number; mesh: BABYLON.Mesh | null; woodcuttingLevel: number } | null) => void;
    private onPlayerRightClick?: (playerData: { id: string; name: string; x: number; y: number }) => void;

    constructor(
        scene: BABYLON.Scene,
        trees: Map<string, Tree>,
        playerHandler: PlayerHandler,
        _localPlayer: Player | null,
        woodcuttingHandler: WoodcuttingHandler,
        onTreeChop?: (treeId: string) => void,
        onPlayerSelected?: (playerData: { name: string; health: number; maxHealth: number; mesh: BABYLON.Mesh | null; woodcuttingLevel: number } | null) => void,
        onPlayerRightClick?: (playerData: { id: string; name: string; x: number; y: number }) => void
    ) {
        this.scene = scene;
        this.trees = trees;
        this.playerHandler = playerHandler;
        this.woodcuttingHandler = woodcuttingHandler;
        this.onTreeChop = onTreeChop;
        this.onPlayerSelected = onPlayerSelected;
        this.onPlayerRightClick = onPlayerRightClick;
        
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

        // Handle right click for context menu
        this.scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
                const evt = pointerInfo.event as PointerEvent;
                
                // Check for right click (button 2)
                if (evt.button === 2) {
                    evt.preventDefault();
                    
                    const pickResult = pointerInfo.pickInfo;
                    if (!pickResult || !pickResult.hit) return;

                    const pickedMesh = pickResult.pickedMesh;
                    if (!pickedMesh || !pickedMesh.metadata) return;

                    // Check if player was right-clicked
                    if (pickedMesh.metadata.type === 'player') {
                        const playerId = pickedMesh.metadata.playerId;
                        const player = this.playerHandler.getRemotePlayer(playerId);
                        
                        if (player && this.onPlayerRightClick) {
                            this.onPlayerRightClick({
                                id: playerId,
                                name: player.getUsername() || 'Unknown Player',
                                x: evt.clientX,
                                y: evt.clientY
                            });
                        }
                    }
                }
            }
        });

        // Prevent default context menu
        this.scene.getEngine().getRenderingCanvas()?.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    /**
     * Handle tree click - trigger chopping
     */
    private handleTreeClick(treeId: string): void {
        const tree = this.trees.get(treeId);
        
        if (tree && tree.getIsAlive()) {
            // Shake the tree locally
            tree.shake();
            
            // Call the woodcutting handler
            if (this.onTreeChop) {
                this.onTreeChop(treeId);
            }
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
                mesh: player.getMesh(),
                woodcuttingLevel: this.woodcuttingHandler.getWoodcuttingLevel()
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
