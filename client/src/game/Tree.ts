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
        }
    }

    /**
     * Create the visual tree mesh (trunk + leaves)
     */
    private createTreeMesh(): void {
        // Create trunk (brown cylinder)
        this.trunk = BABYLON.MeshBuilder.CreateCylinder(
            `tree_trunk_${this.id}`,
            { height: 3, diameter: 0.5 },
            this.scene
        );
        this.trunk.position.x = this.position.x;
        this.trunk.position.y = 1.5; // Half of height
        this.trunk.position.z = this.position.z;

        const trunkMaterial = new BABYLON.StandardMaterial(`trunkMat_${this.id}`, this.scene);
        trunkMaterial.diffuseColor = new BABYLON.Color3(0.4, 0.25, 0.1); // Brown
        this.trunk.material = trunkMaterial;

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
        this.leaves.position.y = 4.25; // Trunk height + half leaves height
        this.leaves.position.z = this.position.z;

        const leavesMaterial = new BABYLON.StandardMaterial(`leavesMat_${this.id}`, this.scene);
        leavesMaterial.diffuseColor = new BABYLON.Color3(0.1, 0.6, 0.1); // Dark green
        this.leaves.material = leavesMaterial;

        // Make leaves clickable too
        this.leaves.isPickable = true;
        this.leaves.metadata = { type: 'tree', treeId: this.id };
    }

    /**
     * Create health bar above tree
     * RuneScape style: Green bar that depletes as tree is chopped
     */
    private createHealthBar(): void {
        // Background (red - shows when health is low)
        this.healthBarBackground = BABYLON.MeshBuilder.CreatePlane(
            `healthBarBg_${this.id}`,
            { width: 1.5, height: 0.2 },
            this.scene
        );
        this.healthBarBackground.position.x = this.position.x;
        this.healthBarBackground.position.y = 6; // Above tree
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
        this.healthBarForeground.position.y = 6;
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
     * Handle tree being clicked/chopped
     * Reduces health and notifies callback
     */
    public chop(): void {
        if (!this.isAlive) return;

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
        this.isAlive = treeData.isAlive;

        if (!this.isAlive && this.trunk) {
            // Tree was cut down, remove it
            this.removeTreeMesh();
        } else if (this.isAlive && !this.trunk) {
            // Tree respawned, recreate it
            this.createTreeMesh();
            this.createHealthBar();
        } else if (this.trunk) {
            // Update health bar
            this.updateHealthBar();
        }
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
    }
}
