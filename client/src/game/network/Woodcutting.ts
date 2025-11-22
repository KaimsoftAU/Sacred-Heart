import type { Socket } from 'socket.io-client';
import type { TreeData } from '../Tree';

/**
 * WoodcuttingNetwork Class - Handles tree interaction network events
 * 
 * Events:
 * - treeChop: Sent when player chops a tree
 * - treeUpdate: Received when tree state changes (health, alive status)
 * - trees Update: Received on connect with all tree states
 * - woodcuttingReward: Received when player gets logs/XP
 */
export class WoodcuttingNetwork {
    private socket: Socket;

    constructor(socket: Socket) {
        this.socket = socket;
    }

    /**
     * Send tree chop action to server
     * @param treeId - ID of tree being chopped
     */
    public sendTreeChop(treeId: string): void {
        this.socket.emit('treeChop', { treeId });
    }

    /**
     * Listen for tree state updates
     * @param callback - Called when tree health/state changes
     */
    public onTreeUpdate(callback: (treeData: TreeData) => void): void {
        this.socket.on('treeUpdate', callback);
    }

    /**
     * Listen for bulk tree updates (initial sync)
     * @param callback - Called with array of all tree states
     */
    public onTreesUpdate(callback: (trees: TreeData[]) => void): void {
        this.socket.on('treesUpdate', callback);
    }

    /**
     * Listen for woodcutting rewards (logs, XP)
     * @param callback - Called when player receives reward
     */
    public onWoodcuttingReward(callback: (data: { logs: number; xp: number; treeId: string }) => void): void {
        this.socket.on('woodcuttingReward', callback);
    }

    /**
     * Listen for tree shake events from other players
     * @param callback - Called when another player shakes a tree
     */
    public onTreeShake(callback: (data: { treeId: string; playerId: string }) => void): void {
        this.socket.on('treeShake', callback);
    }

    /**
     * Remove tree update listener
     */
    public offTreeUpdate(): void {
        this.socket.off('treeUpdate');
    }

    /**
     * Remove trees update listener
     */
    public offTreesUpdate(): void {
        this.socket.off('treesUpdate');
    }

    /**
     * Remove woodcutting reward listener
     */
    public offWoodcuttingReward(): void {
        this.socket.off('woodcuttingReward');
    }

    /**
     * Remove tree shake listener
     */
    public offTreeShake(): void {
        this.socket.off('treeShake');
    }
}
