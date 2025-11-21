# Tutorial: Adding Game Features (Complete Idiot-Proof Guide)

This tutorial will walk you through adding new features to Sacred Heart step-by-step. We'll use Mining as our example, and explain **everything** like you've never coded before.

## What You'll Learn
- How the game works (client + server)
- Where every file lives
- How to add a new feature from scratch
- Copy-paste examples that actually work

---

## Part 1: Understanding the Game Structure

### Think of it Like a Restaurant

**SERVER** = The Kitchen
- Keeps track of everything (who's where, what's happening)
- Makes sure nobody cheats
- Tells everyone what's happening

**CLIENT** = The Customer's Table
- Shows you pretty pictures (trees, players, etc.)
- Listens for your clicks and keyboard
- Asks the server "Can I do this?"
- Displays what the server says happened

**NETWORK** = The Waiter
- Takes your order to the kitchen (client → server)
- Brings food back (server → client)

### The File Structure (Where Everything Lives)

```
Sacred-Heart/
│
├── client/                          ← Everything the player SEES
│   └── src/
│       ├── pages/
│       │   └── Game.tsx            ← React page (UI like chat, logout button)
│       │
│       └── game/
│           ├── Game.tsx            ← Main game coordinator (THE BOSS)
│           │
│           ├── handlers/           ← Feature managers (each feature has one)
│           │   ├── WoodcuttingHandler.ts   ← Manages trees + woodcutting
│           │   ├── ChatHandler.ts          ← Manages chat messages
│           │   ├── MovementHandler.ts      ← Manages player movement
│           │   ├── PlayerHandler.ts        ← Manages other players
│           │   └── InteractionHandler.ts   ← Manages clicking things
│           │
│           ├── Tree.ts             ← What a tree IS (the class)
│           ├── Player.ts           ← What a player IS (the class)
│           │
│           └── network/            ← Talks to server
│               ├── Network.ts      ← Main network coordinator
│               └── Woodcutting.ts  ← Woodcutting-specific network events
│
└── server/                          ← The "brain" that controls everything
    ├── server.ts                   ← Starting point (boots everything up)
    │
    └── src/
        ├── game/
        │   ├── GameServer.ts       ← Handles all game connections
        │   │
        │   └── handlers/           ← Feature logic (server side)
        │       └── TreeHandler.ts  ← Controls all trees + woodcutting
        │
        ├── http/
        │   └── app.ts              ← Handles login/logout (not game stuff)
        │
        └── models/
            └── Player.ts           ← Database schema (saves player data)
```

---

## Part 2: How a Feature Works (Step-by-Step Flow)

Let's trace what happens when you click a tree:

### 1. **You Click a Tree** (CLIENT - InteractionHandler.ts)
```typescript
// InteractionHandler detects your click using raycasting
// It checks: "Did you click a tree or a player?"
// If tree → calls WoodcuttingHandler
```

### 2. **Client Asks Permission** (CLIENT - WoodcuttingHandler.ts)
```typescript
public handleTreeChop(treeId: string): void {
    // Send request to server: "Hey, I want to chop tree-1"
    this.network.sendTreeChop(treeId);
}
```

### 3. **Network Sends Message** (CLIENT - network/Woodcutting.ts)
```typescript
public sendTreeChop(treeId: string): void {
    // Socket.IO sends message over the internet
    this.socket.emit('treeChop', { treeId });
}
```

### 4. **Server Receives Request** (SERVER - GameServer.ts)
```typescript
socket.on('treeChop', (data) => {
    // Route to TreeHandler
    treeHandler.handleTreeChop(socket, data.treeId);
});
```

### 5. **Server Processes Action** (SERVER - handlers/TreeHandler.ts)
```typescript
public handleTreeChop(socket: Socket, treeId: string): void {
    // Check if tree exists and is alive
    // Damage the tree (-20 health)
    // Give player rewards (25 XP, 1 log)
    // Tell EVERYONE the tree's new health
    this.io.emit('treeUpdate', treeData);
    // Tell the chopper their reward
    socket.emit('woodcuttingReward', { logs: 1, xp: 25 });
}
```

### 6. **All Clients Get Update** (CLIENT - WoodcuttingHandler.ts)
```typescript
public handleTreeUpdate(treeData: TreeData): void {
    // Update the tree's visual health bar
    const tree = this.trees.get(treeData.id);
    tree.update(treeData);
}
```

**That's it!** Every feature follows this pattern:
```
Click → Handler → Network → Server → Handler → Network → All Clients Update
```

---

## Part 3: Adding a New Feature (Mining Rocks)

We're going to add a Mining feature where players can click rocks to mine them.

### What We're Building:
- 10 rocks around the map
- Click a rock to mine it
- Each hit = 15 damage
- Rocks have 120 health
- Dead rocks respawn after 45 seconds
- You get ore + XP for mining

---

### STEP 1: Create the Rock Class (CLIENT)

**Location:** `client/src/game/Rock.ts`

**What this file does:** Defines what a rock IS (its health, position, appearance)

**Create this new file:**

```typescript
import * as BABYLON from '@babylonjs/core';

// This interface defines the data structure for a rock
export interface RockData {
    id: string;                           // Unique ID like "rock-1"
    position: { x: number; z: number };   // Where it sits on the map
    health: number;                        // Current health (0-120)
    maxHealth: number;                     // Max health (120)
    isAlive: boolean;                      // true = visible, false = respawning
}

/**
 * Rock Class - Represents a mineable rock in the 3D world
 * 
 * This class:
 * - Creates the 3D mesh (sphere)
 * - Shows a health bar above it
 * - Updates when damaged
 * - Hides when depleted
 */
export class Rock {
    private scene: BABYLON.Scene;
    private id: string;
    private position: { x: number; z: number };
    
    // Visual elements
    private mesh?: BABYLON.Mesh;                   // The rock sphere
    private healthBarBackground?: BABYLON.Mesh;    // Red bar (background)
    private healthBarForeground?: BABYLON.Mesh;    // Green bar (foreground)
    
    // State
    private health: number;
    private maxHealth: number;
    private isAlive: boolean;

    constructor(scene: BABYLON.Scene, rockData: RockData) {
        this.scene = scene;
        this.id = rockData.id;
        this.position = rockData.position;
        this.health = rockData.health;
        this.maxHealth = rockData.maxHealth;
        this.isAlive = rockData.isAlive;
        
        // Create the visual elements
        this.createRockMesh();
        this.createHealthBar();
    }

    /**
     * Create the 3D rock mesh (a gray sphere)
     */
    private createRockMesh(): void {
        // Create a sphere to represent the rock
        this.mesh = BABYLON.MeshBuilder.CreateSphere(`rock-${this.id}`, {
            diameter: 2  // 2 units wide
        }, this.scene);
        
        // Position it on the map
        this.mesh.position = new BABYLON.Vector3(
            this.position.x,
            1,  // 1 unit above ground
            this.position.z
        );
        
        // Make it gray
        const material = new BABYLON.StandardMaterial(`rock-mat-${this.id}`, this.scene);
        material.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
        this.mesh.material = material;
        
        // Make it clickable
        this.mesh.isPickable = true;
        
        // Add metadata so InteractionHandler knows this is a rock
        this.mesh.metadata = { type: 'rock', rockId: this.id };
    }

    /**
     * Create health bar above the rock
     */
    private createHealthBar(): void {
        // Background bar (red)
        this.healthBarBackground = BABYLON.MeshBuilder.CreatePlane(`rock-hpbg-${this.id}`, {
            width: 1,
            height: 0.1
        }, this.scene);
        
        const bgMaterial = new BABYLON.StandardMaterial(`rock-hpbg-mat-${this.id}`, this.scene);
        bgMaterial.diffuseColor = new BABYLON.Color3(1, 0, 0);  // Red
        bgMaterial.emissiveColor = new BABYLON.Color3(0.5, 0, 0);
        this.healthBarBackground.material = bgMaterial;
        this.healthBarBackground.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;  // Always face camera
        this.healthBarBackground.position = new BABYLON.Vector3(
            this.position.x,
            2.5,  // Above the rock
            this.position.z
        );
        
        // Foreground bar (green)
        this.healthBarForeground = BABYLON.MeshBuilder.CreatePlane(`rock-hpfg-${this.id}`, {
            width: 1,
            height: 0.1
        }, this.scene);
        
        const fgMaterial = new BABYLON.StandardMaterial(`rock-hpfg-mat-${this.id}`, this.scene);
        fgMaterial.diffuseColor = new BABYLON.Color3(0, 1, 0);  // Green
        fgMaterial.emissiveColor = new BABYLON.Color3(0, 0.5, 0);
        this.healthBarForeground.material = fgMaterial;
        this.healthBarForeground.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
        this.healthBarForeground.position = new BABYLON.Vector3(
            this.position.x,
            2.51,  // Slightly in front of red bar
            this.position.z
        );
    }

    /**
     * Update the rock's state (called when server sends update)
     */
    public update(rockData: RockData): void {
        this.health = rockData.health;
        this.isAlive = rockData.isAlive;
        
        // Update health bar width based on health percentage
        if (this.healthBarForeground) {
            const healthPercent = this.health / this.maxHealth;  // 0.0 to 1.0
            this.healthBarForeground.scaling.x = healthPercent;
            // Shift left as health decreases (so it shrinks from right side)
            this.healthBarForeground.position.x = 
                this.position.x - (1 - healthPercent) / 2;
        }
        
        // Hide rock and health bars when dead (respawning)
        if (this.mesh) {
            this.mesh.setEnabled(this.isAlive);
        }
        if (this.healthBarBackground) {
            this.healthBarBackground.setEnabled(this.isAlive);
        }
        if (this.healthBarForeground) {
            this.healthBarForeground.setEnabled(this.isAlive);
        }
    }

    /**
     * Get the rock's mesh (for raycasting/clicking)
     */
    public getMesh(): BABYLON.Mesh | undefined {
        return this.mesh;
    }

    /**
     * Get the rock's ID
     */
    public getId(): string {
        return this.id;
    }

    /**
     * Clean up when removing rock
     */
    public dispose(): void {
        this.mesh?.dispose();
        this.healthBarBackground?.dispose();
        this.healthBarForeground?.dispose();
    }
}
```

---

### STEP 2: Create Mining Network Module (CLIENT)

**Location:** `client/src/game/network/Mining.ts`

**What this file does:** Sends mining actions to server and receives updates

**Create this new file:**

```typescript
import type { Socket } from 'socket.io-client';
import type { RockData } from '../Rock';

/**
 * MiningNetwork - Handles all mining-related network events
 * 
 * This module:
 * - Sends mining actions to server
 * - Listens for rock updates from server
 * - Listens for mining rewards
 */
export class MiningNetwork {
    private socket: Socket;

    constructor(socket: Socket) {
        this.socket = socket;
    }

    /**
     * Tell server we want to mine a rock
     */
    public sendRockMine(rockId: string): void {
        console.log(`[MiningNetwork] Sending mine request for ${rockId}`);
        this.socket.emit('rockMine', { rockId });
    }

    /**
     * Listen for single rock updates (when someone mines)
     */
    public onRockUpdate(callback: (rockData: RockData) => void): void {
        this.socket.on('rockUpdate', callback);
    }

    /**
     * Listen for bulk rock updates (when first connecting)
     */
    public onRocksUpdate(callback: (rocks: RockData[]) => void): void {
        this.socket.on('rocksUpdate', callback);
    }

    /**
     * Listen for mining rewards (ore + XP)
     */
    public onMiningReward(callback: (data: { ore: number; xp: number; rockId: string }) => void): void {
        this.socket.on('miningReward', callback);
    }

    /**
     * Clean up listeners when game closes
     */
    public cleanup(): void {
        this.socket.off('rockUpdate');
        this.socket.off('rocksUpdate');
        this.socket.off('miningReward');
    }
}
```

---

### STEP 3: Create Mining Handler (CLIENT)

**Location:** `client/src/game/handlers/MiningHandler.ts`

**What this file does:** Manages all rocks on the client, handles mining logic

**Create this new file:**

```typescript
import * as BABYLON from '@babylonjs/core';
import { Rock, type RockData } from '../Rock';
import type { Network } from '../network/Network';

/**
 * MiningHandler - Client-side mining system manager
 * 
 * Responsibilities:
 * - Create all rocks in the scene
 * - Handle rock mining (send to server)
 * - Update rocks when server broadcasts changes
 * - Track mining stats (level, XP, ore collected)
 * - Clean up rocks on dispose
 */
export class MiningHandler {
    private scene: BABYLON.Scene;
    private network: Network;
    private rocks: Map<string, Rock> = new Map();
    
    // Mining stats
    private miningLevel: number = 1;
    private miningXP: number = 0;
    private oreCollected: number = 0;

    constructor(scene: BABYLON.Scene, network: Network) {
        this.scene = scene;
        this.network = network;
        
        // Create rocks when handler is initialized
        this.createRocks();
        
        console.log(`[MiningHandler] Initialized with ${this.rocks.size} rocks`);
    }

    /**
     * Create all rocks in the scene at fixed positions
     */
    private createRocks(): void {
        // Define 10 rock positions around the map
        const rockPositions = [
            { x: 8, z: 8 },     // Northeast
            { x: -8, z: 8 },    // Northwest
            { x: 8, z: -8 },    // Southeast
            { x: -8, z: -8 },   // Southwest
            { x: 12, z: 0 },    // East
            { x: -12, z: 0 },   // West
            { x: 0, z: 12 },    // North
            { x: 0, z: -12 },   // South
            { x: 5, z: 5 },     // Near center 1
            { x: -5, z: -5 },   // Near center 2
        ];

        // Create a Rock instance for each position
        rockPositions.forEach((pos, index) => {
            const rockId = `rock-${index + 1}`;
            const rockData: RockData = {
                id: rockId,
                position: pos,
                health: 120,      // Full health
                maxHealth: 120,
                isAlive: true     // Visible
            };
            
            const rock = new Rock(this.scene, rockData);
            this.rocks.set(rockId, rock);
        });

        console.log(`[MiningHandler] Created ${this.rocks.size} rocks`);
    }

    /**
     * Handle rock mine (when player clicks a rock)
     * Sends request to server
     */
    public handleRockMine(rockId: string): void {
        const rock = this.rocks.get(rockId);
        if (!rock) {
            console.error(`[MiningHandler] Rock ${rockId} not found`);
            return;
        }

        console.log(`[MiningHandler] Mining rock ${rockId}`);
        
        // Send to server via network
        this.network.sendRockMine(rockId);
    }

    /**
     * Handle rock update from server (someone mined it)
     */
    public handleRockUpdate(rockData: RockData): void {
        const rock = this.rocks.get(rockData.id);
        if (rock) {
            rock.update(rockData);
            console.log(`[MiningHandler] Updated rock ${rockData.id}: ${rockData.health}/${rockData.maxHealth} HP`);
        }
    }

    /**
     * Handle bulk rock updates (initial sync when connecting)
     */
    public handleRocksUpdate(rocks: RockData[]): void {
        console.log(`[MiningHandler] Received ${rocks.length} rock updates`);
        rocks.forEach(rockData => {
            this.handleRockUpdate(rockData);
        });
    }

    /**
     * Handle mining reward from server
     */
    public handleMiningReward(data: { ore: number; xp: number; rockId: string }): void {
        this.oreCollected += data.ore;
        this.miningXP += data.xp;
        
        console.log(`[MiningHandler] Mining reward: +${data.ore} ore, +${data.xp} XP (Total: ${this.oreCollected} ore, ${this.miningXP} XP)`);
        
        // TODO: Update UI to show stats
    }

    /**
     * Get the rocks Map (for InteractionHandler)
     */
    public getRocks(): Map<string, Rock> {
        return this.rocks;
    }

    /**
     * Get mining stats (for UI display)
     */
    public getStats() {
        return {
            level: this.miningLevel,
            xp: this.miningXP,
            ore: this.oreCollected
        };
    }

    /**
     * Clean up all rocks when game closes
     */
    public dispose(): void {
        this.rocks.forEach(rock => rock.dispose());
        this.rocks.clear();
        console.log('[MiningHandler] Disposed');
    }
}
```

---

### STEP 4: Update Network.ts to Include Mining (CLIENT)

**Location:** `client/src/game/network/Network.ts`

**What to do:** Add Mining to the main Network class

#### 4.1: Add Import

**Find this part** (around line 6):
```typescript
import { WoodcuttingNetwork } from './Woodcutting';
```

**Add below it:**
```typescript
import { MiningNetwork } from './Mining';
```

#### 4.2: Add Property

**Find this part** (around line 47):
```typescript
    private woodcutting: WoodcuttingNetwork;
```

**Add below it:**
```typescript
    private mining: MiningNetwork;
```

#### 4.3: Add to NetworkCallbacks Interface

**Find this interface** (around line 14):
```typescript
export interface NetworkCallbacks {
    onConnect?: () => void;
    onDisconnect?: () => void;
    onWelcome?: (data: any) => void;
    onPlayerJoined?: (data: any) => void;
    onPlayerLeft?: (data: { playerId: string; totalPlayers: number }) => void;
    onPlayerMove?: (data: PlayerData) => void;
    onPlayersUpdate?: (players: PlayerData[]) => void;
    onPlayerMessage?: (data: any) => void;
    onConnectionError?: (error: Error) => void;
    onTreeUpdate?: (treeData: TreeData) => void;
    onTreesUpdate?: (trees: TreeData[]) => void;
    onWoodcuttingReward?: (data: { logs: number; xp: number; treeId: string }) => void;
}
```

**Add these lines at the end** (before the closing `}`):
```typescript
    onRockUpdate?: (rockData: any) => void;
    onRocksUpdate?: (rocks: any[]) => void;
    onMiningReward?: (data: { ore: number; xp: number; rockId: string }) => void;
```

#### 4.4: Initialize in Constructor

**Find the end of the constructor** (around line 95):
```typescript
        if (callbacks.onWoodcuttingReward) {
            this.woodcutting.onWoodcuttingReward(callbacks.onWoodcuttingReward);
        }
    }
```

**Add before the closing `}`:**
```typescript
        // Initialize mining network
        this.mining = new MiningNetwork(this.socket);
        if (callbacks.onRockUpdate) {
            this.mining.onRockUpdate(callbacks.onRockUpdate);
        }
        if (callbacks.onRocksUpdate) {
            this.mining.onRocksUpdate(callbacks.onRocksUpdate);
        }
        if (callbacks.onMiningReward) {
            this.mining.onMiningReward(callbacks.onMiningReward);
        }
```

#### 4.5: Add Public Method

**Find this part** (around line 110):
```typescript
    public sendTreeChop(treeId: string): void {
        this.woodcutting.sendTreeChop(treeId);
    }
```

**Add below it:**
```typescript
    public sendRockMine(rockId: string): void {
        this.mining.sendRockMine(rockId);
    }
```

---

### STEP 5: Update InteractionHandler (CLIENT)

**Location:** `client/src/game/handlers/InteractionHandler.ts`

#### 5.1: Add Import

**Find the imports** (around line 1):
```typescript
import * as BABYLON from '@babylonjs/core';
import type { Tree } from '../Tree';
import type { PlayerHandler } from './PlayerHandler';
```

**Add:**
```typescript
import type { Rock } from '../Rock';
```

#### 5.2: Update Constructor Parameters

**Find:**
```typescript
    constructor(
        scene: BABYLON.Scene,
        trees: Map<string, Tree>,
        playerHandler: PlayerHandler,
        onTreeChop: (treeId: string) => void,
        onPlayerSelected?: (...) => void
    ) {
```

**Replace with:**
```typescript
    constructor(
        scene: BABYLON.Scene,
        trees: Map<string, Tree>,
        rocks: Map<string, Rock>,
        playerHandler: PlayerHandler,
        onTreeChop: (treeId: string) => void,
        onRockMine: (rockId: string) => void,
        onPlayerSelected?: (playerData: { name: string; health: number; maxHealth: number; mesh: BABYLON.Mesh | null } | null) => void
    ) {
```

#### 5.3: Add Properties

**Find:**
```typescript
    private scene: BABYLON.Scene;
    private trees: Map<string, Tree>;
    private playerHandler: PlayerHandler;
    private onTreeChop: (treeId: string) => void;
    private onPlayerSelected?: (...) => void;
```

**Replace with:**
```typescript
    private scene: BABYLON.Scene;
    private trees: Map<string, Tree>;
    private rocks: Map<string, Rock>;
    private playerHandler: PlayerHandler;
    private onTreeChop: (treeId: string) => void;
    private onRockMine: (rockId: string) => void;
    private onPlayerSelected?: (playerData: { name: string; health: number; maxHealth: number; mesh: BABYLON.Mesh | null } | null) => void;
```

#### 5.4: Update Constructor Body

**Find:**
```typescript
        this.scene = scene;
        this.trees = trees;
        this.playerHandler = playerHandler;
        this.onTreeChop = onTreeChop;
        this.onPlayerSelected = onPlayerSelected;
```

**Replace with:**
```typescript
        this.scene = scene;
        this.trees = trees;
        this.rocks = rocks;
        this.playerHandler = playerHandler;
        this.onTreeChop = onTreeChop;
        this.onRockMine = onRockMine;
        this.onPlayerSelected = onPlayerSelected;
```

#### 5.5: Add Rock Click Detection

**Find in setupPointerInteraction** (around line 60):
```typescript
            // Check if we clicked a tree
            if (pickedMesh.metadata?.type === 'tree') {
                const treeId = pickedMesh.metadata.treeId;
                if (treeId) {
                    this.handleTreeClick(treeId);
                }
                return;
            }
```

**Add below it:**
```typescript
            // Check if we clicked a rock
            if (pickedMesh.metadata?.type === 'rock') {
                const rockId = pickedMesh.metadata.rockId;
                if (rockId) {
                    this.handleRockClick(rockId);
                }
                return;
            }
```

#### 5.6: Add Rock Click Handler

**Find handleTreeClick method** (around line 85):
```typescript
    private handleTreeClick(treeId: string): void {
        console.log(`[InteractionHandler] Clicked tree: ${treeId}`);
        this.onTreeChop(treeId);
    }
```

**Add below it:**
```typescript
    private handleRockClick(rockId: string): void {
        console.log(`[InteractionHandler] Clicked rock: ${rockId}`);
        this.onRockMine(rockId);
    }
```

---

### STEP 6: Update GameNetworkHandler (CLIENT)

**Location:** `client/src/game/handlers/GameNetworkHandler.ts`

#### 6.1: Update Constructor

**Find:**
```typescript
    constructor(
        onPlayerMove: (data: PlayerData) => void,
        onPlayerDisconnect: (playerId: string) => void,
        onPlayersUpdate: (players: PlayerData[]) => void,
        getSocketId: () => string,
        onMessageReceived: (data: { playerId: string; username: string; message: string }) => void,
        onTreeUpdate: (treeData: TreeData) => void,
        onTreesUpdate: (trees: TreeData[]) => void,
        onWoodcuttingReward: (data: { logs: number; xp: number; treeId: string }) => void
    ) {
```

**Replace with:**
```typescript
    constructor(
        onPlayerMove: (data: PlayerData) => void,
        onPlayerDisconnect: (playerId: string) => void,
        onPlayersUpdate: (players: PlayerData[]) => void,
        getSocketId: () => string,
        onMessageReceived: (data: { playerId: string; username: string; message: string }) => void,
        onTreeUpdate: (treeData: TreeData) => void,
        onTreesUpdate: (trees: TreeData[]) => void,
        onWoodcuttingReward: (data: { logs: number; xp: number; treeId: string }) => void,
        onRockUpdate: (rockData: any) => void,
        onRocksUpdate: (rocks: any[]) => void,
        onMiningReward: (data: { ore: number; xp: number; rockId: string }) => void
    ) {
```

#### 6.2: Update Callbacks Object

**Find the end of the callbacks object** (around line 42):
```typescript
            onTreeUpdate: (treeData: TreeData) => onTreeUpdate(treeData),
            onTreesUpdate: (trees: TreeData[]) => onTreesUpdate(trees),
            onWoodcuttingReward: (data: { logs: number; xp: number; treeId: string }) => onWoodcuttingReward(data)
        };
```

**Add before the closing `};`:**
```typescript
            onRockUpdate: (rockData: any) => onRockUpdate(rockData),
            onRocksUpdate: (rocks: any[]) => onRocksUpdate(rocks),
            onMiningReward: (data: { ore: number; xp: number; rockId: string }) => onMiningReward(data)
```

---

### STEP 7: Update Game.tsx (CLIENT)

**Location:** `client/src/game/Game.tsx`

#### 7.1: Add Import

**Find:**
```typescript
import { WoodcuttingHandler } from './handlers/WoodcuttingHandler';
```

**Add below it:**
```typescript
import { MiningHandler } from './handlers/MiningHandler';
```

#### 7.2: Add Property

**Find the handlers section** (around line 38):
```typescript
    private woodcuttingHandler!: WoodcuttingHandler;
    private playerHandler!: PlayerHandler;
    private interactionHandler!: InteractionHandler;
    private chatHandler!: ChatHandler;
    private movementHandler!: MovementHandler;
```

**Add:**
```typescript
    private miningHandler!: MiningHandler;
```

#### 7.3: Update GameNetworkHandler Creation

**Find:**
```typescript
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
```

**Replace with:**
```typescript
        this.networkHandler = new GameNetworkHandler(
            (data) => this.playerHandler.updateRemotePlayer(data),
            (playerId) => this.playerHandler.removeRemotePlayer(playerId),
            (players) => this.playerHandler.handlePlayersUpdate(players),
            () => this.network?.getSocketId() || '',
            (msg) => this.chatHandler?.handleMessageReceived(msg),
            (treeData) => this.woodcuttingHandler?.handleTreeUpdate(treeData),
            (trees) => this.woodcuttingHandler?.handleTreesUpdate(trees),
            (reward) => this.woodcuttingHandler?.handleWoodcuttingReward(reward),
            (rockData) => this.miningHandler?.handleRockUpdate(rockData),
            (rocks) => this.miningHandler?.handleRocksUpdate(rocks),
            (reward) => this.miningHandler?.handleMiningReward(reward)
        );
```

#### 7.4: Initialize MiningHandler

**Find:**
```typescript
        // Initialize woodcutting handler (creates trees and needs network)
        this.woodcuttingHandler = new WoodcuttingHandler(this.scene, this.network);
```

**Add below it:**
```typescript
        // Initialize mining handler (creates rocks and needs network)
        this.miningHandler = new MiningHandler(this.scene, this.network);
```

#### 7.5: Update InteractionHandler Creation

**Find:**
```typescript
        this.interactionHandler = new InteractionHandler(
            this.scene,
            this.woodcuttingHandler.getTrees(),
            this.playerHandler,
            (treeId) => this.woodcuttingHandler.handleTreeChop(treeId),
            this.onPlayerSelected
        );
```

**Replace with:**
```typescript
        this.interactionHandler = new InteractionHandler(
            this.scene,
            this.woodcuttingHandler.getTrees(),
            this.miningHandler.getRocks(),
            this.playerHandler,
            (treeId) => this.woodcuttingHandler.handleTreeChop(treeId),
            (rockId) => this.miningHandler.handleRockMine(rockId),
            this.onPlayerSelected
        );
```

#### 7.6: Add to Dispose

**Find:**
```typescript
        // Clean up handlers (which clean up remote players and trees)
        this.playerHandler.dispose();
        this.woodcuttingHandler.dispose();
```

**Add:**
```typescript
        this.miningHandler.dispose();
```

---

### STEP 8: Create RockHandler (SERVER)

**Location:** `server/src/game/handlers/RockHandler.ts`

**What this file does:** Server-side logic for all rocks

**Create this new file:**

```typescript
import type { Server, Socket } from 'socket.io';

// Rock state interface
interface RockState {
    id: string;
    position: { x: number; z: number };
    health: number;
    maxHealth: number;
    isAlive: boolean;
    respawnTimer?: NodeJS.Timeout;
}

/**
 * RockHandler - Server-side mining system
 * 
 * Responsibilities:
 * - Manage all rock states
 * - Handle mining damage
 * - Give rewards (ore + XP)
 * - Respawn rocks after 45 seconds
 * - Broadcast rock updates to all clients
 */
export class RockHandler {
    private io: Server;
    private rocks: Map<string, RockState> = new Map();
    
    // Constants
    private readonly MINE_DAMAGE = 15;        // Damage per hit
    private readonly ROCK_MAX_HEALTH = 120;   // Total health
    private readonly RESPAWN_TIME = 45000;    // 45 seconds
    private readonly ORE_REWARD = 1;          // Ore per mine
    private readonly XP_REWARD = 30;          // XP per mine

    constructor(io: Server) {
        this.io = io;
        this.initializeRocks();
    }

    /**
     * Create all rocks
     * MUST MATCH CLIENT POSITIONS!
     */
    private initializeRocks(): void {
        const rockPositions = [
            { x: 8, z: 8 },
            { x: -8, z: 8 },
            { x: 8, z: -8 },
            { x: -8, z: -8 },
            { x: 12, z: 0 },
            { x: -12, z: 0 },
            { x: 0, z: 12 },
            { x: 0, z: -12 },
            { x: 5, z: 5 },
            { x: -5, z: -5 },
        ];

        rockPositions.forEach((pos, index) => {
            const rockId = `rock-${index + 1}`;
            this.rocks.set(rockId, {
                id: rockId,
                position: pos,
                health: this.ROCK_MAX_HEALTH,
                maxHealth: this.ROCK_MAX_HEALTH,
                isAlive: true
            });
        });

        console.log(`[RockHandler] Initialized ${this.rocks.size} rocks`);
    }

    /**
     * Handle player mining a rock
     */
    public handleRockMine(socket: Socket, rockId: string): void {
        const rock = this.rocks.get(rockId);
        
        if (!rock) {
            console.error(`[RockHandler] Rock ${rockId} not found`);
            return;
        }

        if (!rock.isAlive) {
            console.log(`[RockHandler] Rock ${rockId} is depleted`);
            return;
        }

        // Apply damage
        rock.health -= this.MINE_DAMAGE;
        console.log(`[RockHandler] Rock ${rockId} mined: ${rock.health}/${rock.maxHealth} HP`);

        // Check if depleted
        if (rock.health <= 0) {
            rock.health = 0;
            rock.isAlive = false;
            console.log(`[RockHandler] Rock ${rockId} depleted, respawning in 45s`);
            this.scheduleRockRespawn(rockId);
        }

        // Give rewards
        socket.emit('miningReward', {
            ore: this.ORE_REWARD,
            xp: this.XP_REWARD,
            rockId: rockId
        });

        // Broadcast update to ALL clients
        this.broadcastRockUpdate(rock);
    }

    /**
     * Schedule rock respawn
     */
    private scheduleRockRespawn(rockId: string): void {
        const rock = this.rocks.get(rockId);
        if (!rock) return;

        if (rock.respawnTimer) {
            clearTimeout(rock.respawnTimer);
        }

        rock.respawnTimer = setTimeout(() => {
            rock.health = rock.maxHealth;
            rock.isAlive = true;
            console.log(`[RockHandler] Rock ${rockId} respawned`);
            this.broadcastRockUpdate(rock);
        }, this.RESPAWN_TIME);
    }

    /**
     * Broadcast to all clients
     */
    private broadcastRockUpdate(rock: RockState): void {
        this.io.emit('rockUpdate', {
            id: rock.id,
            position: rock.position,
            health: rock.health,
            maxHealth: rock.maxHealth,
            isAlive: rock.isAlive
        });
    }

    /**
     * Get all rocks (for new player)
     */
    public getAllRocks(): any[] {
        return Array.from(this.rocks.values()).map(rock => ({
            id: rock.id,
            position: rock.position,
            health: rock.health,
            maxHealth: rock.maxHealth,
            isAlive: rock.isAlive
        }));
    }

    /**
     * Cleanup timers
     */
    public cleanup(): void {
        this.rocks.forEach(rock => {
            if (rock.respawnTimer) {
                clearTimeout(rock.respawnTimer);
            }
        });
        console.log('[RockHandler] Cleanup complete');
    }
}
```

---

### STEP 9: Update GameServer.ts (SERVER)

**Location:** `server/src/game/GameServer.ts`

#### 9.1: Add Import

**Find:**
```typescript
import { TreeHandler } from './handlers/TreeHandler.js';
```

**Add below it:**
```typescript
import { RockHandler } from './handlers/RockHandler.js';
```

#### 9.2: Add Property

**Find:**
```typescript
    private treeHandler: TreeHandler;
```

**Add below it:**
```typescript
    private rockHandler: RockHandler;
```

#### 9.3: Initialize in Constructor

**Find:**
```typescript
        this.treeHandler = new TreeHandler(this.io);
```

**Add below it:**
```typescript
        this.rockHandler = new RockHandler(this.io);
```

#### 9.4: Send Rocks to New Players

**Find** (in the connection handler):
```typescript
            // Send all trees to the new player
            socket.emit('treesUpdate', this.treeHandler.getAllTrees());
```

**Add below it:**
```typescript
            // Send all rocks to the new player
            socket.emit('rocksUpdate', this.rockHandler.getAllRocks());
```

#### 9.5: Add Rock Mine Event Handler

**Find:**
```typescript
            socket.on('treeChop', (data) => {
                this.treeHandler.handleTreeChop(socket, data.treeId);
            });
```

**Add below it:**
```typescript
            // Handle rock mining
            socket.on('rockMine', (data) => {
                this.rockHandler.handleRockMine(socket, data.rockId);
            });
```

#### 9.6: Update Cleanup

**Find:**
```typescript
    public cleanup(): void {
        this.treeHandler.cleanup();
    }
```

**Replace with:**
```typescript
    public cleanup(): void {
        this.treeHandler.cleanup();
        this.rockHandler.cleanup();
    }
```

---

## Part 4: Testing Your Feature

### 1. **Start the Server**
```bash
cd server
npm run dev
```

Wait for: `[RockHandler] Initialized 10 rocks`

### 2. **Start the Client**
```bash
cd client
npm run dev
```

### 3. **Test in Browser**

1. Open http://localhost:5173
2. Login
3. **Look for gray spheres** around the map
4. **Click a rock** - you should see:
   - Console: `[MiningHandler] Mining rock rock-1`
   - Health bar decreases
   - Console: `[MiningHandler] Mining reward: +1 ore, +30 XP`
5. **Keep clicking** until rock disappears (0 health)
6. **Wait 45 seconds** - rock should reappear

### 4. **Test Multiplayer**

1. Open **second browser tab** (incognito)
2. Login with different account
3. **Mine a rock in Tab 1**
4. **Watch it update in Tab 2** instantly!

---

## Part 5: Troubleshooting

### ❌ Problem: "Rock doesn't show up"

**Checklist:**
- [ ] Did you create `Rock.ts`?
- [ ] Did you create `MiningHandler.ts`?
- [ ] Did you import MiningHandler in Game.tsx?
- [ ] Did you initialize miningHandler?
- [ ] Open browser console (F12) - any errors?

**Solution:** Check console for errors. Verify createRocks() is called.

---

### ❌ Problem: "Clicking does nothing"

**Checklist:**
- [ ] Did you update InteractionHandler?
- [ ] Did you add rock click detection?
- [ ] Did you add handleRockClick method?
- [ ] Is `mesh.metadata = { type: 'rock', rockId: ... }` set?
- [ ] Is `mesh.isPickable = true`?

**Solution:** Add `console.log` in handleRockClick to see if it's called.

---

### ❌ Problem: "Health bar doesn't update"

**Checklist:**
- [ ] Is server broadcasting 'rockUpdate' event?
- [ ] Is client listening for 'rockUpdate'?
- [ ] Are rock IDs matching (client vs server)?
- [ ] Open Network tab in DevTools - see Socket.IO events?

**Solution:** 
1. Press F12 → Network tab → WS (WebSocket)
2. Click rock
3. Look for `rockMine` and `rockUpdate` messages

---

### ❌ Problem: "Rock doesn't respawn"

**Checklist:**
- [ ] Did rock.isAlive become false?
- [ ] Is setTimeout called?
- [ ] Is RESPAWN_TIME correct (45000 ms)?
- [ ] Check server console for respawn log

**Solution:** Add `console.log` in scheduleRockRespawn to debug.

---

### ❌ Problem: "Client and server positions don't match"

**Fix:** Rock positions in `RockHandler.ts` MUST be identical to `MiningHandler.ts`

**Copy this array to both files:**
```typescript
const rockPositions = [
    { x: 8, z: 8 },
    { x: -8, z: 8 },
    { x: 8, z: -8 },
    { x: -8, z: -8 },
    { x: 12, z: 0 },
    { x: -12, z: 0 },
    { x: 0, z: 12 },
    { x: 0, z: -12 },
    { x: 5, z: 5 },
    { x: -5, z: -5 },
];
```

---

## Part 6: Key Patterns to Remember

### 1. **The Flow**
```
User Click → InteractionHandler → MiningHandler → Network → 
→ GameServer → RockHandler → Broadcast → All Clients Update
```

### 2. **File Structure**
```
CLIENT:
- Rock.ts              (entity class)
- MiningHandler.ts     (feature logic)
- network/Mining.ts    (network events)

SERVER:
- handlers/RockHandler.ts  (server logic)
```

### 3. **Naming Convention**
- Entity: `Rock.ts`
- Handler: `MiningHandler.ts` (client), `RockHandler.ts` (server)
- Network: `Mining.ts`
- Events: `rockMine`, `rockUpdate`, `rocksUpdate`, `miningReward`

### 4. **Initialization Order**
```typescript
1. Scene
2. PlayerHandler
3. SetupScene (creates local player)
4. NetworkHandler
5. Network connection
6. ChatHandler
7. MovementHandler
8. WoodcuttingHandler
9. MiningHandler          ← Your new handler
10. InteractionHandler    ← Must be LAST (needs all others)
```

---

## Part 7: Complete Checklist

Before testing, verify:

**CLIENT FILES:**
- [ ] Created `client/src/game/Rock.ts`
- [ ] Created `client/src/game/network/Mining.ts`
- [ ] Created `client/src/game/handlers/MiningHandler.ts`
- [ ] Updated `client/src/game/network/Network.ts` (5 changes)
- [ ] Updated `client/src/game/handlers/InteractionHandler.ts` (6 changes)
- [ ] Updated `client/src/game/handlers/GameNetworkHandler.ts` (2 changes)
- [ ] Updated `client/src/game/Game.tsx` (6 changes)

**SERVER FILES:**
- [ ] Created `server/src/game/handlers/RockHandler.ts`
- [ ] Updated `server/src/game/GameServer.ts` (6 changes)

**TESTING:**
- [ ] Server starts without errors
- [ ] Client starts without errors
- [ ] 10 rocks visible in game
- [ ] Clicking rock shows console log
- [ ] Health bar decreases
- [ ] Rewards shown in console
- [ ] Rock disappears at 0 health
- [ ] Rock respawns after 45s
- [ ] Second player sees updates

---

## Congratulations! 🎉

You've successfully added Mining to Sacred Heart!

### What You Learned:
- ✅ Client-server architecture
- ✅ Handler pattern
- ✅ Network events with Socket.IO
- ✅ Entity classes (Rock)
- ✅ 3D mesh creation and health bars
- ✅ Respawn timers
- ✅ Multiplayer synchronization

### You Can Now Add:
- 🐟 **Fishing** (FishingSpots)
- 🔥 **Cooking** (Campfires)
- ⚔️ **Combat** (NPCs)
- 🌾 **Farming** (Plants)

**Just follow the same pattern!**

---

## Quick Reference Card

### Adding a New Feature:

1. **Define Requirements** (health, damage, rewards, respawn time)
2. **Create Entity Class** (CLIENT - what it looks like)
3. **Create Network Module** (CLIENT - send/receive events)
4. **Create Handler** (CLIENT - manages all entities)
5. **Update Network.ts** (CLIENT - add to main network)
6. **Update InteractionHandler** (CLIENT - detect clicks)
7. **Update GameNetworkHandler** (CLIENT - route callbacks)
8. **Update Game.tsx** (CLIENT - initialize handler)
9. **Create Server Handler** (SERVER - game logic)
10. **Update GameServer.ts** (SERVER - handle events)
11. **Test** (both single player and multiplayer)

### Common Event Names:
- `{feature}Action` - player does something (e.g., `rockMine`)
- `{entity}Update` - single entity changed (e.g., `rockUpdate`)
- `{entity}sUpdate` - bulk update (e.g., `rocksUpdate`)
- `{feature}Reward` - give player rewards (e.g., `miningReward`)

### Common Methods:
- `handle{Action}` - process player action
- `update` - update entity visual
- `dispose` - clean up entity
- `getAll{Entities}` - get all for new player
- `broadcast{Entity}Update` - tell all clients

---

## Need More Help?

**Debug Steps:**
1. Check **browser console** (F12)
2. Check **server console** (terminal)
3. Check **Network tab** → WS → See Socket.IO messages
4. Add `console.log` everywhere to trace flow
5. Verify event names match EXACTLY (typos break everything)
6. Verify IDs match (client IDs must equal server IDs)

**Remember:** You're not stupid if this is hard. Game networking is complex! Take breaks, debug methodically, and you'll get it. 💪

You got this! 🚀
