import * as BABYLON from '@babylonjs/core';
import { Tree, type TreeData } from '../Tree';
import type { Network } from '../network/Network';

/**
 * WoodcuttingHandler - Manages complete woodcutting system on client
 * 
 * Responsibilities:
 * - Create and manage all trees in the world
 * - Track woodcutting stats (level, XP, logs)
 * - Handle tree chopping actions
 * - Process tree state updates from server
 * - Handle woodcutting rewards
 * - Clean up trees on dispose
 */
export class WoodcuttingHandler {
    private scene: BABYLON.Scene;
    private trees: Map<string, Tree>;
    private network: Network;
    
    // Woodcutting stats
    private woodcuttingLevel: number = 1;
    private woodcuttingXP: number = 0;
    private logsCollected: number = 0;

    constructor(scene: BABYLON.Scene, network: Network) {
        this.scene = scene;
        this.network = network;
        this.trees = new Map();
        this.createTrees();
    }

    /**
     * Create all trees in the world
     * Trees are positioned around the edges of the ground
     */
    private createTrees(): void {
        const treePositions = [
            // North edge
            { x: -20, z: 20 }, { x: -10, z: 22 }, { x: 0, z: 23 }, { x: 10, z: 22 }, { x: 20, z: 20 },
            // South edge
            { x: -20, z: -20 }, { x: -10, z: -22 }, { x: 0, z: -23 }, { x: 10, z: -22 }, { x: 20, z: -20 },
            // West edge
            { x: -22, z: -10 }, { x: -23, z: 0 }, { x: -22, z: 10 },
            // East edge
            { x: 22, z: -10 }, { x: 23, z: 0 }, { x: 22, z: 10 },
            // Some scattered in play area
            { x: -15, z: 5 }, { x: 15, z: -5 }, { x: -8, z: -8 }, { x: 8, z: 8 }
        ];

        treePositions.forEach((pos, index) => {
            const treeId = `tree_${index}`;
            const treeData: TreeData = {
                id: treeId,
                position: { x: pos.x, z: pos.z },
                health: 100,
                maxHealth: 100,
                isAlive: true
            };

            // Create tree without callback (InteractionHandler will handle clicks)
            const tree = new Tree(this.scene, treeData);
            this.trees.set(treeId, tree);
        });

        console.log(`[WoodcuttingHandler] Created ${this.trees.size} trees`);
    }

    /**
     * Get all trees
     */
    public getTrees(): Map<string, Tree> {
        return this.trees;
    }

    /**
     * Handle tree being chopped
     * Send to server which will update health and broadcast
     */
    public handleTreeChop(treeId: string): void {
        console.log('Player chopping tree:', treeId);
        this.network.sendTreeChop(treeId);
    }

    /**
     * Handle tree state update from server
     * Update local tree instance
     */
    public handleTreeUpdate(treeData: TreeData): void {
        const tree = this.trees.get(treeData.id);
        if (tree) {
            tree.update(treeData);
        }
    }

    /**
     * Handle bulk tree update (on initial connection)
     * Sync all tree states from server
     */
    public handleTreesUpdate(trees: TreeData[]): void {
        trees.forEach(treeData => {
            const tree = this.trees.get(treeData.id);
            if (tree) {
                tree.update(treeData);
            }
        });
    }

    /**
     * Handle woodcutting reward from server
     * Update stats and show feedback
     */
    public handleWoodcuttingReward(data: { logs: number; xp: number; treeId: string }): void {
        this.logsCollected += data.logs;
        this.woodcuttingXP += data.xp;
        
        console.log(`Woodcutting reward: +${data.logs} logs, +${data.xp} XP`);
        console.log(`Total: ${this.logsCollected} logs, ${this.woodcuttingXP} XP`);
        
        // TODO: Show visual feedback or update UI
        // Could show floating text "+1 Log" above player
    }

    /**
     * Get current woodcutting stats
     */
    public getStats(): { level: number; xp: number; logs: number } {
        return {
            level: this.woodcuttingLevel,
            xp: this.woodcuttingXP,
            logs: this.logsCollected
        };
    }

    /**
     * Clean up all trees
     */
    public dispose(): void {
        this.trees.forEach((tree) => {
            tree.dispose();
        });
        this.trees.clear();
    }
}
