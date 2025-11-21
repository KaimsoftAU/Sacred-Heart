import * as BABYLON from '@babylonjs/core';
import { Player, type PlayerData } from './Player';
import { Tree, type TreeData } from './Tree';
import { Network } from './network/Network';
import { GameNetworkHandler } from './handlers/GameNetworkHandler';

// Interface for chat messages passed to React UI
export interface ChatMessage {
    username: string;
    message: string;
    timestamp: number;
}

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
    private remotePlayers: Map<string, Player> = new Map(); // Other players (key = socket ID)
    private trees: Map<string, Tree> = new Map();           // All trees in the world (key = tree ID)
    private onMessageReceived: (msg: ChatMessage) => void;  // Callback to send messages to React UI
    
    // Woodcutting stats
    private woodcuttingLevel: number = 1;
    private woodcuttingXP: number = 0;
    private logsCollected: number = 0;

    /**
     * Constructor: Initialize game systems
     * @param canvasId - ID of HTML canvas element to render to
     * @param player - Player data from authentication (username, position, etc.)
     * @param token - JWT token for WebSocket authentication
     * @param onMessageReceived - Callback to pass chat messages to React UI
     */
    constructor(canvasId: string, player: any, token: string, onMessageReceived: (msg: ChatMessage) => void) {
        // Get canvas element and initialize Babylon.js WebGL engine
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.engine = new BABYLON.Engine(this.canvas, true);  // true = enable antialiasing
        this.playerData = player;
        this.onMessageReceived = onMessageReceived;
        
        /**
         * Create network handler with callback functions
         * This separates network event handling from game logic
         * Callbacks provided:
         * - updateRemotePlayer: When a player moves
         * - removeRemotePlayer: When a player disconnects
         * - handlePlayersUpdate: Bulk update of all players (initial sync)
         * - getSocketId: Get our socket ID to filter out our own events
         * - handleMessageReceived: When a chat message arrives
         */
        this.networkHandler = new GameNetworkHandler(
            (data) => this.updateRemotePlayer(data),
            (playerId) => this.removeRemotePlayer(playerId),
            (players) => this.handlePlayersUpdate(players),
            () => this.network?.getSocketId() || '',
            (msg) => this.handleMessageReceived(msg),
            (treeData) => this.handleTreeUpdate(treeData),
            (trees) => this.handleTreesUpdate(trees),
            (reward) => this.handleWoodcuttingReward(reward)
        );

        // Initialize network connection with JWT authentication
        this.network = new Network('http://localhost:3000', token, this.networkHandler.getNetworkCallbacks());
        
        // Create the 3D scene (ground, lights, camera, players)
        this.scene = this.createScene();
        
        /**
         * Game loop: Runs every frame (~60 FPS)
         * 1. Update player movement (check keyboard input, send to server)
         * 2. Render the scene
         */
        this.engine.runRenderLoop(() => {
            this.updatePlayerMovement();
            this.scene.render();
        });
        
        // Handle window resize to maintain correct aspect ratio
        window.addEventListener('resize', () => {
            this.engine.resize();
        });

        // Setup click interaction for trees
        this.setupTreeInteraction();
    }

    /**
     * Handle bulk update of all players (called on initial connection)
     * Server sends array of all existing players
     * We create or update each one
     */
    private handlePlayersUpdate(players: PlayerData[]): void {
        players.forEach(playerData => this.updateRemotePlayer(playerData));
    }

    /**
     * Handle incoming chat message from another player
     * 1. Pass to React UI to display in chat box
     * 2. Show floating text above the sender's player mesh
     */
    private handleMessageReceived(data: { playerId: string; username: string; message: string }): void {
        // Send to React UI
        this.onMessageReceived({
            username: data.username,
            message: data.message,
            timestamp: Date.now()
        });

        // Show message above player's head in 3D world
        const player = this.remotePlayers.get(data.playerId);
        if (player) {
            player.showMessage(data.message);
        }
    }

    /**
     * Public method: Send chat message
     * Called from React UI (Game.tsx page component)
     * 1. Send to server (which broadcasts to other players)
     * 2. Show above local player's head
     */
    public sendChatMessage(message: string): void {
        this.network.sendMessage(message);
        // Show message above local player's head
        if (this.localPlayer) {
            this.localPlayer.showMessage(message);
        }
    }

    private updatePlayerMovement(): void {
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

    private updateRemotePlayer(playerData: PlayerData): void {
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

    private removeRemotePlayer(playerId: string): void {
        const remotePlayer = this.remotePlayers.get(playerId);
        if (remotePlayer) {
            console.log('Removing remote player:', playerId);
            remotePlayer.dispose();
            this.remotePlayers.delete(playerId);
            console.log('Remaining remote players:', this.remotePlayers.size);
        } else {
            console.warn('Tried to remove non-existent player:', playerId);
        }
    }
    
    private createScene(): BABYLON.Scene {
        const scene = new BABYLON.Scene(this.engine);
        
        // Camera
        const camera = new BABYLON.ArcRotateCamera(
            'Camera',
            Math.PI / 2,
            Math.PI / 3,
            15,
            BABYLON.Vector3.Zero(),
            scene
        );
        camera.attachControl(this.canvas, true);
        camera.lowerRadiusLimit = 5;
        camera.upperRadiusLimit = 30;
        
        // Light
        new BABYLON.HemisphericLight(
            'light1',
            new BABYLON.Vector3(1, 1, 0),
            scene
        );
        
        // Ground
        const ground = BABYLON.MeshBuilder.CreateGround(
            'ground',
            { width: 50, height: 50 },
            scene
        );
        const groundMaterial = new BABYLON.StandardMaterial('groundMat', scene);
        groundMaterial.diffuseColor = new BABYLON.Color3(0.3, 0.5, 0.3);
        ground.material = groundMaterial;
        
        /**
         * Create trees around the scene
         * Trees are simple cylinders (trunk) with cones (leaves) on top
         * Positioned randomly around the edges of the ground
         */
        this.createTrees(scene);
        
        // Create local player
        const initialPosition = this.playerData.position || { x: 0, y: 0.5, z: 0 };
        const initialRotation = this.playerData.rotation || { x: 0, y: 0, z: 0 };
        
        this.localPlayer = new Player(
            scene,
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
        
        return scene;
    }

    /**
     * Create trees around the scene for decoration and woodcutting
     * Trees are now interactive Tree class instances
     * Positioned around the edges of the 50x50 ground
     */
    private createTrees(scene: BABYLON.Scene): void {
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

            // Create tree with chop callback
            const tree = new Tree(scene, treeData, (treeId) => this.handleTreeChop(treeId));
            this.trees.set(treeId, tree);
        });
    }

    /**
     * Setup click interaction for trees
     * Uses raycasting to detect what was clicked
     */
    private setupTreeInteraction(): void {
        this.scene.onPointerDown = (evt, pickResult) => {
            // Only handle left click
            if (evt.button !== 0) return;

            // Check if we clicked something
            if (pickResult.hit && pickResult.pickedMesh) {
                const metadata = pickResult.pickedMesh.metadata;
                
                // Check if it's a tree
                if (metadata && metadata.type === 'tree') {
                    const treeId = metadata.treeId;
                    const tree = this.trees.get(treeId);
                    
                    if (tree && tree.getIsAlive()) {
                        tree.chop(); // Triggers callback to handleTreeChop
                    }
                }
            }
        };
    }

    /**
     * Handle tree being chopped
     * Send to server which will update health and broadcast
     */
    private handleTreeChop(treeId: string): void {
        console.log('Player chopping tree:', treeId);
        // Send to server
        this.network.sendTreeChop(treeId);
    }

    /**
     * Handle tree state update from server
     * Update local tree instance
     */
    private handleTreeUpdate(treeData: TreeData): void {
        const tree = this.trees.get(treeData.id);
        if (tree) {
            tree.update(treeData);
        }
    }

    /**
     * Handle bulk tree update (on initial connection)
     * Sync all tree states from server
     */
    private handleTreesUpdate(trees: TreeData[]): void {
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
    private handleWoodcuttingReward(data: { logs: number; xp: number; treeId: string }): void {
        this.logsCollected += data.logs;
        this.woodcuttingXP += data.xp;
        
        console.log(`Woodcutting reward: +${data.logs} logs, +${data.xp} XP`);
        console.log(`Total: ${this.logsCollected} logs, ${this.woodcuttingXP} XP`);
        
        // TODO: Show visual feedback or update UI
        // Could show floating text "+1 Log" above player
    }

    public dispose(): void {
        console.log('Disposing game, cleaning up remote players...');
        
        // Clean up local player
        if (this.localPlayer) {
            this.localPlayer.dispose();
            this.localPlayer = null;
        }
        
        // Clean up all remote players
        this.remotePlayers.forEach((player, playerId) => {
            console.log('Cleaning up player:', playerId);
            player.dispose();
        });
        this.remotePlayers.clear();
        
        // Clean up all trees
        this.trees.forEach((tree) => {
            tree.dispose();
        });
        this.trees.clear();
        
        // Disconnect from network
        this.network.disconnect();
        this.engine.dispose();
    }
}

export default Game;