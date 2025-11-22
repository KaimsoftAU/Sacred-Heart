import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';

// Interface for player data synchronized over network
export interface PlayerData {
    id: string;         // Socket ID (unique per connection)
    username?: string;  // Display name from authentication
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
}

/**
 * Player Class - Represents a player in the 3D world with Mixamo character
 * 
 * Handles:
 * - Loading Mixamo character model (GreatSword warrior) in T-pose
 * - Keyboard input (for local player only)
 * - Movement logic
 * - Name label above head
 * - Chat message bubbles above head
 * - Position/rotation synchronization
 * 
 * Two types of players:
 * 1. Local player (isLocal=true): Controlled by keyboard
 * 2. Remote players (isLocal=false): Controlled by network updates
 */
export class Player {
    private mesh!: BABYLON.Mesh;                        // Root mesh
    private characterMeshes: BABYLON.AbstractMesh[] = []; // All meshes from loaded character
    private scene: BABYLON.Scene;                       // Reference to Babylon.js scene
    private id: string;                                 // Player's unique ID (socket ID)
    private username?: string;                          // Player's display name
    private label?: BABYLON.Mesh;                       // Name label plane above head
    private keys: { [key: string]: boolean } = {};      // Keyboard state (W,A,S,D pressed?)
    private moveSpeed: number = 0.1;                    // Movement speed per frame
    private rotationSpeed: number = 0.05;               // Rotation speed per frame (radians)
    private isLocal: boolean;                           // Is this the player we control?
    private chatBubble?: BABYLON.Mesh;                  // Chat message plane
    private chatText?: BABYLON.DynamicTexture;          // Texture for chat text
    private chatTimeout?: number;                       // Timer to hide chat bubble
    private health: number = 100;                       // Player health
    private maxHealth: number = 100;                    // Max health
    private isLoaded: boolean = false;                  // Has character finished loading?
    
    // Physics properties
    private velocityY: number = 0;                      // Vertical velocity (for jumping/falling)
    private gravity: number = -0.015;                   // Gravity acceleration
    private jumpStrength: number = 0.35;                // Jump initial velocity
    private isGrounded: boolean = true;                 // Is player on ground?
    private groundLevel: number = 0.5;                  // Ground height (default player spawn height)

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

        // Create temporary placeholder box while character loads
        this.mesh = BABYLON.MeshBuilder.CreateBox(
            `player_${this.id}`,
            { size: 0.5 },
            this.scene
        );
        this.mesh.isVisible = false; // Hide placeholder once character loads
        this.mesh.isPickable = true;
        this.mesh.checkCollisions = true; // Enable collision detection
        this.mesh.ellipsoid = new BABYLON.Vector3(0.5, 1, 0.5); // Collision bounds (width, height, depth)
        this.mesh.metadata = { 
            type: 'player', 
            id: this.id, 
            playerId: this.id 
        };

        // Set initial position and rotation from database or network
        this.setPosition(playerData.position);
        this.setRotation(playerData.rotation);

        // Load Mixamo character asynchronously
        this.loadCharacter();

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
     * Load Mixamo character in T-pose (no animations)
     */
    private async loadCharacter(): Promise<void> {
        try {
            console.log('Loading character from Maria WProp J J Ong.glb...');
            const result = await SceneLoader.ImportMeshAsync(
                '',
                '/GreatSwordPack/',
                'Maria WProp J J Ong.glb',
                this.scene
            );

            // Setup character meshes
            result.meshes.forEach(mesh => {
                mesh.parent = this.mesh;
                mesh.position = BABYLON.Vector3.Zero();
                mesh.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0);
                mesh.scaling = new BABYLON.Vector3(0.01, 0.01, 0.01);
                mesh.isPickable = true;
                mesh.metadata = { type: 'player', id: this.id, playerId: this.id };
            });

            this.characterMeshes = result.meshes;
            
            this.isLoaded = true;
            console.log(`✓ Player ${this.id} character loaded in T-pose`);
        } catch (error) {
            console.error(`Failed to load character for player ${this.id}:`, error);
        }
    }

    public isCharacterLoaded(): boolean {
        return this.isLoaded;
    }

    /**
     * Setup keyboard input listeners
     * Tracks which keys are currently pressed
     * Only called for local player
     * 
     * Keybinds: WASD/Arrows for movement, Space for jump
     */
    private setupKeyboardControls(): void {
        // When key is pressed, mark it as true in keys object
        window.addEventListener('keydown', (evt) => {
            const key = evt.key.toLowerCase();
            this.keys[key] = true;
            
            // Handle jump
            if (key === ' ' && this.isGrounded && !evt.repeat) {
                this.jump();
            }
        });

        // When key is released, mark it as false
        window.addEventListener('keyup', (evt) => {
            this.keys[evt.key.toLowerCase()] = false;
        });
    }

    /**
     * Jump method - applies upward velocity
     */
    private jump(): void {
        if (this.isGrounded) {
            this.velocityY = this.jumpStrength;
            this.isGrounded = false;
        }
    }

    /**
     * Check if player is on the ground by raycasting down
     */
    private checkGroundCollision(): void {
        const rayOrigin = this.mesh.position.clone();
        const rayDirection = new BABYLON.Vector3(0, -1, 0);
        const rayLength = 0.6;
        
        const ray = new BABYLON.Ray(rayOrigin, rayDirection, rayLength);
        const hit = this.scene.pickWithRay(ray, (mesh) => {
            return mesh.name === 'ground' || mesh.metadata?.type === 'terrain';
        });

        if (hit && hit.hit && hit.pickedPoint) {
            const distanceToGround = rayOrigin.y - hit.pickedPoint.y;
            
            if (distanceToGround <= this.groundLevel && this.velocityY <= 0) {
                this.mesh.position.y = hit.pickedPoint.y + this.groundLevel;
                this.velocityY = 0;
                this.isGrounded = true;
            }
        } else {
            this.isGrounded = false;
        }
    }

    /**
     * Check if there's a collision (tree, rock, etc) at the given position
     * Only checks for non-ground objects
     */
    private checkCollisionAtPosition(x: number, z: number): boolean {
        const checkRadius = 0.5; // Player collision radius
        const rayOrigin = new BABYLON.Vector3(x, this.mesh.position.y, z);
        
        // Check in multiple directions around the player
        const directions = [
            new BABYLON.Vector3(1, 0, 0),   // Right
            new BABYLON.Vector3(-1, 0, 0),  // Left
            new BABYLON.Vector3(0, 0, 1),   // Forward
            new BABYLON.Vector3(0, 0, -1),  // Back
        ];

        for (const direction of directions) {
            const ray = new BABYLON.Ray(rayOrigin, direction, checkRadius);
            const hit = this.scene.pickWithRay(ray, (mesh) => {
                // Only check collision with trees and objects, NOT ground
                return mesh.metadata?.type === 'tree' && mesh.checkCollisions;
            });

            if (hit && hit.hit && hit.distance < checkRadius) {
                return true; // Collision detected
            }
        }

        return false; // No collision
    }

    /**
     * Update player movement based on keyboard input
     * Called every frame from game loop
     * 
     * Controls (Tank/Car style):
     * - W/ArrowUp: Move forward in the direction player is facing
     * - S/ArrowDown: Move backward in the direction player is facing
     * - A/ArrowLeft: Rotate left (counter-clockwise)
     * - D/ArrowRight: Rotate right (clockwise)
     * - Space: Jump
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

        // Rotation: A/D keys rotate the player
        if (this.keys['a'] || this.keys['arrowleft']) {
            this.mesh.rotation.y -= this.rotationSpeed;  // Rotate left (counter-clockwise)
            moved = true;
        }
        if (this.keys['d'] || this.keys['arrowright']) {
            this.mesh.rotation.y += this.rotationSpeed;  // Rotate right (clockwise)
            moved = true;
        }

        // Movement: W/S keys move forward/backward in the direction player is facing
        if (this.keys['w'] || this.keys['arrowup']) {
            // Calculate desired position
            const newX = this.mesh.position.x + Math.sin(this.mesh.rotation.y) * this.moveSpeed;
            const newZ = this.mesh.position.z + Math.cos(this.mesh.rotation.y) * this.moveSpeed;
            
            // Check for collision with trees/objects (not ground)
            if (!this.checkCollisionAtPosition(newX, newZ)) {
                this.mesh.position.x = newX;
                this.mesh.position.z = newZ;
            }
            moved = true;
        }
        if (this.keys['s'] || this.keys['arrowdown']) {
            // Calculate desired position
            const newX = this.mesh.position.x - Math.sin(this.mesh.rotation.y) * this.moveSpeed;
            const newZ = this.mesh.position.z - Math.cos(this.mesh.rotation.y) * this.moveSpeed;
            
            // Check for collision with trees/objects (not ground)
            if (!this.checkCollisionAtPosition(newX, newZ)) {
                this.mesh.position.x = newX;
                this.mesh.position.z = newZ;
            }
            moved = true;
        }

        // Apply gravity separately (vertical movement)
        this.velocityY += this.gravity;
        this.mesh.position.y += this.velocityY;
        
        // Check ground collision
        this.checkGroundCollision();
        
        // Prevent falling through ground
        if (this.mesh.position.y < this.groundLevel) {
            this.mesh.position.y = this.groundLevel;
            this.velocityY = 0;
            this.isGrounded = true;
        }

        // Mark as moved if position changed due to physics
        if (this.velocityY !== 0) {
            moved = true;
        }

        // Return clones to avoid reference issues
        return { moved, position: this.mesh.position.clone(), rotation: this.mesh.rotation.clone() };
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
        
        // Dispose character meshes
        this.characterMeshes.forEach(mesh => {
            mesh.dispose();
        });
        this.characterMeshes = [];
        
        this.mesh.getChildMeshes().forEach(child => child.dispose());
        this.mesh.dispose();
    }
}
