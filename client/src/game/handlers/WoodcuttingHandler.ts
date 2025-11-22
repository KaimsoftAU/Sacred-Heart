import * as BABYLON from '@babylonjs/core';
import { Tree, type TreeData } from '../Tree';
import type { Network } from '../network/Network';
import { calculateLevel, checkLevelUp } from '../utils/skillUtils';

/**
 * WoodcuttingHandler - Manages complete woodcutting system on client
 * 
 * Responsibilities:
 * - Create and manage all trees in the world
 * - Track woodcutting stats (level, XP, logs)
 * - Handle tree chopping actions
 * - Process tree state updates from server
 * - Handle woodcutting rewards
 * - Sync skills with database
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
        // Don't create trees immediately - wait for terrain to be ready
        
        // Load skills from server on init
        this.loadSkills();
    }

    /**
     * Create trees after terrain is ready
     * Should be called after terrain height modifications are complete
     */
    public createTreesDelayed(): void {
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
        this.network.sendTreeShake(treeId);
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
    public async handleWoodcuttingReward(data: { logs: number; xp: number; treeId: string }): Promise<void> {
        this.logsCollected += data.logs;
        
        const oldXp = this.woodcuttingXP;
        
        // Calculate new XP and level
        this.woodcuttingXP += data.xp;
        const levelsGained = checkLevelUp(oldXp, this.woodcuttingXP);
        
        // Update level locally
        this.woodcuttingLevel = calculateLevel(this.woodcuttingXP);
        
        console.log(`Woodcutting reward: +${data.logs} logs, +${data.xp} XP`);
        console.log(`Total: ${this.logsCollected} logs, Level ${this.woodcuttingLevel} (${this.woodcuttingXP} XP)`);
        
        // Show level up message
        if (levelsGained.length > 0) {
            levelsGained.forEach(level => {
                console.log(`🎉 Woodcutting level up! You are now level ${level}!`);
            });
        }
        
        // Sync with server
        await this.syncSkillsToServer(data.xp);
    }
    
    /**
     * Load skills from server
     */
    private async loadSkills(): Promise<void> {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            
            const response = await fetch('http://localhost:3000/api/player/skills', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.woodcuttingLevel = data.skills?.woodcutting?.level || 1;
                this.woodcuttingXP = data.skills?.woodcutting?.xp || 0;
                console.log(`Loaded woodcutting skill: Level ${this.woodcuttingLevel} (${this.woodcuttingXP} XP)`);
            }
        } catch (error) {
            console.error('Failed to load skills:', error);
        }
    }
    
    /**
     * Sync skills to server
     */
    private async syncSkillsToServer(xpGained: number): Promise<void> {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            
            const response = await fetch('http://localhost:3000/api/player/skills/woodcutting', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ xpGained })
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('Skill synced to server:', data);
                
                // Update local state from server response
                this.woodcuttingLevel = data.newLevel;
                this.woodcuttingXP = data.newXp;
            } else {
                console.error('Failed to sync skills to server');
            }
        } catch (error) {
            console.error('Error syncing skills:', error);
        }
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
     * Get current woodcutting level
     */
    public getWoodcuttingLevel(): number {
        return this.woodcuttingLevel;
    }

    /**
     * Get current woodcutting XP
     */
    public getWoodcuttingXP(): number {
        return this.woodcuttingXP;
    }

    /**
     * Get number of logs collected
     */
    public getLogsCollected(): number {
        return this.logsCollected;
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
