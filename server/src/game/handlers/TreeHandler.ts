import type { Socket, Server } from 'socket.io';

/**
 * Interface for tree state
 */
export interface TreeState {
    id: string;
    position: { x: number; z: number };
    health: number;
    maxHealth: number;
    isAlive: boolean;
    respawnTimeout?: NodeJS.Timeout;
}

/**
 * TreeHandler Class - Manages all tree-related game logic
 * 
 * Responsibilities:
 * - Initialize tree states
 * - Handle tree chopping events
 * - Manage tree health and damage
 * - Handle tree respawning
 * - Broadcast tree state updates
 */
export class TreeHandler {
    private trees: Map<string, TreeState>;
    private io: Server;
    
    // Configuration constants
    private readonly TREE_CHOP_DAMAGE = 20;
    private readonly TREE_RESPAWN_TIME = 30000;  // 30 seconds
    private readonly WOODCUTTING_XP_PER_LOG = 25;

    /**
     * Constructor: Initialize tree handler
     * @param io - Socket.IO server instance for broadcasting
     */
    constructor(io: Server) {
        this.io = io;
        this.trees = new Map<string, TreeState>();
        this.initializeTrees();
    }

    /**
     * Initialize all trees in the world
     * Matches client-side tree positions
     */
    private initializeTrees(): void {
        const treePositions = [
            // North edge
            { x: -20, z: 20 }, { x: -10, z: 22 }, { x: 0, z: 23 }, { x: 10, z: 22 }, { x: 20, z: 20 },
            // South edge
            { x: -20, z: -20 }, { x: -10, z: -22 }, { x: 0, z: -23 }, { x: 10, z: -22 }, { x: 20, z: -20 },
            // West edge
            { x: -22, z: -10 }, { x: -23, z: 0 }, { x: -22, z: 10 },
            // East edge
            { x: 22, z: -10 }, { x: 23, z: 0 }, { x: 22, z: 10 },
            // Scattered in play area
            { x: -15, z: 5 }, { x: 15, z: -5 }, { x: -8, z: -8 }, { x: 8, z: 8 }
        ];

        treePositions.forEach((pos, index) => {
            const treeId = `tree_${index}`;
            this.trees.set(treeId, {
                id: treeId,
                position: { x: pos.x, z: pos.z },
                health: 100,
                maxHealth: 100,
                isAlive: true
            });
        });

        console.log(`[TreeHandler] Initialized ${this.trees.size} trees`);
    }

    /**
     * Get all tree states (for sending to new players)
     * @returns Array of tree state data
     */
    public getAllTreeStates(): Array<{ id: string; position: { x: number; z: number }; health: number; maxHealth: number; isAlive: boolean }> {
        return Array.from(this.trees.values()).map(tree => ({
            id: tree.id,
            position: tree.position,
            health: tree.health,
            maxHealth: tree.maxHealth,
            isAlive: tree.isAlive
        }));
    }

    /**
     * Handle tree chop event from player
     * @param socket - Socket of player who chopped
     * @param data - Contains treeId
     */
    public handleTreeChop(socket: Socket, data: { treeId: string }): void {
        const tree = this.trees.get(data.treeId);

        // Validate tree exists and is alive
        if (!tree || !tree.isAlive) {
            console.log(`[TreeHandler] Tree ${data.treeId} not available for chopping`);
            return;
        }

        // Reduce tree health
        tree.health -= this.TREE_CHOP_DAMAGE;
        const username = socket.data.username || 'Unknown';
        console.log(`[TreeHandler] ${username} chopped ${data.treeId}, health: ${tree.health}`);

        // Check if tree is depleted
        if (tree.health <= 0) {
            tree.health = 0;
            tree.isAlive = false;

            console.log(`[TreeHandler] Tree ${data.treeId} cut down by ${username}`);

            // Award player logs and XP
            socket.emit('woodcuttingReward', {
                logs: 1,
                xp: this.WOODCUTTING_XP_PER_LOG,
                treeId: data.treeId
            });

            // Schedule respawn
            this.scheduleTreeRespawn(tree);
        }

        // Broadcast tree state update to all players
        this.broadcastTreeUpdate(tree);
    }

    /**
     * Schedule tree respawn after delay
     * @param tree - Tree to respawn
     */
    private scheduleTreeRespawn(tree: TreeState): void {
        // Clear any existing timeout
        if (tree.respawnTimeout) {
            clearTimeout(tree.respawnTimeout);
        }

        tree.respawnTimeout = setTimeout(() => {
            tree.health = tree.maxHealth;
            tree.isAlive = true;
            console.log(`[TreeHandler] Tree ${tree.id} respawned`);

            // Broadcast respawn to all players
            this.broadcastTreeUpdate(tree);
        }, this.TREE_RESPAWN_TIME);
    }

    /**
     * Broadcast tree state update to all connected players
     * @param tree - Tree to broadcast
     */
    private broadcastTreeUpdate(tree: TreeState): void {
        this.io.emit('treeUpdate', {
            id: tree.id,
            position: tree.position,
            health: tree.health,
            maxHealth: tree.maxHealth,
            isAlive: tree.isAlive
        });
    }

    /**
     * Cleanup: Clear all respawn timeouts
     * Call this when shutting down server
     */
    public cleanup(): void {
        this.trees.forEach(tree => {
            if (tree.respawnTimeout) {
                clearTimeout(tree.respawnTimeout);
            }
        });
        console.log('[TreeHandler] Cleaned up all tree timeouts');
    }
}
