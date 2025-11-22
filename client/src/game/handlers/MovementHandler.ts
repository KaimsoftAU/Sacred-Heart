import type { Player } from '../Player';
import type { Network } from '../network/Network';

/**
 * MovementHandler - Manages player movement updates
 * 
 * Responsibilities:
 * - Check for player movement each frame
 * - Send movement updates to server when player moves
 */
export class MovementHandler {
    private localPlayer: Player | null;
    private network: Network;

    constructor(localPlayer: Player | null, network: Network) {
        this.localPlayer = localPlayer;
        this.network = network;
    }

    /**
     * Update player movement and send to server if moved
     * Called every frame from game loop
     * @returns true if player moved this frame, false otherwise
     */
    public update(): boolean {
        if (!this.localPlayer) return false;

        const { moved, position, rotation } = this.localPlayer.updateMovement();

        if (moved) {
            // Send position update to server via network
            this.network.sendPlayerMove(
                { x: position.x, y: position.y, z: position.z },
                { x: rotation.x, y: rotation.y, z: rotation.z }
            );
        }
        
        return moved;
    }

    /**
     * Update local player reference
     */
    public setLocalPlayer(player: Player | null): void {
        this.localPlayer = player;
    }
}
