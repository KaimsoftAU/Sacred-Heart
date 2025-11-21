# Tutorial: Adding Game Features (Like Woodcutting)

This tutorial explains the architecture and step-by-step process for adding new interactive features to Sacred Heart, using the Woodcutting system as a reference example.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Step-by-Step: Adding a New Feature](#step-by-step-adding-a-new-feature)
4. [Example: Woodcutting Implementation](#example-woodcutting-implementation)
5. [Testing Your Feature](#testing-your-feature)
6. [Best Practices](#best-practices)

---

## Architecture Overview

Sacred Heart uses a **client-server architecture** with real-time communication:

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │   Game.tsx   │───▶│  Tree.ts     │    │  Player.ts   │ │
│  │ (Coordinator)│    │ (Entity)     │    │  (Entity)    │ │
│  └──────┬───────┘    └──────────────┘    └──────────────┘ │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────────────────────────────┐                 │
│  │  network/Woodcutting.ts              │                 │
│  │  (Network Events Handler)            │                 │
│  └──────────────┬───────────────────────┘                 │
└─────────────────┼───────────────────────────────────────────┘
                  │ Socket.IO
                  │ (WebSocket)
┌─────────────────▼───────────────────────────────────────────┐
│                         SERVER                              │
│  ┌──────────────────────────────────────┐                  │
│  │  game/GameServer.ts                  │                  │
│  │  (Connection & Event Router)         │                  │
│  └──────────────┬───────────────────────┘                  │
│                 │                                           │
│                 ▼                                           │
│  ┌──────────────────────────────────────┐                  │
│  │  game/handlers/TreeHandler.ts        │                  │
│  │  (Business Logic & State Management) │                  │
│  └──────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### Key Concepts

- **Client**: Handles rendering, user input, and visual feedback
- **Server**: Manages authoritative game state, validates actions, broadcasts updates
- **Network Layer**: Socket.IO events for real-time bidirectional communication
- **Handlers**: Server-side classes that encapsulate feature logic

---

## Project Structure

```
Sacred-Heart/
├── client/
│   └── src/
│       └── game/
│           ├── Game.tsx              # Main game coordinator
│           ├── Tree.ts               # Tree entity class
│           ├── Player.ts             # Player entity class
│           └── network/
│               ├── Network.ts        # Main network class
│               └── Woodcutting.ts    # Feature-specific network events
│
└── server/
    ├── server.ts                     # Entry point
    └── src/
        ├── game/
        │   ├── GameServer.ts         # Socket.IO game server
        │   └── handlers/
        │       └── TreeHandler.ts    # Woodcutting logic
        ├── http/
        │   └── app.ts                # Express REST API
        ├── models/
        │   └── Player.ts             # MongoDB player model
        └── routes/
            ├── auth.ts
            └── verify.ts
```

---

## Step-by-Step: Adding a New Feature

Let's walk through adding a new feature like "Mining Rocks" using the same pattern as Woodcutting.

### Step 1: Define Your Feature Requirements

**Example: Mining System**
- Rocks spawn at fixed locations
- Players click rocks to mine them
- Each hit deals damage (e.g., 15 damage)
- Rocks have 120 health
- When depleted, rocks respawn after 45 seconds
- Players get ore and mining XP

### Step 2: Create the Client-Side Entity Class

Create `client/src/game/Rock.ts`:

```typescript
import * as BABYLON from '@babylonjs/core';

export interface RockData {
    id: string;
    position: { x: number; z: number };
    health: number;
    maxHealth: number;
    isAlive: boolean;
}

export class Rock {
    private scene: BABYLON.Scene;
    private id: string;
    private position: { x: number; z: number };
    
    // Visual meshes
    private mesh?: BABYLON.Mesh;
    
    // Health system
    private health: number;
    private maxHealth: number;
    private isAlive: boolean;
    
    // Health bar
    private healthBarBackground?: BABYLON.Mesh;
    private healthBarForeground?: BABYLON.Mesh;
    
    // Interaction callback
    private onMineCallback?: (rockId: string) => void;

    constructor(scene: BABYLON.Scene, rockData: RockData, onMine?: (rockId: string) => void) {
        this.scene = scene;
        this.id = rockData.id;
        this.position = rockData.position;
        this.health = rockData.health;
        this.maxHealth = rockData.maxHealth;
        this.isAlive = rockData.isAlive;
        this.onMineCallback = onMine;
        
        this.createRockMesh();
        this.createHealthBar();
    }

    private createRockMesh(): void {
        // Create a gray sphere for the rock
        this.mesh = BABYLON.MeshBuilder.CreateSphere(`rock-${this.id}`, {
            diameter: 2
        }, this.scene);
        
        this.mesh.position = new BABYLON.Vector3(
            this.position.x,
            1, // Height
            this.position.z
        );
        
        const material = new BABYLON.StandardMaterial(`rock-mat-${this.id}`, this.scene);
        material.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5); // Gray
        this.mesh.material = material;
        
        // Make clickable
        this.mesh.isPickable = true;
        this.mesh.metadata = { type: 'rock', id: this.id };
    }

    private createHealthBar(): void {
        // Background (red)
        this.healthBarBackground = BABYLON.MeshBuilder.CreatePlane(`rock-hpbg-${this.id}`, {
            width: 1,
            height: 0.1
        }, this.scene);
        
        const bgMaterial = new BABYLON.StandardMaterial(`rock-hpbg-mat-${this.id}`, this.scene);
        bgMaterial.diffuseColor = new BABYLON.Color3(1, 0, 0);
        bgMaterial.emissiveColor = new BABYLON.Color3(0.5, 0, 0);
        this.healthBarBackground.material = bgMaterial;
        this.healthBarBackground.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
        this.healthBarBackground.position = new BABYLON.Vector3(
            this.position.x,
            2.5,
            this.position.z
        );
        
        // Foreground (green)
        this.healthBarForeground = BABYLON.MeshBuilder.CreatePlane(`rock-hpfg-${this.id}`, {
            width: 1,
            height: 0.1
        }, this.scene);
        
        const fgMaterial = new BABYLON.StandardMaterial(`rock-hpfg-mat-${this.id}`, this.scene);
        fgMaterial.diffuseColor = new BABYLON.Color3(0, 1, 0);
        fgMaterial.emissiveColor = new BABYLON.Color3(0, 0.5, 0);
        this.healthBarForeground.material = fgMaterial;
        this.healthBarForeground.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
        this.healthBarForeground.position = new BABYLON.Vector3(
            this.position.x,
            2.51,
            this.position.z
        );
    }

    public mine(): void {
        if (this.isAlive && this.onMineCallback) {
            this.onMineCallback(this.id);
        }
    }

    public update(rockData: RockData): void {
        this.health = rockData.health;
        this.isAlive = rockData.isAlive;
        
        // Update health bar
        if (this.healthBarForeground) {
            const healthPercent = this.health / this.maxHealth;
            this.healthBarForeground.scaling.x = healthPercent;
            this.healthBarForeground.position.x = 
                this.position.x - (1 - healthPercent) / 2;
        }
        
        // Hide rock if depleted
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

    public dispose(): void {
        this.mesh?.dispose();
        this.healthBarBackground?.dispose();
        this.healthBarForeground?.dispose();
    }
}
```

### Step 3: Create Network Event Handler

Create `client/src/game/network/Mining.ts`:

```typescript
import type { Socket } from 'socket.io-client';
import type { RockData } from '../Rock';

export class MiningNetwork {
    private socket: Socket;

    constructor(socket: Socket) {
        this.socket = socket;
    }

    // Send mining action to server
    public sendRockMine(rockId: string): void {
        this.socket.emit('rockMine', { rockId });
    }

    // Listen for rock state updates
    public onRockUpdate(callback: (rockData: RockData) => void): void {
        this.socket.on('rockUpdate', callback);
    }

    // Listen for bulk rock updates (initial sync)
    public onRocksUpdate(callback: (rocks: RockData[]) => void): void {
        this.socket.on('rocksUpdate', callback);
    }

    // Listen for mining rewards
    public onMiningReward(callback: (data: { ore: number; xp: number; rockId: string }) => void): void {
        this.socket.on('miningReward', callback);
    }

    public cleanup(): void {
        this.socket.off('rockUpdate');
        this.socket.off('rocksUpdate');
        this.socket.off('miningReward');
    }
}
```

### Step 4: Integrate Into Game Coordinator

Update `client/src/game/Game.tsx`:

```typescript
import { MiningNetwork } from './network/Mining';
import { Rock, RockData } from './Rock';

export class Game {
    // Add to class properties
    private miningNetwork: MiningNetwork;
    private rocks: Map<string, Rock> = new Map();
    private miningLevel: number = 1;
    private miningXP: number = 0;
    private oreCollected: number = 0;

    constructor(canvas: HTMLCanvasElement, token: string) {
        // ... existing setup ...
        
        // Initialize mining network
        this.miningNetwork = new MiningNetwork(this.network.socket);
        
        // ... rest of constructor ...
    }

    private setupNetworkListeners(): void {
        // ... existing listeners ...
        
        // Mining listeners
        this.miningNetwork.onRocksUpdate(this.handleRocksUpdate.bind(this));
        this.miningNetwork.onRockUpdate(this.handleRockUpdate.bind(this));
        this.miningNetwork.onMiningReward(this.handleMiningReward.bind(this));
    }

    private createRocks(): void {
        const rockPositions = [
            { x: 15, z: 15 },
            { x: -15, z: 15 },
            { x: 15, z: -15 },
            // ... more positions
        ];

        rockPositions.forEach((pos, index) => {
            const rockData: RockData = {
                id: `rock-${index}`,
                position: pos,
                health: 120,
                maxHealth: 120,
                isAlive: true
            };

            const rock = new Rock(
                this.scene,
                rockData,
                this.handleRockMine.bind(this)
            );
            this.rocks.set(rockData.id, rock);
        });
    }

    private setupRockInteraction(): void {
        this.scene.onPointerDown = (evt, pickResult) => {
            if (pickResult.hit && pickResult.pickedMesh) {
                const metadata = pickResult.pickedMesh.metadata;
                
                if (metadata && metadata.type === 'rock') {
                    const rock = this.rocks.get(metadata.id);
                    if (rock) {
                        rock.mine();
                    }
                }
            }
        };
    }

    private handleRockMine(rockId: string): void {
        console.log(`Mining rock: ${rockId}`);
        this.miningNetwork.sendRockMine(rockId);
    }

    private handleRocksUpdate(rocks: RockData[]): void {
        rocks.forEach(rockData => {
            const rock = this.rocks.get(rockData.id);
            if (rock) {
                rock.update(rockData);
            }
        });
    }

    private handleRockUpdate(rockData: RockData): void {
        const rock = this.rocks.get(rockData.id);
        if (rock) {
            rock.update(rockData);
        }
    }

    private handleMiningReward(data: { ore: number; xp: number; rockId: string }): void {
        this.oreCollected += data.ore;
        this.miningXP += data.xp;
        
        console.log(`+${data.ore} ore, +${data.xp} XP`);
        console.log(`Total: ${this.oreCollected} ore, ${this.miningXP} XP`);
    }
}
```

### Step 5: Create Server-Side Handler

Create `server/src/game/handlers/RockHandler.ts`:

```typescript
import type { Socket, Server } from 'socket.io';

export interface RockState {
    id: string;
    position: { x: number; z: number };
    health: number;
    maxHealth: number;
    isAlive: boolean;
    respawnTimeout?: NodeJS.Timeout;
}

export class RockHandler {
    private rocks: Map<string, RockState>;
    private io: Server;
    
    private readonly ROCK_MINE_DAMAGE = 15;
    private readonly ROCK_RESPAWN_TIME = 45000;  // 45 seconds
    private readonly MINING_XP_PER_ORE = 30;

    constructor(io: Server) {
        this.io = io;
        this.rocks = new Map<string, RockState>();
        this.initializeRocks();
    }

    private initializeRocks(): void {
        const rockPositions = [
            { x: 15, z: 15 },
            { x: -15, z: 15 },
            { x: 15, z: -15 },
            // ... more positions (match client)
        ];

        rockPositions.forEach((pos, index) => {
            const rock: RockState = {
                id: `rock-${index}`,
                position: pos,
                health: 120,
                maxHealth: 120,
                isAlive: true
            };
            this.rocks.set(rock.id, rock);
        });

        console.log(`[RockHandler] Initialized ${this.rocks.size} rocks`);
    }

    public getRocks(): RockState[] {
        return Array.from(this.rocks.values());
    }

    public handleRockMine(socket: Socket, data: { rockId: string }): void {
        const rock = this.rocks.get(data.rockId);
        
        if (!rock || !rock.isAlive) {
            return;
        }

        // Apply damage
        rock.health -= this.ROCK_MINE_DAMAGE;

        if (rock.health <= 0) {
            rock.health = 0;
            rock.isAlive = false;

            // Send reward to player
            socket.emit('miningReward', {
                ore: 1,
                xp: this.MINING_XP_PER_ORE,
                rockId: rock.id
            });

            // Schedule respawn
            this.scheduleRockRespawn(rock.id);
        }

        // Broadcast rock state to all players
        this.broadcastRockUpdate(rock);
    }

    private scheduleRockRespawn(rockId: string): void {
        const rock = this.rocks.get(rockId);
        if (!rock) return;

        // Clear existing timeout if any
        if (rock.respawnTimeout) {
            clearTimeout(rock.respawnTimeout);
        }

        rock.respawnTimeout = setTimeout(() => {
            rock.health = rock.maxHealth;
            rock.isAlive = true;
            rock.respawnTimeout = undefined;

            console.log(`[RockHandler] Rock ${rockId} respawned`);
            this.broadcastRockUpdate(rock);
        }, this.ROCK_RESPAWN_TIME);
    }

    private broadcastRockUpdate(rock: RockState): void {
        this.io.emit('rockUpdate', {
            id: rock.id,
            position: rock.position,
            health: rock.health,
            maxHealth: rock.maxHealth,
            isAlive: rock.isAlive
        });
    }

    public cleanup(): void {
        // Clear all respawn timers
        this.rocks.forEach(rock => {
            if (rock.respawnTimeout) {
                clearTimeout(rock.respawnTimeout);
            }
        });
        this.rocks.clear();
    }
}
```

### Step 6: Integrate Handler Into GameServer

Update `server/src/game/GameServer.ts`:

```typescript
import { RockHandler } from './handlers/RockHandler.js';

export class GameServer {
    private rockHandler: RockHandler;

    constructor(httpServer: any) {
        // ... existing setup ...
        
        // Initialize handlers
        this.treeHandler = new TreeHandler(this.io);
        this.rockHandler = new RockHandler(this.io);
        
        // ... rest of constructor ...
    }

    private setupConnectionHandlers(): void {
        this.io.on('connection', async (socket) => {
            // ... existing connection logic ...
            
            // Send initial rock states
            socket.emit('rocksUpdate', this.rockHandler.getRocks());
            
            // ... existing event listeners ...
            
            // Mining events
            socket.on('rockMine', (data: { rockId: string }) => {
                this.rockHandler.handleRockMine(socket, data);
            });
        });
    }

    public shutdown(): void {
        // ... existing cleanup ...
        this.rockHandler.cleanup();
    }
}
```

### Step 7: Update Network Class (Optional)

If you want to organize network modules, update `client/src/game/network/Network.ts`:

```typescript
import { MiningNetwork } from './Mining';

export class Network {
    public mining: MiningNetwork;

    constructor(serverUrl: string, token: string) {
        // ... existing setup ...
        
        this.mining = new MiningNetwork(this.socket);
    }

    public disconnect(): void {
        // ... existing cleanup ...
        this.mining.cleanup();
    }
}
```

---

## Example: Woodcutting Implementation

### Client Structure

**`client/src/game/Tree.ts`**
- Manages tree visual (trunk + leaves)
- Health bar rendering
- Click interaction callback
- State updates from network

**`client/src/game/network/Woodcutting.ts`**
- `sendTreeChop(treeId)` - Send chop action
- `onTreeUpdate(callback)` - Listen for tree state changes
- `onTreesUpdate(callback)` - Initial tree sync
- `onWoodcuttingReward(callback)` - Receive logs/XP

**`client/src/game/Game.tsx`**
- Creates 20 trees at startup
- Raycasting for tree clicks
- Delegates chop action to network
- Updates tree state from server
- Tracks woodcutting stats (level, XP, logs)

### Server Structure

**`server/src/game/handlers/TreeHandler.ts`**
- Initializes 20 tree states
- `handleTreeChop()` - Validates and applies damage
- Awards logs and XP to player
- `scheduleTreeRespawn()` - 30-second respawn timer
- Broadcasts tree updates to all clients

**`server/src/game/GameServer.ts`**
- Instantiates TreeHandler
- Routes `treeChop` events to TreeHandler
- Sends initial tree states on player connect

### Event Flow

1. **Player clicks tree** → Client detects via raycasting
2. **Client sends `treeChop`** → Contains treeId
3. **Server validates** → TreeHandler checks if tree is alive
4. **Server applies damage** → 20 damage per chop
5. **Server broadcasts `treeUpdate`** → All clients see health decrease
6. **If tree depleted** → Server sends `woodcuttingReward` to player
7. **Server schedules respawn** → 30 seconds later, tree resets
8. **Server broadcasts `treeUpdate`** → All clients see tree respawn

---

## Testing Your Feature

### 1. Start the Servers

```bash
# Terminal 1: Start backend server
cd server
npm run dev

# Terminal 2: Start frontend client
cd client
npm run dev
```

### 2. Test Checklist

- [ ] Feature entities spawn at correct positions
- [ ] Clicking/interacting triggers network event
- [ ] Health decreases with each action
- [ ] Health bar updates visually
- [ ] Entity disappears when depleted
- [ ] Player receives rewards (items/XP)
- [ ] Entity respawns after configured time
- [ ] Multiple players see same state (test with 2+ tabs)
- [ ] No console errors on client or server
- [ ] Network events logged in console

### 3. Debugging Tips

**Client Console (`F12` in browser):**
```javascript
// Check if entities exist
console.log(game.rocks.size);  // Should match number of rocks

// Check network events
network.socket.on('rockUpdate', (data) => console.log('Rock update:', data));
```

**Server Console:**
```typescript
// Add logs in handler
console.log(`[RockHandler] Player ${socket.id} mined rock ${rockId}`);
```

---

## Best Practices

### 1. **Separation of Concerns**
- **Entity classes** (Tree.ts, Rock.ts) handle visuals only
- **Network classes** (Woodcutting.ts, Mining.ts) handle events only
- **Handlers** (TreeHandler.ts, RockHandler.ts) handle game logic only
- **Game.tsx** coordinates between all layers

### 2. **Server Authority**
- Server validates all actions (is rock alive? is player in range?)
- Server calculates rewards, damage, and timers
- Client displays what server tells it (never calculates own rewards)

### 3. **Synchronization**
- Send initial state on player connect (`rocksUpdate` event)
- Broadcast state changes to ALL clients (`rockUpdate` event)
- Use unique IDs for entities (e.g., `rock-0`, `rock-1`)

### 4. **Performance**
- Reuse meshes/materials where possible
- Dispose of resources in cleanup methods
- Use billboard mode for 2D elements (health bars, text)

### 5. **Code Organization**
```
Feature Name: Mining
├── Client
│   ├── Entity class: Rock.ts
│   ├── Network module: Mining.ts
│   └── Integration: Game.tsx (createRocks, setupRockInteraction, handle events)
└── Server
    ├── Handler: RockHandler.ts
    └── Integration: GameServer.ts (route events, send initial state)
```

### 6. **TypeScript Best Practices**
- Define interfaces for data structures (`RockData`, `RockState`)
- Use strict typing (avoid `any`)
- Export interfaces that are shared between files

### 7. **Naming Conventions**
- **Events**: `camelCase` (e.g., `rockMine`, `treeChop`)
- **Classes**: `PascalCase` (e.g., `RockHandler`, `Tree`)
- **Files**: `PascalCase` for classes (e.g., `Rock.ts`), `camelCase` for modules (e.g., `mining.ts`)

---

## Common Patterns

### Pattern 1: Clickable Entities
```typescript
// Set mesh as pickable
mesh.isPickable = true;
mesh.metadata = { type: 'rock', id: this.id };

// Detect clicks in Game.tsx
this.scene.onPointerDown = (evt, pickResult) => {
    if (pickResult.hit && pickResult.pickedMesh?.metadata?.type === 'rock') {
        // Handle interaction
    }
};
```

### Pattern 2: Health Bars
```typescript
// Use two planes: background (red) and foreground (green)
// Use billboard mode to face camera
healthBar.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

// Scale foreground based on health percentage
foreground.scaling.x = health / maxHealth;
```

### Pattern 3: Respawn Timers
```typescript
// Store timeout reference to clear if needed
respawnTimeout = setTimeout(() => {
    entity.health = entity.maxHealth;
    entity.isAlive = true;
    broadcastUpdate(entity);
}, RESPAWN_TIME);
```

### Pattern 4: Initial State Sync
```typescript
// Server: Send all entity states on connect
socket.emit('rocksUpdate', this.rockHandler.getRocks());

// Client: Update all entities
this.onRocksUpdate((rocks) => {
    rocks.forEach(rockData => {
        this.rocks.get(rockData.id)?.update(rockData);
    });
});
```

---

## Congratulations!

You now understand how to add RuneScape-style skilling features to Sacred Heart. Follow this pattern for:
- **Fishing** (fish spots, fishing rods, fish inventory)
- **Combat** (NPCs, combat stats, damage calculation)
- **Crafting** (workbenches, recipes, item creation)
- **Farming** (plant seeds, growth timers, harvest)

The architecture is designed to scale to any feature you can imagine!

---

## Need Help?

- Check existing implementations: `Tree.ts`, `TreeHandler.ts`, `Woodcutting.ts`
- Look at console logs for network events and errors
- Test with multiple browser tabs to ensure synchronization works
- Review this tutorial again for the specific step you're stuck on

Happy coding! 🎮
