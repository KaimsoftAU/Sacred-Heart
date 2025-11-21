import * as BABYLON from '@babylonjs/core';

// Interface for player data synchronized over network
export interface PlayerData {
    id: string;         // Socket ID (unique per connection)
    username?: string;  // Display name from authentication
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
}

/**
 * Player Class - Represents a player in the 3D world
 * 
 * Handles:
 * - Creating 3D mesh (visual representation)
 * - Keyboard input (for local player only)
 * - Movement logic
 * - Name label above head
 * - Chat message bubbles above head
 * - Position/rotation synchronization
 * 
 * Two types of players:
 * 1. Local player (isLocal=true): Controlled by keyboard, blue color
 * 2. Remote players (isLocal=false): Controlled by network updates, red color
 */
export class Player {
    private mesh: BABYLON.Mesh;                         // 3D cube representing player
    private scene: BABYLON.Scene;                       // Reference to Babylon.js scene
    private id: string;                                 // Player's unique ID (socket ID)
    private username?: string;                          // Player's display name
    private label?: BABYLON.Mesh;                       // Name label plane above head
    private keys: { [key: string]: boolean } = {};      // Keyboard state (W,A,S,D pressed?)
    private moveSpeed: number = 0.1;                    // Movement speed per frame
    private isLocal: boolean;                           // Is this the player we control?
    private chatBubble?: BABYLON.Mesh;                  // Chat message plane
    private chatText?: BABYLON.DynamicTexture;          // Texture for chat text
    private chatTimeout?: number;                       // Timer to hide chat bubble
    private health: number = 100;                       // Player health
    private maxHealth: number = 100;                    // Max health

    /**
     * Constructor: Create a new player in the world
     * @param scene - Babylon.js scene to add player to
     * @param playerData - Initial position, rotation, username
     * @param isLocal - true if this is the player controlled by keyboard
     */
    constructor(scene: BABYLON.Scene, playerData: PlayerData, isLocal: boolean = false) {
        this.scene = scene;
        this.id = playerData.id;
        this.username = playerData.username;
        this.isLocal = isLocal;

        /**
         * Create 3D mesh - a simple cube to represent the player
         * In a real game, this would be a character model
         */
        this.mesh = BABYLON.MeshBuilder.CreateBox(
            `player_${this.id}`,  // Unique name
            { size: 1 },           // 1x1x1 cube
            this.scene
        );

        /**
         * Set mesh color based on player type
         * - Blue = local player (you)
         * - Red = remote players (others)
         */
        const material = new BABYLON.StandardMaterial(`mat_${this.id}`, this.scene);
        material.diffuseColor = isLocal 
            ? new BABYLON.Color3(0, 0, 1)  // Blue for local player
            : new BABYLON.Color3(1, 0, 0); // Red for remote players
        this.mesh.material = material;

        // Make mesh pickable and add metadata for identification
        this.mesh.isPickable = true;
        this.mesh.metadata = { 
            type: 'player', 
            id: this.id, 
            playerId: this.id 
        };

        // Set initial position and rotation from database or network
        this.setPosition(playerData.position);
        this.setRotation(playerData.rotation);

        // Create yellow name label above remote players (not above yourself)
        if (!isLocal && this.username) {
            this.createNameLabel();
        }

        // Setup keyboard input listeners (only for local player)
        if (this.isLocal) {
            this.setupKeyboardControls();
        }
    }

    /**
     * Setup keyboard input listeners
     * Tracks which keys are currently pressed
     * Only called for local player
     */
    private setupKeyboardControls(): void {
        // When key is pressed, mark it as true in keys object
        window.addEventListener('keydown', (evt) => {
            this.keys[evt.key.toLowerCase()] = true;
        });

        // When key is released, mark it as false
        window.addEventListener('keyup', (evt) => {
            this.keys[evt.key.toLowerCase()] = false;
        });
    }

    /**
     * Update player movement based on keyboard input
     * Called every frame from game loop
     * 
     * Controls:
     * - W/ArrowUp: Move forward (increase Z)
     * - S/ArrowDown: Move backward (decrease Z)
     * - A/ArrowLeft: Move left (decrease X)
     * - D/ArrowRight: Move right (increase X)
     * 
     * @returns Object containing:
     *   - moved: Whether player moved this frame (to know if we need to send update)
     *   - position: Current position
     *   - rotation: Current rotation
     */
    public updateMovement(): { moved: boolean; position: BABYLON.Vector3; rotation: BABYLON.Vector3 } {
        // Remote players don't process keyboard input
        if (!this.isLocal) {
            return { moved: false, position: this.mesh.position, rotation: this.mesh.rotation };
        }

        let moved = false;
        const position = this.mesh.position;

        // Check each direction key and update position
        if (this.keys['w'] || this.keys['arrowup']) {
            position.z += this.moveSpeed;  // Forward
            moved = true;
        }
        if (this.keys['s'] || this.keys['arrowdown']) {
            position.z -= this.moveSpeed;  // Backward
            moved = true;
        }
        if (this.keys['a'] || this.keys['arrowleft']) {
            position.x -= this.moveSpeed;  // Left
            moved = true;
        }
        if (this.keys['d'] || this.keys['arrowright']) {
            position.x += this.moveSpeed;  // Right
            moved = true;
        }

        // Return clones to avoid reference issues
        return { moved, position: position.clone(), rotation: this.mesh.rotation.clone() };
    }

    private createNameLabel(): void {
        // Create dynamic texture for name
        const textureSize = 512;
        const textureHeight = 128;
        const nameTexture = new BABYLON.DynamicTexture(
            `nameLabel_${this.id}`,
            { width: textureSize, height: textureHeight },
            this.scene,
            false
        );
        nameTexture.hasAlpha = true;

        // Get context and configure text
        const ctx = nameTexture.getContext();
        ctx.clearRect(0, 0, textureSize, textureHeight);
        
        // Draw name only (no background)
        ctx.font = 'bold 32px Arial';
        ctx.fillStyle = '#FFFF00'; // Yellow for names
        
        // Measure text to center it
        const textMetrics = ctx.measureText(this.username || 'Player');
        const x = (textureSize - textMetrics.width) / 2;
        const y = textureHeight / 2 + 12;
        
        ctx.fillText(this.username || 'Player', x, y);
        
        nameTexture.update();

        // Create label plane
        this.label = BABYLON.MeshBuilder.CreatePlane(
            `label_${this.id}`,
            { width: 2, height: 0.5 },
            this.scene
        );

        // Create material and apply texture
        const labelMaterial = new BABYLON.StandardMaterial(
            `nameLabelMat_${this.id}`,
            this.scene
        );
        labelMaterial.diffuseTexture = nameTexture;
        labelMaterial.opacityTexture = nameTexture;
        labelMaterial.emissiveColor = new BABYLON.Color3(1, 1, 1);
        labelMaterial.backFaceCulling = false;
        labelMaterial.disableLighting = true;
        this.label.material = labelMaterial;

        this.label.parent = this.mesh;
        this.label.position.y = 1.5;
        this.label.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    }

    public setPosition(position: { x: number; y: number; z: number }): void {
        this.mesh.position.x = position.x;
        this.mesh.position.y = position.y;
        this.mesh.position.z = position.z;
    }

    public setRotation(rotation: { x: number; y: number; z: number }): void {
        this.mesh.rotation.x = rotation.x;
        this.mesh.rotation.y = rotation.y;
        this.mesh.rotation.z = rotation.z;
    }

    public getPosition(): BABYLON.Vector3 {
        return this.mesh.position.clone();
    }

    public getRotation(): BABYLON.Vector3 {
        return this.mesh.rotation.clone();
    }

    public getMesh(): BABYLON.Mesh {
        return this.mesh;
    }

    public getUsername(): string | undefined {
        return this.username;
    }

    public getHealth(): number {
        return this.health;
    }

    public getMaxHealth(): number {
        return this.maxHealth;
    }

    public getId(): string {
        return this.id;
    }

    public update(playerData: PlayerData): void {
        this.setPosition(playerData.position);
        this.setRotation(playerData.rotation);
        
        if (playerData.username && playerData.username !== this.username) {
            this.username = playerData.username;
        }
    }

    /**
     * Show chat message above player's head
     * Creates a floating text plane that:
     * - Faces the camera (billboard mode)
     * - Has transparent background
     * - Auto-disappears after 7 seconds
     * 
     * @param message - The text to display
     */
    public showMessage(message: string): void {
        // Clear existing timeout if player sends another message
        if (this.chatTimeout) {
            clearTimeout(this.chatTimeout);
        }

        // Remove previous chat bubble if it exists
        if (this.chatBubble) {
            this.chatBubble.dispose();
        }
        if (this.chatText) {
            this.chatText.dispose();
        }

        /**
         * Create dynamic texture - a canvas we can draw text on
         * This becomes the texture applied to the chat bubble plane
         */
        const textureSize = 512;
        const textureHeight = 128;
        this.chatText = new BABYLON.DynamicTexture(
            `chatText_${this.id}_${Date.now()}`,  // Unique name
            { width: textureSize, height: textureHeight },
            this.scene,
            false  // Don't generate mipmaps (not needed for text)
        );
        this.chatText.hasAlpha = true;  // Enable transparency

        // Get context and configure text
        const ctx = this.chatText.getContext();
        ctx.clearRect(0, 0, textureSize, textureHeight);
        
        // Draw text only (no background)
        ctx.font = 'bold 40px Arial';
        ctx.fillStyle = '#FFFFFF';
        
        // Measure text to center it
        const textMetrics = ctx.measureText(message);
        const x = (textureSize - textMetrics.width) / 2;
        const y = textureHeight / 2 + 15; // Approximate vertical center
        
        ctx.fillText(message, x, y);
        
        this.chatText.update();

        // Create chat bubble plane
        this.chatBubble = BABYLON.MeshBuilder.CreatePlane(
            `chatBubble_${this.id}_${Date.now()}`,
            { width: 3, height: 0.6 },
            this.scene
        );

        // Create material and apply texture
        const bubbleMaterial = new BABYLON.StandardMaterial(
            `chatBubbleMat_${this.id}_${Date.now()}`,
            this.scene
        );
        bubbleMaterial.diffuseTexture = this.chatText;
        bubbleMaterial.opacityTexture = this.chatText;
        bubbleMaterial.emissiveColor = new BABYLON.Color3(1, 1, 1);
        bubbleMaterial.backFaceCulling = false;
        bubbleMaterial.disableLighting = true;
        this.chatBubble.material = bubbleMaterial;

        // Position above player
        this.chatBubble.parent = this.mesh;
        this.chatBubble.position.y = 2.2;
        this.chatBubble.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

        // Auto-hide after 7 seconds
        this.chatTimeout = setTimeout(() => {
            if (this.chatBubble) {
                this.chatBubble.dispose();
                this.chatBubble = undefined;
            }
            if (this.chatText) {
                this.chatText.dispose();
                this.chatText = undefined;
            }
        }, 7000);
    }

    public dispose(): void {
        if (this.chatTimeout) {
            clearTimeout(this.chatTimeout);
        }
        if (this.chatBubble) {
            this.chatBubble.dispose();
        }
        if (this.chatText) {
            this.chatText.dispose();
        }
        if (this.label) {
            this.label.dispose();
        }
        this.mesh.getChildMeshes().forEach(child => child.dispose());
        this.mesh.dispose();
    }
}
