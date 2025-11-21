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
     */
    public update(): void {
        if (!this.localPlayer) return;

        const { moved, position, rotation } = this.localPlayer.updateMovement();

        if (moved) {
            // Send position update to server via network
            this.network.sendPlayerMove(
                { x: position.x, y: position.y, z: position.z },
                { x: rotation.x, y: rotation.y, z: rotation.z }
            );
        }
    }

    /**
     * Update local player reference
     */
    public setLocalPlayer(player: Player | null): void {
        this.localPlayer = player;
    }
}
