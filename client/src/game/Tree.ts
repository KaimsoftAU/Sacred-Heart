import * as BABYLON from '@babylonjs/core';

/**
 * Interface for tree data synchronized over network
 */
export interface TreeData {
    id: string;                         // Unique tree identifier
    position: { x: number; z: number }; // Position in world (Y is fixed)
    health: number;                     // Current health (0-100)
    maxHealth: number;                  // Maximum health
    isAlive: boolean;                   // Is tree available to chop?
}

/**
 * Tree Class - Represents a chopable tree in the world
 * 
 * Features:
 * - Visual representation (trunk + leaves)
 * - Health system (starts at 100, depletes when chopped)
 * - Health bar above tree
 * - Removal when health reaches 0
 * - Respawn after delay (handled by server)
 * - Click to chop interaction
 */
export class Tree {
    private scene: BABYLON.Scene;
    private id: string;
    private position: { x: number; z: number };
    
    // Tree meshes
    private trunk?: BABYLON.Mesh;
    private leaves?: BABYLON.Mesh;
    private stump?: BABYLON.Mesh;
    
    // Health system
    private health: number;
    private maxHealth: number;
    private isAlive: boolean;
    
    // Health bar visualization
    private healthBarBackground?: BABYLON.Mesh;
    private healthBarForeground?: BABYLON.Mesh;
    
    // Interaction callback
    private onChopCallback?: (treeId: string) => void;

    /**
     * Constructor: Create a new tree
     * @param scene - Babylon.js scene
     * @param treeData - Initial tree state
     * @param onChop - Callback when tree is chopped
     */
    constructor(scene: BABYLON.Scene, treeData: TreeData, onChop?: (treeId: string) => void) {
        this.scene = scene;
        this.id = treeData.id;
        this.position = treeData.position;
        this.health = treeData.health;
        this.maxHealth = treeData.maxHealth;
        this.isAlive = treeData.isAlive;
        this.onChopCallback = onChop;

        if (this.isAlive) {
            this.createTreeMesh();
            this.createHealthBar();
            this.createStump();
        }
    }

    /**
     * Create the visual tree mesh (trunk + leaves)
     */
    private createTreeMesh(): void {
        // Get ground height at tree position using raycast
        const groundY = this.getGroundHeight(this.position.x, this.position.z);
        
        // Create trunk (brown cylinder)
        this.trunk = BABYLON.MeshBuilder.CreateCylinder(
            `tree_trunk_${this.id}`,
            { height: 3, diameter: 0.5 },
            this.scene
        );
        this.trunk.position.x = this.position.x;
        this.trunk.position.y = groundY + 1.5; // Half of height above ground
        this.trunk.position.z = this.position.z;

        const trunkMaterial = new BABYLON.StandardMaterial(`trunkMat_${this.id}`, this.scene);
        trunkMaterial.diffuseColor = new BABYLON.Color3(0.4, 0.25, 0.1); // Brown
        this.trunk.material = trunkMaterial;

        // Enable collision detection on trunk
        this.trunk.checkCollisions = true;

        // Make trunk clickable
        this.trunk.isPickable = true;
        this.trunk.metadata = { type: 'tree', treeId: this.id };

        // Create leaves (green cone)
        this.leaves = BABYLON.MeshBuilder.CreateCylinder(
            `tree_leaves_${this.id}`,
            { height: 2.5, diameterTop: 0, diameterBottom: 2 },
            this.scene
        );
        this.leaves.position.x = this.position.x;
        this.leaves.position.y = groundY + 4.25; // Trunk height + half leaves height
        this.leaves.position.z = this.position.z;

        const leavesMaterial = new BABYLON.StandardMaterial(`leavesMat_${this.id}`, this.scene);
        leavesMaterial.diffuseColor = new BABYLON.Color3(0.1, 0.6, 0.1); // Dark green
        this.leaves.material = leavesMaterial;

        // Make leaves clickable too
        this.leaves.isPickable = true;
        this.leaves.metadata = { type: 'tree', treeId: this.id };
    }

    /**
     * Create a stump that remains after tree is cut
     */
    private createStump(): void {
        const groundY = this.getGroundHeight(this.position.x, this.position.z);
        
        this.stump = BABYLON.MeshBuilder.CreateCylinder(
            `tree_stump_${this.id}`,
            { height: 0.5, diameter: 0.6 },
            this.scene
        );
        this.stump.position.x = this.position.x;
        this.stump.position.y = groundY + 0.25; // Half of stump height
        this.stump.position.z = this.position.z;

        const stumpMaterial = new BABYLON.StandardMaterial(`stumpMat_${this.id}`, this.scene);
        stumpMaterial.diffuseColor = new BABYLON.Color3(0.3, 0.2, 0.1); // Darker brown
        this.stump.material = stumpMaterial;
        
        // Hide stump initially (will show when tree is cut)
        this.stump.isVisible = false;
        this.stump.isPickable = false;
    }

    /**
     * Get ground height at a specific position using raycast
     */
    private getGroundHeight(x: number, z: number): number {
        const rayOrigin = new BABYLON.Vector3(x, 100, z); // Start high above
        const rayDirection = new BABYLON.Vector3(0, -1, 0); // Point down
        const ray = new BABYLON.Ray(rayOrigin, rayDirection, 200);
        
        const hit = this.scene.pickWithRay(ray, (mesh) => {
            return mesh.name === 'ground' || mesh.metadata?.type === 'terrain';
        });

        if (hit && hit.hit && hit.pickedPoint) {
            return hit.pickedPoint.y;
        }
        
        return 0; // Default to ground level if no hit
    }

    /**
     * Create health bar above tree
     * RuneScape style: Green bar that depletes as tree is chopped
     */
    private createHealthBar(): void {
        const groundY = this.getGroundHeight(this.position.x, this.position.z);
        const healthBarY = groundY + 6; // 6 units above ground
        
        // Background (red - shows when health is low)
        this.healthBarBackground = BABYLON.MeshBuilder.CreatePlane(
            `healthBarBg_${this.id}`,
            { width: 1.5, height: 0.2 },
            this.scene
        );
        this.healthBarBackground.position.x = this.position.x;
        this.healthBarBackground.position.y = healthBarY;
        this.healthBarBackground.position.z = this.position.z;
        this.healthBarBackground.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

        const bgMaterial = new BABYLON.StandardMaterial(`healthBgMat_${this.id}`, this.scene);
        bgMaterial.diffuseColor = new BABYLON.Color3(0.8, 0, 0); // Red
        bgMaterial.emissiveColor = new BABYLON.Color3(0.3, 0, 0);
        this.healthBarBackground.material = bgMaterial;

        // Foreground (green - shows current health)
        this.healthBarForeground = BABYLON.MeshBuilder.CreatePlane(
            `healthBarFg_${this.id}`,
            { width: 1.5, height: 0.2 },
            this.scene
        );
        this.healthBarForeground.position.x = this.position.x;
        this.healthBarForeground.position.y = healthBarY;
        this.healthBarForeground.position.z = this.position.z - 0.01; // Slightly in front
        this.healthBarForeground.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

        const fgMaterial = new BABYLON.StandardMaterial(`healthFgMat_${this.id}`, this.scene);
        fgMaterial.diffuseColor = new BABYLON.Color3(0, 0.8, 0); // Green
        fgMaterial.emissiveColor = new BABYLON.Color3(0, 0.3, 0);
        this.healthBarForeground.material = fgMaterial;

        this.updateHealthBar();
    }

    /**
     * Update health bar visual to match current health
     */
    private updateHealthBar(): void {
        if (this.healthBarForeground) {
            const healthPercent = this.health / this.maxHealth;
            // Scale horizontally to show health percentage
            this.healthBarForeground.scaling.x = healthPercent;
            // Offset position so it scales from left to right
            this.healthBarForeground.position.x = this.position.x - (1.5 * (1 - healthPercent) / 2);
        }
    }

    /**
     * Play shake animation when tree is hit
     */
    public shake(): void {
        if (!this.trunk || !this.leaves || !this.isAlive) return;

        const originalTrunkRotation = this.trunk.rotation.clone();
        const originalLeavesRotation = this.leaves.rotation.clone();
        
        const shakeDuration = 400; // milliseconds
        const shakeIntensity = 0.05; // radians (reduced from 0.15)
        const shakeSpeed = 15; // oscillations (reduced from 20)
        
        const startTime = Date.now();
        
        const shakeAnimation = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / shakeDuration;
            
            if (progress >= 1 || !this.trunk || !this.leaves) {
                // Animation complete, restore original rotation
                if (this.trunk) {
                    this.trunk.rotation.x = originalTrunkRotation.x;
                    this.trunk.rotation.z = originalTrunkRotation.z;
                }
                if (this.leaves) {
                    this.leaves.rotation.x = originalLeavesRotation.x;
                    this.leaves.rotation.z = originalLeavesRotation.z;
                }
                return;
            }
            
            // Decay shake over time
            const decay = 1 - progress;
            const shakeX = Math.sin(elapsed / 1000 * shakeSpeed * Math.PI * 2) * shakeIntensity * decay;
            const shakeZ = Math.cos(elapsed / 1000 * shakeSpeed * Math.PI * 2) * shakeIntensity * decay;
            
            this.trunk.rotation.x = originalTrunkRotation.x + shakeX;
            this.trunk.rotation.z = originalTrunkRotation.z + shakeZ;
            this.leaves.rotation.x = originalLeavesRotation.x + shakeX;
            this.leaves.rotation.z = originalLeavesRotation.z + shakeZ;
            
            // Continue animation
            requestAnimationFrame(shakeAnimation);
        };
        
        shakeAnimation();
    }

    /**
     * Handle tree being clicked/chopped
     * Reduces health and notifies callback
     */
    public chop(): void {
        if (!this.isAlive) return;

        // Play shake animation
        this.shake();

        // Call callback to notify game/network
        if (this.onChopCallback) {
            this.onChopCallback(this.id);
        }
    }

    /**
     * Update tree state from network
     * @param treeData - Updated tree data from server
     */
    public update(treeData: TreeData): void {
        this.health = treeData.health;
        const wasAlive = this.isAlive;
        this.isAlive = treeData.isAlive;

        if (!this.isAlive && wasAlive && this.trunk) {
            // Tree just died - play falling animation
            this.playFallingAnimation();
        } else if (this.isAlive && !this.trunk) {
            // Tree respawned, recreate it
            this.createTreeMesh();
            this.createHealthBar();
            if (!this.stump) {
                this.createStump();
            }
            if (this.stump) {
                this.stump.isVisible = false;
            }
        } else if (this.trunk) {
            // Update health bar
            this.updateHealthBar();
        }
    }

    /**
     * Play falling animation when tree is cut down
     */
    private playFallingAnimation(): void {
        if (!this.trunk || !this.leaves) return;

        // Random fall direction
        const fallDirection = Math.random() > 0.5 ? 1 : -1;
        const groundY = this.getGroundHeight(this.position.x, this.position.z);

        // Create pivot point at base of tree for rotation
        const pivot = new BABYLON.TransformNode(`tree_pivot_${this.id}`, this.scene);
        pivot.position.x = this.position.x;
        pivot.position.y = groundY;
        pivot.position.z = this.position.z;

        // Parent trunk and leaves to pivot
        this.trunk.parent = pivot;
        this.leaves.parent = pivot;

        // Adjust positions relative to pivot
        this.trunk.position = new BABYLON.Vector3(0, 1.5, 0);
        this.leaves.position = new BABYLON.Vector3(0, 4.25, 0);

        // Animate rotation
        const frameRate = 60;
        const rotationAnimation = new BABYLON.Animation(
            `treeFall_${this.id}`,
            'rotation.z',
            frameRate,
            BABYLON.Animation.ANIMATIONTYPE_FLOAT,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );

        const keyFrames = [
            { frame: 0, value: 0 },
            { frame: 30, value: Math.PI / 2 * fallDirection }
        ];
        rotationAnimation.setKeys(keyFrames);
        pivot.animations.push(rotationAnimation);

        // Start animation
        this.scene.beginAnimation(pivot, 0, 30, false, 1, () => {
            // After animation, remove tree and show stump
            this.removeTreeMesh();
            if (this.stump) {
                this.stump.isVisible = true;
            }
            pivot.dispose();
        });
    }

    /**
     * Remove tree mesh when cut down
     */
    private removeTreeMesh(): void {
        if (this.trunk) {
            this.trunk.dispose();
            this.trunk = undefined;
        }
        if (this.leaves) {
            this.leaves.dispose();
            this.leaves = undefined;
        }
        if (this.healthBarBackground) {
            this.healthBarBackground.dispose();
            this.healthBarBackground = undefined;
        }
        if (this.healthBarForeground) {
            this.healthBarForeground.dispose();
            this.healthBarForeground = undefined;
        }
    }

    /**
     * Get tree ID
     */
    public getId(): string {
        return this.id;
    }

    /**
     * Get tree position
     */
    public getPosition(): { x: number; z: number } {
        return { ...this.position };
    }

    /**
     * Check if tree is alive
     */
    public getIsAlive(): boolean {
        return this.isAlive;
    }

    /**
     * Cleanup: Dispose all meshes
     */
    public dispose(): void {
        this.removeTreeMesh();
        if (this.stump) {
            this.stump.dispose();
            this.stump = undefined;
        }
    }
}
