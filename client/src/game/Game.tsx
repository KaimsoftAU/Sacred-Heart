import * as BABYLON from '@babylonjs/core';
import { Player } from './Player';
import { Network } from './network/Network';
import { GameNetworkHandler } from './handlers/GameNetworkHandler';
import { WoodcuttingHandler } from './handlers/WoodcuttingHandler';
import { PlayerHandler } from './handlers/PlayerHandler';
import { InteractionHandler } from './handlers/InteractionHandler';
import { ChatHandler, type ChatMessage } from './handlers/ChatHandler';
import { MovementHandler } from './handlers/MovementHandler';

// Re-export ChatMessage for external use
export type { ChatMessage };

/**
 * Game Class - Main coordinator for the Babylon.js 3D game
 * 
 * Responsibilities:
 * - Initialize Babylon.js engine, scene, camera, lights
 * - Create and manage local player (controlled by this client)
 * - Create and manage remote players (controlled by other clients)
 * - Handle network events through GameNetworkHandler
 * - Coordinate between Player instances and Network layer
 * - Manage game loop (movement updates, rendering)
 */
class Game {
    private canvas: HTMLCanvasElement;                      // HTML canvas element for rendering
    private engine: BABYLON.Engine;                         // Babylon.js WebGL engine
    private scene: BABYLON.Scene;                           // 3D scene containing all meshes
    private playerData: any;                                // Initial player data from database
    private network: Network;                               // Network coordinator (Socket.IO)
    private networkHandler: GameNetworkHandler;             // Handles network event callbacks
    private localPlayer: Player | null = null;              // The player controlled by this client
    private onPlayerSelected?: (playerData: { name: string; health: number; maxHealth: number; mesh: BABYLON.Mesh | null } | null) => void;  // Callback when player is selected
    
    // Handlers
    private woodcuttingHandler!: WoodcuttingHandler;
    private playerHandler!: PlayerHandler;
    private interactionHandler!: InteractionHandler;
    private chatHandler!: ChatHandler;
    private movementHandler!: MovementHandler;

    /**
     * Constructor: Initialize game systems
     * @param canvasId - ID of HTML canvas element to render to
     * @param player - Player data from authentication (username, position, etc.)
     * @param token - JWT token for WebSocket authentication
     * @param onMessageReceived - Callback to pass chat messages to React UI
     * @param onPlayerSelected - Callback when a player is clicked for UI display
     */
    constructor(
        canvasId: string, 
        player: any, 
        token: string, 
        onMessageReceived: (msg: ChatMessage) => void,
        onPlayerSelected?: (playerData: { name: string; health: number; maxHealth: number; mesh: BABYLON.Mesh | null } | null) => void
    ) {
        // Get canvas element and initialize Babylon.js WebGL engine
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.engine = new BABYLON.Engine(this.canvas, true);  // true = enable antialiasing
        this.playerData = player;
        this.onPlayerSelected = onPlayerSelected;
        
        // Initialize player handler first (needed for scene creation)
        this.scene = new BABYLON.Scene(this.engine);
        this.playerHandler = new PlayerHandler(this.scene);
        
        // Create scene with player
        this.setupScene();
        
        // Create network handler - we'll pass these callbacks to Network
        // (we define them now even though some handlers don't exist yet, they'll work when called)
        this.networkHandler = new GameNetworkHandler(
            (data) => this.playerHandler.updateRemotePlayer(data),
            (playerId) => this.playerHandler.removeRemotePlayer(playerId),
            (players) => this.playerHandler.handlePlayersUpdate(players),
            () => this.network?.getSocketId() || '',
            (msg) => this.chatHandler?.handleMessageReceived(msg),
            (treeData) => this.woodcuttingHandler?.handleTreeUpdate(treeData),
            (trees) => this.woodcuttingHandler?.handleTreesUpdate(trees),
            (reward) => this.woodcuttingHandler?.handleWoodcuttingReward(reward)
        );
        
        // Initialize network connection with JWT authentication
        this.network = new Network('http://localhost:3000', token, this.networkHandler.getNetworkCallbacks());
        
        // Initialize chat handler with local player and network
        this.chatHandler = new ChatHandler(this.playerHandler, this.localPlayer, onMessageReceived, this.network);
        
        // Initialize movement handler
        this.movementHandler = new MovementHandler(this.localPlayer, this.network);
        
        // Initialize woodcutting handler (creates trees and needs network)
        this.woodcuttingHandler = new WoodcuttingHandler(this.scene, this.network);
        
        // Initialize interaction handler (needs scene and handlers to be set up)
        this.interactionHandler = new InteractionHandler(
            this.scene,
            this.woodcuttingHandler.getTrees(),
            this.playerHandler,
            (treeId) => this.woodcuttingHandler.handleTreeChop(treeId),
            this.onPlayerSelected
        );
        
        /**
         * Game loop: Runs every frame (~60 FPS)
         * 1. Update player movement (check keyboard input, send to server)
         * 2. Render the scene
         */
        this.engine.runRenderLoop(() => {
            this.movementHandler.update();
            this.scene.render();
        });
        
        // Handle window resize to maintain correct aspect ratio
        window.addEventListener('resize', () => {
            this.engine.resize();
        });
    }

    /**
     * Get chat handler for external use
     * Allows React UI to send messages directly
     */
    public getChatHandler(): ChatHandler {
        return this.chatHandler;
    }

    /**
     * Setup the scene with camera, lights, ground, and local player
     * Called during initialization after scene and playerHandler are created
     */
    private setupScene(): void {
        // Camera
        const camera = new BABYLON.ArcRotateCamera(
            'Camera',
            Math.PI / 2,
            Math.PI / 3,
            15,
            BABYLON.Vector3.Zero(),
            this.scene
        );
        camera.attachControl(this.canvas, true);
        camera.lowerRadiusLimit = 5;
        camera.upperRadiusLimit = 30;
        
        // Light
        new BABYLON.HemisphericLight(
            'light1',
            new BABYLON.Vector3(1, 1, 0),
            this.scene
        );
        
        // Ground
        const ground = BABYLON.MeshBuilder.CreateGround(
            'ground',
            { width: 50, height: 50 },
            this.scene
        );
        const groundMaterial = new BABYLON.StandardMaterial('groundMat', this.scene);
        groundMaterial.diffuseColor = new BABYLON.Color3(0.3, 0.5, 0.3);
        ground.material = groundMaterial;
        
        // Create local player
        const initialPosition = this.playerData.position || { x: 0, y: 0.5, z: 0 };
        const initialRotation = this.playerData.rotation || { x: 0, y: 0, z: 0 };
        
        this.localPlayer = new Player(
            this.scene,
            {
                id: 'local',
                username: this.playerData.username,
                position: { ...initialPosition, y: initialPosition.y || 0.5 },
                rotation: initialRotation
            },
            true
        );
        
        // Camera follow player
        camera.target = this.localPlayer.getMesh().position;
    }

    public dispose(): void {
        console.log('Disposing game, cleaning up resources...');
        
        // Clean up local player
        if (this.localPlayer) {
            this.localPlayer.dispose();
            this.localPlayer = null;
        }
        
        // Clean up handlers (which clean up remote players and trees)
        this.playerHandler.dispose();
        this.woodcuttingHandler.dispose();
        
        // Disconnect from network
        this.network.disconnect();
        this.engine.dispose();
    }
}

export default Game;