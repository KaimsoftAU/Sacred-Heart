# Building a Multiplayer 3D MMORPG from Scratch

## Complete Tutorial: Sacred Heart Game Development

This tutorial will guide you through building a complete multiplayer 3D MMORPG using React, Babylon.js, Node.js, Socket.IO, and PostgreSQL. By the end, you'll have a fully functional game with player movement, chat, woodcutting skills, trading, and a medieval world with castles and villages.

---

## Table of Contents

1. [Prerequisites & Project Setup](#1-prerequisites--project-setup)
2. [Database Design](#2-database-design)
3. [Backend Server - Authentication](#3-backend-server---authentication)
4. [Backend Server - Game Server](#4-backend-server---game-server)
5. [Frontend - React Setup](#5-frontend---react-setup)
6. [3D World - Babylon.js Scene](#6-3d-world---babylonjs-scene)
7. [Player System](#7-player-system)
8. [Multiplayer Networking](#8-multiplayer-networking)
9. [Chat System](#9-chat-system)
10. [Woodcutting & Skills](#10-woodcutting--skills)
11. [Trading System](#11-trading-system)
12. [World Building](#12-world-building)
13. [UI Components](#13-ui-components)
14. [Testing & Deployment](#14-testing--deployment)

---

## 1. Prerequisites & Project Setup

### What You'll Need

- **Node.js** (v18+) and npm
- **PostgreSQL** (v14+)
- Code editor (VS Code recommended)
- Basic knowledge of:
  - TypeScript/JavaScript
  - React
  - Express.js
  - SQL

### Project Structure

```
Sacred-Heart/
├── client/                 # React frontend
│   ├── public/
│   │   └── GreatSwordPack/  # 3D character models
│   ├── src/
│   │   ├── components/      # React UI components
│   │   ├── game/            # Babylon.js game code
│   │   │   ├── handlers/    # Game logic handlers
│   │   │   ├── network/     # Socket.IO client code
│   │   │   ├── components/  # Game UI components
│   │   │   ├── utils/       # Utility functions
│   │   │   ├── Game.tsx     # Main game coordinator
│   │   │   ├── Player.ts    # Player class
│   │   │   └── Tree.ts      # Tree class
│   │   ├── pages/           # React pages
│   │   └── App.tsx          # Main React app
│   ├── package.json
│   └── vite.config.ts
│
└── server/                 # Node.js backend
    ├── src/
    │   ├── routes/         # API endpoints
    │   ├── game/           # Game server logic
    │   │   ├── handlers/   # Server-side handlers
    │   │   └── GameServer.ts
    │   ├── middleware/     # Express middleware
    │   └── server.ts       # Main server file
    ├── package.json
    └── tsconfig.json
```

### Initialize the Projects

```bash
# Create project root
mkdir Sacred-Heart
cd Sacred-Heart

# Create client (frontend)
npm create vite@latest client -- --template react-ts
cd client
npm install
npm install @babylonjs/core @babylonjs/loaders socket.io-client
cd ..

# Create server (backend)
mkdir server
cd server
npm init -y
npm install express socket.io pg bcrypt jsonwebtoken cors
npm install -D typescript @types/express @types/node @types/bcrypt @types/jsonwebtoken @types/cors ts-node nodemon
npx tsc --init
cd ..
```

---

## 2. Database Design

### Create PostgreSQL Database

```sql
-- Create database
CREATE DATABASE sacred_heart;

-- Connect to database
\c sacred_heart

-- Players table
CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    position_x FLOAT DEFAULT 0,
    position_y FLOAT DEFAULT 0.5,
    position_z FLOAT DEFAULT 0,
    rotation_x FLOAT DEFAULT 0,
    rotation_y FLOAT DEFAULT 0,
    rotation_z FLOAT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Skills table
CREATE TABLE skills (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    skill_name VARCHAR(50) NOT NULL,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    UNIQUE(player_id, skill_name)
);

-- Create index for faster lookups
CREATE INDEX idx_players_username ON players(username);
CREATE INDEX idx_skills_player_id ON skills(player_id);
```

### Understanding the Schema

- **players**: Stores user credentials and last known position/rotation
- **skills**: Stores skill progression (woodcutting, mining, etc.) linked to players
- We use `SERIAL` for auto-incrementing IDs
- `ON DELETE CASCADE` ensures skills are deleted when a player is deleted

---

## 3. Backend Server - Authentication

### Setup Express Server (`server/src/server.ts`)

```typescript
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import authRoutes from './routes/auth';
import playerRoutes from './routes/player';
import { GameServer } from './game/GameServer';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:5173', // Vite dev server
        credentials: true
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/player', playerRoutes);

// Initialize game server
const gameServer = new GameServer(io);

// Start server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
```

### Authentication Routes (`server/src/routes/auth.ts`)

```typescript
import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db';

const router = express.Router();
const JWT_SECRET = 'your-secret-key-change-in-production';

// Register endpoint
router.post('/register', async (req: Request, res: Response) => {
    const { username, password } = req.body;

    try {
        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Insert user
        const result = await pool.query(
            'INSERT INTO players (username, password_hash) VALUES ($1, $2) RETURNING id, username',
            [username, passwordHash]
        );

        const player = result.rows[0];

        // Create default skills
        await pool.query(
            'INSERT INTO skills (player_id, skill_name, level, xp) VALUES ($1, $2, $3, $4)',
            [player.id, 'woodcutting', 1, 0]
        );

        // Generate JWT token
        const token = jwt.sign({ id: player.id, username: player.username }, JWT_SECRET);

        res.json({ token, player });
    } catch (error: any) {
        if (error.code === '23505') { // Unique violation
            res.status(400).json({ error: 'Username already exists' });
        } else {
            res.status(500).json({ error: 'Server error' });
        }
    }
});

// Login endpoint
router.post('/login', async (req: Request, res: Response) => {
    const { username, password } = req.body;

    try {
        const result = await pool.query(
            'SELECT * FROM players WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const player = result.rows[0];
        const validPassword = await bcrypt.compare(password, player.password_hash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: player.id, username: player.username }, JWT_SECRET);

        res.json({ token, player });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
```

### Database Connection (`server/src/db.ts`)

```typescript
import { Pool } from 'pg';

const pool = new Pool({
    user: 'postgres',
    password: 'your-password',
    host: 'localhost',
    port: 5432,
    database: 'sacred_heart'
});

export default pool;
```

---

## 4. Backend Server - Game Server

### Game Server Core (`server/src/game/GameServer.ts`)

```typescript
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import pool from '../db';

interface PlayerData {
    id: string;
    username: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
}

export class GameServer {
    private io: Server;
    private players: Map<string, PlayerData> = new Map();

    constructor(io: Server) {
        this.io = io;
        this.setupSocketHandlers();
    }

    private setupSocketHandlers(): void {
        this.io.on('connection', (socket: Socket) => {
            console.log('Player connected:', socket.id);

            // Authenticate player
            this.handleAuthentication(socket);

            // Movement
            socket.on('playerMove', (data) => this.handlePlayerMove(socket, data));

            // Chat
            socket.on('playerMessage', (data) => this.handlePlayerMessage(socket, data));

            // Disconnect
            socket.on('disconnect', () => this.handleDisconnect(socket));
        });
    }

    private async handleAuthentication(socket: Socket): Promise<void> {
        const token = socket.handshake.auth.token;

        try {
            const decoded: any = jwt.verify(token, 'your-secret-key-change-in-production');
            
            // Load player from database
            const result = await pool.query(
                'SELECT id, username, position_x, position_y, position_z, rotation_x, rotation_y, rotation_z FROM players WHERE id = $1',
                [decoded.id]
            );

            if (result.rows.length === 0) {
                socket.disconnect();
                return;
            }

            const player = result.rows[0];
            socket.data.username = player.username;
            socket.data.playerId = player.id;

            const playerData: PlayerData = {
                id: socket.id,
                username: player.username,
                position: { x: player.position_x, y: player.position_y, z: player.position_z },
                rotation: { x: player.rotation_x, y: player.rotation_y, z: player.rotation_z }
            };

            this.players.set(socket.id, playerData);

            // Send existing players to new player
            const otherPlayers = Array.from(this.players.values()).filter(p => p.id !== socket.id);
            socket.emit('playersUpdate', otherPlayers);

            // Notify others about new player
            socket.broadcast.emit('playerJoined', playerData);

            console.log(`✓ ${player.username} authenticated`);
        } catch (error) {
            console.error('Authentication failed:', error);
            socket.disconnect();
        }
    }

    private handlePlayerMove(socket: Socket, data: any): void {
        const player = this.players.get(socket.id);
        if (!player) return;

        player.position = data.position;
        player.rotation = data.rotation;

        // Broadcast to other players
        socket.broadcast.emit('playerMove', {
            id: socket.id,
            username: player.username,
            position: data.position,
            rotation: data.rotation
        });

        // Save to database (debounced in production)
        this.savePlayerPosition(socket.data.playerId, data.position, data.rotation);
    }

    private async savePlayerPosition(playerId: number, position: any, rotation: any): Promise<void> {
        try {
            await pool.query(
                'UPDATE players SET position_x = $1, position_y = $2, position_z = $3, rotation_x = $4, rotation_y = $5, rotation_z = $6 WHERE id = $7',
                [position.x, position.y, position.z, rotation.x, rotation.y, rotation.z, playerId]
            );
        } catch (error) {
            console.error('Error saving position:', error);
        }
    }

    private handlePlayerMessage(socket: Socket, message: string): void {
        const player = this.players.get(socket.id);
        if (!player) return;

        // Broadcast to all players
        this.io.emit('playerMessage', {
            playerId: socket.id,
            username: player.username,
            message
        });
    }

    private handleDisconnect(socket: Socket): void {
        this.players.delete(socket.id);
        socket.broadcast.emit('playerLeft', { playerId: socket.id });
        console.log('Player disconnected:', socket.id);
    }
}
```

---

## 5. Frontend - React Setup

### Main App Component (`client/src/App.tsx`)

```typescript
import React, { useState } from 'react';
import Login from './pages/Login';
import Game from './pages/Game';

function App() {
    const [player, setPlayer] = useState<any>(null);
    const [token, setToken] = useState<string>('');

    const handleLogin = (playerData: any, authToken: string) => {
        setPlayer(playerData);
        setToken(authToken);
        localStorage.setItem('token', authToken);
    };

    const handleLogout = () => {
        setPlayer(null);
        setToken('');
        localStorage.removeItem('token');
    };

    // Check for existing token on mount
    React.useEffect(() => {
        const savedToken = localStorage.getItem('token');
        if (savedToken) {
            // Verify token and load player data
            fetch('http://localhost:3000/api/player/me', {
                headers: { 'Authorization': `Bearer ${savedToken}` }
            })
                .then(res => res.json())
                .then(data => {
                    setPlayer(data);
                    setToken(savedToken);
                })
                .catch(() => localStorage.removeItem('token'));
        }
    }, []);

    if (!player || !token) {
        return <Login onLogin={handleLogin} />;
    }

    return <Game player={player} token={token} onLogout={handleLogout} />;
}

export default App;
```

### Login Page (`client/src/pages/Login.tsx`)

```typescript
import React, { useState } from 'react';

interface LoginProps {
    onLogin: (player: any, token: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isRegister, setIsRegister] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const endpoint = isRegister ? 'register' : 'login';

        try {
            const response = await fetch(`http://localhost:3000/api/auth/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error);
                return;
            }

            onLogin(data.player, data.token);
        } catch (err) {
            setError('Connection error');
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#1a1a1a' }}>
            <div style={{ background: '#2a2a2a', padding: '2rem', borderRadius: '8px', minWidth: '300px' }}>
                <h2 style={{ color: 'white', marginBottom: '1rem' }}>
                    {isRegister ? 'Register' : 'Login'}
                </h2>
                
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
                    />
                    
                    {error && <p style={{ color: 'red' }}>{error}</p>}
                    
                    <button type="submit" style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }}>
                        {isRegister ? 'Register' : 'Login'}
                    </button>
                    
                    <button
                        type="button"
                        onClick={() => setIsRegister(!isRegister)}
                        style={{ width: '100%', padding: '0.5rem', background: 'transparent', color: 'white' }}
                    >
                        {isRegister ? 'Have an account? Login' : 'Need an account? Register'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
```

---

## 6. 3D World - Babylon.js Scene

### Game Class (`client/src/game/Game.tsx`)

```typescript
import * as BABYLON from '@babylonjs/core';
import { Player, PlayerData } from './Player';
import { Network } from './network/Network';

export default class Game {
    private canvas: HTMLCanvasElement;
    private engine: BABYLON.Engine;
    private scene!: BABYLON.Scene;
    private camera!: BABYLON.ArcRotateCamera;
    private localPlayer!: Player;
    private remotePlayers: Map<string, Player> = new Map();
    private network!: Network;

    constructor(canvas: HTMLCanvasElement, playerData: any, token: string) {
        this.canvas = canvas;
        this.engine = new BABYLON.Engine(canvas, true);
        
        this.initializeScene(playerData);
        this.initializeNetwork(token);
        this.startGameLoop();
    }

    private initializeScene(playerData: any): void {
        this.scene = new BABYLON.Scene(this.engine);
        
        // Camera
        this.camera = new BABYLON.ArcRotateCamera(
            'Camera',
            -Math.PI / 2,
            Math.PI / 3,
            20,
            BABYLON.Vector3.Zero(),
            this.scene
        );
        this.camera.attachControl(this.canvas, true);
        this.camera.lowerRadiusLimit = 5;
        this.camera.upperRadiusLimit = 50;

        // Lighting
        const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), this.scene);
        light.intensity = 0.7;

        // Ground
        const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 500, height: 500 }, this.scene);
        ground.checkCollisions = true;
        const groundMaterial = new BABYLON.StandardMaterial('groundMat', this.scene);
        groundMaterial.diffuseColor = new BABYLON.Color3(0.3, 0.5, 0.2);
        ground.material = groundMaterial;

        // Create local player
        const initialPlayerData: PlayerData = {
            id: 'temp',
            username: playerData.username,
            position: {
                x: playerData.position_x || 0,
                y: playerData.position_y || 0.5,
                z: playerData.position_z || 0
            },
            rotation: {
                x: playerData.rotation_x || 0,
                y: playerData.rotation_y || 0,
                z: playerData.rotation_z || 0
            }
        };

        this.localPlayer = new Player(this.scene, initialPlayerData, true);
        
        // Camera follows player
        this.camera.lockedTarget = this.localPlayer.getMesh();
    }

    private initializeNetwork(token: string): void {
        this.network = new Network('http://localhost:3000', token, {
            onPlayerMove: (data) => this.handlePlayerMove(data),
            onPlayerJoined: (data) => this.handlePlayerJoined(data),
            onPlayerLeft: (data) => this.handlePlayerLeft(data.playerId),
            onPlayersUpdate: (players) => this.handlePlayersUpdate(players)
        });
    }

    private handlePlayerMove(data: PlayerData): void {
        let player = this.remotePlayers.get(data.id);
        if (!player) {
            player = new Player(this.scene, data, false);
            this.remotePlayers.set(data.id, player);
        }
        player.update(data);
    }

    private handlePlayerJoined(data: PlayerData): void {
        if (!this.remotePlayers.has(data.id)) {
            const player = new Player(this.scene, data, false);
            this.remotePlayers.set(data.id, player);
        }
    }

    private handlePlayerLeft(playerId: string): void {
        const player = this.remotePlayers.get(playerId);
        if (player) {
            player.dispose();
            this.remotePlayers.delete(playerId);
        }
    }

    private handlePlayersUpdate(players: PlayerData[]): void {
        players.forEach(playerData => {
            if (!this.remotePlayers.has(playerData.id)) {
                const player = new Player(this.scene, playerData, false);
                this.remotePlayers.set(playerData.id, player);
            }
        });
    }

    private startGameLoop(): void {
        this.engine.runRenderLoop(() => {
            // Update local player movement
            const { moved, position, rotation } = this.localPlayer.updateMovement();
            
            // Send updates to server
            if (moved) {
                this.network.sendPlayerMove(position, rotation);
            }

            this.scene.render();
        });

        window.addEventListener('resize', () => {
            this.engine.resize();
        });
    }

    public dispose(): void {
        this.network.disconnect();
        this.localPlayer.dispose();
        this.remotePlayers.forEach(player => player.dispose());
        this.scene.dispose();
        this.engine.dispose();
    }
}
```

---

## 7. Player System

### Player Class (`client/src/game/Player.ts`)

```typescript
import * as BABYLON from '@babylonjs/core';

export interface PlayerData {
    id: string;
    username?: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
}

export class Player {
    private mesh: BABYLON.Mesh;
    private scene: BABYLON.Scene;
    private id: string;
    private username?: string;
    private keys: { [key: string]: boolean } = {};
    private moveSpeed: number = 0.1;
    private rotationSpeed: number = 0.05;
    private isLocal: boolean;
    private label?: BABYLON.Mesh;

    constructor(scene: BABYLON.Scene, playerData: PlayerData, isLocal: boolean = false) {
        this.scene = scene;
        this.id = playerData.id;
        this.username = playerData.username;
        this.isLocal = isLocal;

        // Create player mesh (box for now)
        this.mesh = BABYLON.MeshBuilder.CreateBox(`player_${this.id}`, { size: 1 }, this.scene);
        this.mesh.position.x = playerData.position.x;
        this.mesh.position.y = playerData.position.y;
        this.mesh.position.z = playerData.position.z;
        
        const material = new BABYLON.StandardMaterial('playerMat', this.scene);
        material.diffuseColor = isLocal ? new BABYLON.Color3(0, 1, 0) : new BABYLON.Color3(1, 0, 0);
        this.mesh.material = material;

        // Create name label for remote players
        if (!isLocal && this.username) {
            this.createNameLabel();
        }

        // Setup keyboard controls for local player
        if (this.isLocal) {
            this.setupKeyboardControls();
        }
    }

    private setupKeyboardControls(): void {
        window.addEventListener('keydown', (evt) => {
            this.keys[evt.key.toLowerCase()] = true;
        });

        window.addEventListener('keyup', (evt) => {
            this.keys[evt.key.toLowerCase()] = false;
        });
    }

    private createNameLabel(): void {
        // Create a plane above player's head with their name
        this.label = BABYLON.MeshBuilder.CreatePlane(`label_${this.id}`, { width: 2, height: 0.5 }, this.scene);
        this.label.parent = this.mesh;
        this.label.position.y = 1.5;
        this.label.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

        // Create texture with name
        const texture = new BABYLON.DynamicTexture('nameTexture', { width: 512, height: 128 }, this.scene);
        const ctx = texture.getContext();
        ctx.font = 'bold 48px Arial';
        ctx.fillStyle = 'yellow';
        ctx.fillText(this.username || 'Player', 10, 80);
        texture.update();

        const material = new BABYLON.StandardMaterial('nameMat', this.scene);
        material.diffuseTexture = texture;
        material.emissiveColor = new BABYLON.Color3(1, 1, 1);
        this.label.material = material;
    }

    public updateMovement(): { moved: boolean; position: BABYLON.Vector3; rotation: BABYLON.Vector3 } {
        if (!this.isLocal) {
            return { moved: false, position: this.mesh.position, rotation: this.mesh.rotation };
        }

        let moved = false;

        // Rotation: A/D keys
        if (this.keys['a']) {
            this.mesh.rotation.y -= this.rotationSpeed;
            moved = true;
        }
        if (this.keys['d']) {
            this.mesh.rotation.y += this.rotationSpeed;
            moved = true;
        }

        // Movement: W/S keys (tank controls)
        if (this.keys['w']) {
            this.mesh.position.x += Math.sin(this.mesh.rotation.y) * this.moveSpeed;
            this.mesh.position.z += Math.cos(this.mesh.rotation.y) * this.moveSpeed;
            moved = true;
        }
        if (this.keys['s']) {
            this.mesh.position.x -= Math.sin(this.mesh.rotation.y) * this.moveSpeed;
            this.mesh.position.z -= Math.cos(this.mesh.rotation.y) * this.moveSpeed;
            moved = true;
        }

        return { moved, position: this.mesh.position.clone(), rotation: this.mesh.rotation.clone() };
    }

    public update(playerData: PlayerData): void {
        this.mesh.position.x = playerData.position.x;
        this.mesh.position.y = playerData.position.y;
        this.mesh.position.z = playerData.position.z;
        this.mesh.rotation.x = playerData.rotation.x;
        this.mesh.rotation.y = playerData.rotation.y;
        this.mesh.rotation.z = playerData.rotation.z;
    }

    public getMesh(): BABYLON.Mesh {
        return this.mesh;
    }

    public dispose(): void {
        if (this.label) this.label.dispose();
        this.mesh.dispose();
    }
}
```

---

## 8. Multiplayer Networking

### Network Class (`client/src/game/network/Network.ts`)

```typescript
import { io, Socket } from 'socket.io-client';
import type { PlayerData } from '../Player';

export interface NetworkCallbacks {
    onConnect?: () => void;
    onDisconnect?: () => void;
    onPlayerMove?: (data: PlayerData) => void;
    onPlayerJoined?: (data: PlayerData) => void;
    onPlayerLeft?: (data: { playerId: string }) => void;
    onPlayersUpdate?: (players: PlayerData[]) => void;
    onPlayerMessage?: (data: any) => void;
}

export class Network {
    private socket: Socket;

    constructor(serverUrl: string, token: string, callbacks: NetworkCallbacks) {
        this.socket = io(serverUrl, {
            auth: { token },
            transports: ['websocket', 'polling']
        });

        // Setup event listeners
        this.socket.on('connect', () => {
            console.log('Connected to server');
            callbacks.onConnect?.();
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            callbacks.onDisconnect?.();
        });

        this.socket.on('playerMove', (data) => {
            callbacks.onPlayerMove?.(data);
        });

        this.socket.on('playerJoined', (data) => {
            callbacks.onPlayerJoined?.(data);
        });

        this.socket.on('playerLeft', (data) => {
            callbacks.onPlayerLeft?.(data);
        });

        this.socket.on('playersUpdate', (players) => {
            callbacks.onPlayersUpdate?.(players);
        });

        this.socket.on('playerMessage', (data) => {
            callbacks.onPlayerMessage?.(data);
        });
    }

    public sendPlayerMove(position: { x: number; y: number; z: number }, rotation: { x: number; y: number; z: number }): void {
        this.socket.emit('playerMove', { position, rotation });
    }

    public sendMessage(message: string): void {
        this.socket.emit('playerMessage', message);
    }

    public disconnect(): void {
        this.socket.disconnect();
    }

    public getSocketId(): string {
        return this.socket.id;
    }
}
```

---

## 9. Chat System

### Adding Chat to Game (`client/src/game/Game.tsx`)

```typescript
// Add to Game class
private setupChat(): void {
    this.network = new Network('http://localhost:3000', token, {
        // ... other callbacks
        onPlayerMessage: (data) => this.handleChatMessage(data)
    });
}

private handleChatMessage(data: { playerId: string; username: string; message: string }): void {
    // Display message above player's head
    const player = data.playerId === this.network.getSocketId() 
        ? this.localPlayer 
        : this.remotePlayers.get(data.playerId);

    if (player) {
        player.showMessage(data.message);
    }
}
```

### Chat UI Component (`client/src/components/ChatUI.tsx`)

```typescript
import React, { useState, useRef, useEffect } from 'react';

interface Message {
    username: string;
    message: string;
    timestamp: number;
}

interface ChatUIProps {
    messages: Message[];
    onSendMessage: (message: string) => void;
}

const ChatUI: React.FC<ChatUIProps> = ({ messages, onSendMessage }) => {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            onSendMessage(input);
            setInput('');
        }
    };

    return (
        <div style={{ position: 'absolute', bottom: 10, left: 10, width: '300px', background: 'rgba(0,0,0,0.7)', padding: '10px', borderRadius: '5px' }}>
            <div style={{ height: '150px', overflowY: 'auto', marginBottom: '10px' }}>
                {messages.map((msg, i) => (
                    <div key={i} style={{ color: 'white', marginBottom: '5px' }}>
                        <strong>{msg.username}:</strong> {msg.message}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type message..."
                    style={{ width: '100%', padding: '5px' }}
                />
            </form>
        </div>
    );
};

export default ChatUI;
```

---

## 10. Woodcutting & Skills

### Tree Class (`client/src/game/Tree.ts`)

```typescript
import * as BABYLON from '@babylonjs/core';

export interface TreeData {
    id: string;
    position: { x: number; z: number };
    health: number;
    maxHealth: number;
    isAlive: boolean;
}

export class Tree {
    private scene: BABYLON.Scene;
    private id: string;
    private trunk?: BABYLON.Mesh;
    private leaves?: BABYLON.Mesh;
    private health: number;
    private isAlive: boolean;

    constructor(scene: BABYLON.Scene, treeData: TreeData) {
        this.scene = scene;
        this.id = treeData.id;
        this.health = treeData.health;
        this.isAlive = treeData.isAlive;

        if (this.isAlive) {
            this.createTreeMesh(treeData.position);
        }
    }

    private createTreeMesh(position: { x: number; z: number }): void {
        // Trunk
        this.trunk = BABYLON.MeshBuilder.CreateCylinder(`trunk_${this.id}`, { height: 3, diameter: 0.5 }, this.scene);
        this.trunk.position = new BABYLON.Vector3(position.x, 1.5, position.z);
        this.trunk.checkCollisions = true;
        this.trunk.metadata = { type: 'tree', treeId: this.id };

        const trunkMat = new BABYLON.StandardMaterial('trunkMat', this.scene);
        trunkMat.diffuseColor = new BABYLON.Color3(0.4, 0.25, 0.1);
        this.trunk.material = trunkMat;

        // Leaves
        this.leaves = BABYLON.MeshBuilder.CreateCylinder(`leaves_${this.id}`, { height: 2.5, diameterTop: 0, diameterBottom: 2 }, this.scene);
        this.leaves.position = new BABYLON.Vector3(position.x, 4, position.z);

        const leavesMat = new BABYLON.StandardMaterial('leavesMat', this.scene);
        leavesMat.diffuseColor = new BABYLON.Color3(0.2, 0.6, 0.2);
        this.leaves.material = leavesMat;
    }

    public shake(): void {
        if (!this.trunk || !this.leaves) return;

        const originalRotation = this.trunk.rotation.clone();
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            if (elapsed > 400) {
                this.trunk!.rotation = originalRotation;
                this.leaves!.rotation = originalRotation;
                return;
            }

            const progress = elapsed / 400;
            const intensity = 0.05 * (1 - progress);
            const shake = Math.sin(elapsed * 0.05) * intensity;

            this.trunk!.rotation.x = originalRotation.x + shake;
            this.leaves!.rotation.x = originalRotation.x + shake;

            requestAnimationFrame(animate);
        };

        animate();
    }

    public update(treeData: TreeData): void {
        this.health = treeData.health;
        this.isAlive = treeData.isAlive;

        if (!this.isAlive && this.trunk) {
            // Tree died - remove it
            this.trunk.dispose();
            this.leaves?.dispose();
            this.trunk = undefined;
            this.leaves = undefined;
        }
    }

    public dispose(): void {
        this.trunk?.dispose();
        this.leaves?.dispose();
    }
}
```

### Server-Side Tree Handler (`server/src/game/handlers/TreeHandler.ts`)

```typescript
import { Socket } from 'socket.io';

interface TreeState {
    id: string;
    health: number;
    isAlive: boolean;
}

export class TreeHandler {
    private trees: Map<string, TreeState> = new Map();

    constructor() {
        // Initialize 20 trees
        for (let i = 0; i < 20; i++) {
            this.trees.set(`tree_${i}`, {
                id: `tree_${i}`,
                health: 100,
                isAlive: true
            });
        }
    }

    public handleTreeChop(socket: Socket, data: { treeId: string }): void {
        const tree = this.trees.get(data.treeId);
        if (!tree || !tree.isAlive) return;

        // Reduce health
        tree.health -= 10;

        // Broadcast shake animation
        socket.broadcast.emit('treeShake', { treeId: data.treeId });

        if (tree.health <= 0) {
            tree.health = 0;
            tree.isAlive = false;

            // Broadcast tree died
            socket.emit('treeUpdate', tree);
            socket.broadcast.emit('treeUpdate', tree);

            // Reward player
            socket.emit('woodcuttingReward', { logs: 1, xp: 25, treeId: data.treeId });

            // Respawn tree after 30 seconds
            setTimeout(() => {
                tree.health = 100;
                tree.isAlive = true;
                socket.emit('treeUpdate', tree);
                socket.broadcast.emit('treeUpdate', tree);
            }, 30000);
        } else {
            // Broadcast health update
            socket.emit('treeUpdate', tree);
            socket.broadcast.emit('treeUpdate', tree);
        }
    }

    public getAllTrees(): TreeState[] {
        return Array.from(this.trees.values());
    }
}
```

---

## 11. Trading System

### Trade System Overview

The trading system allows two players to exchange items in real-time:

1. Player A right-clicks Player B and selects "Trade"
2. Trade request sent to Player B
3. Player B accepts/declines
4. Both players add items to trade window
5. Both players must accept before trade completes

### Server-Side Trade Handler

```typescript
// Add to GameServer.ts
socket.on('tradeRequest', (data: { targetPlayerId: string }) => {
    const requester = this.players.get(socket.id);
    const target = this.players.get(data.targetPlayerId);

    if (requester && target) {
        this.io.to(data.targetPlayerId).emit('tradeRequest', {
            fromPlayerId: socket.id,
            fromPlayerName: requester.username
        });
    }
});

socket.on('tradeResponse', (data: { requesterId: string; accepted: boolean }) => {
    if (data.accepted) {
        this.io.to(data.requesterId).emit('tradeAccepted', { playerId: socket.id });
    } else {
        this.io.to(data.requesterId).emit('tradeDeclined', { playerId: socket.id });
    }
});

socket.on('tradeUpdate', (data: { targetPlayerId: string; offeredItems: any[] }) => {
    this.io.to(data.targetPlayerId).emit('tradeUpdate', {
        fromPlayerId: socket.id,
        offeredItems: data.offeredItems
    });
});
```

### Client-Side Trade Window Component

```typescript
// TradeWindow.tsx
interface TradeWindowProps {
    otherPlayerName: string;
    myItems: any[];
    theirItems: any[];
    onAddItem: (item: any) => void;
    onAccept: () => void;
    onDecline: () => void;
}

const TradeWindow: React.FC<TradeWindowProps> = ({ otherPlayerName, myItems, theirItems, onAddItem, onAccept, onDecline }) => {
    return (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#333', padding: '20px', borderRadius: '8px', color: 'white' }}>
            <h3>Trading with {otherPlayerName}</h3>
            
            <div style={{ display: 'flex', gap: '20px' }}>
                <div>
                    <h4>Your Offer</h4>
                    {myItems.map((item, i) => <div key={i}>{item.name} x{item.quantity}</div>)}
                </div>
                
                <div>
                    <h4>Their Offer</h4>
                    {theirItems.map((item, i) => <div key={i}>{item.name} x{item.quantity}</div>)}
                </div>
            </div>
            
            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                <button onClick={onAccept}>Accept Trade</button>
                <button onClick={onDecline}>Decline</button>
            </div>
        </div>
    );
};
```

---

## 12. World Building

### Creating Structures

```typescript
// Add to Game.tsx
private createCastle(): void {
    const castlePosition = new BABYLON.Vector3(80, 0, 80);
    const wallMaterial = new BABYLON.StandardMaterial('wallMat', this.scene);
    wallMaterial.diffuseColor = new BABYLON.Color3(0.6, 0.6, 0.65);

    // North wall
    const northWall = BABYLON.MeshBuilder.CreateBox('northWall', { width: 40, height: 15, depth: 2 }, this.scene);
    northWall.position = castlePosition.add(new BABYLON.Vector3(0, 7.5, 20));
    northWall.material = wallMaterial;
    northWall.checkCollisions = true;

    // South wall
    const southWall = BABYLON.MeshBuilder.CreateBox('southWall', { width: 40, height: 15, depth: 2 }, this.scene);
    southWall.position = castlePosition.add(new BABYLON.Vector3(0, 7.5, -20));
    southWall.material = wallMaterial;
    southWall.checkCollisions = true;

    // East wall
    const eastWall = BABYLON.MeshBuilder.CreateBox('eastWall', { width: 2, height: 15, depth: 40 }, this.scene);
    eastWall.position = castlePosition.add(new BABYLON.Vector3(20, 7.5, 0));
    eastWall.material = wallMaterial;
    eastWall.checkCollisions = true;

    // West wall (with gate)
    const westWallLeft = BABYLON.MeshBuilder.CreateBox('westWallLeft', { width: 2, height: 15, depth: 15 }, this.scene);
    westWallLeft.position = castlePosition.add(new BABYLON.Vector3(-20, 7.5, 12.5));
    westWallLeft.material = wallMaterial;
    westWallLeft.checkCollisions = true;

    const westWallRight = BABYLON.MeshBuilder.CreateBox('westWallRight', { width: 2, height: 15, depth: 15 }, this.scene);
    westWallRight.position = castlePosition.add(new BABYLON.Vector3(-20, 7.5, -12.5));
    westWallRight.material = wallMaterial;
    westWallRight.checkCollisions = true;

    // Towers at corners
    const towers = [
        new BABYLON.Vector3(20, 10, 20),
        new BABYLON.Vector3(20, 10, -20),
        new BABYLON.Vector3(-20, 10, 20),
        new BABYLON.Vector3(-20, 10, -20)
    ];

    towers.forEach((offset, i) => {
        const tower = BABYLON.MeshBuilder.CreateCylinder(`tower${i}`, { diameter: 6, height: 20 }, this.scene);
        tower.position = castlePosition.add(offset);
        tower.material = wallMaterial;
        tower.checkCollisions = true;

        // Tower roof
        const roof = BABYLON.MeshBuilder.CreateCylinder(`roof${i}`, { diameterTop: 0, diameterBottom: 7, height: 3 }, this.scene);
        roof.position = castlePosition.add(offset).add(new BABYLON.Vector3(0, 11.5, 0));
        const roofMat = new BABYLON.StandardMaterial('roofMat', this.scene);
        roofMat.diffuseColor = new BABYLON.Color3(0.6, 0.3, 0.2);
        roof.material = roofMat;
    });
}

private createVillage(): void {
    const villageCenter = new BABYLON.Vector3(-20, 0, 0);
    const housePositions = [
        { x: 0, z: 15 }, { x: 10, z: 10 }, { x: 15, z: 0 }, { x: 10, z: -10 },
        { x: 0, z: -15 }, { x: -10, z: -10 }, { x: -15, z: 0 }, { x: -10, z: 10 }
    ];

    housePositions.forEach((pos, i) => {
        this.createHouse(villageCenter.add(new BABYLON.Vector3(pos.x, 0, pos.z)), i);
    });

    // Central well
    const well = BABYLON.MeshBuilder.CreateCylinder('well', { diameter: 3, height: 2 }, this.scene);
    well.position = villageCenter.add(new BABYLON.Vector3(0, 1, 0));
    well.checkCollisions = true;
}

private createHouse(position: BABYLON.Vector3, index: number): void {
    // House body
    const body = BABYLON.MeshBuilder.CreateBox(`house${index}`, { width: 8, height: 6, depth: 8 }, this.scene);
    body.position = position.add(new BABYLON.Vector3(0, 3, 0));
    body.checkCollisions = true;

    const bodyMat = new BABYLON.StandardMaterial(`houseMat${index}`, this.scene);
    bodyMat.diffuseColor = new BABYLON.Color3(0.8, 0.7, 0.5);
    body.material = bodyMat;

    // Roof
    const roof = BABYLON.MeshBuilder.CreateCylinder(`roof${index}`, { diameterTop: 0, diameterBottom: 11, height: 4 }, this.scene);
    roof.position = position.add(new BABYLON.Vector3(0, 8, 0));
    roof.rotation.x = 0;

    const roofMat = new BABYLON.StandardMaterial(`roofMat${index}`, this.scene);
    roofMat.diffuseColor = new BABYLON.Color3(0.6, 0.3, 0.2);
    roof.material = roofMat;
}
```

---

## 13. UI Components

### Game UI Component

```typescript
// GameUI.tsx - Shows skills, inventory, health
interface GameUIProps {
    health: number;
    maxHealth: number;
    skills: Array<{ name: string; level: number; xp: number; nextLevelXp: number }>;
    inventory: Array<{ id: string; name: string; quantity: number }>;
}

const GameUI: React.FC<GameUIProps> = ({ health, maxHealth, skills, inventory }) => {
    return (
        <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.7)', padding: '15px', borderRadius: '8px', color: 'white', minWidth: '200px' }}>
            {/* Health Bar */}
            <div style={{ marginBottom: '15px' }}>
                <div style={{ fontSize: '12px', marginBottom: '5px' }}>Health: {health}/{maxHealth}</div>
                <div style={{ width: '100%', height: '20px', background: '#333', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${(health / maxHealth) * 100}%`, height: '100%', background: 'green', transition: 'width 0.3s' }} />
                </div>
            </div>

            {/* Skills */}
            <div style={{ marginBottom: '15px' }}>
                <h4 style={{ margin: '0 0 10px 0' }}>Skills</h4>
                {skills.map((skill, i) => (
                    <div key={i} style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '12px' }}>{skill.name} - Level {skill.level}</div>
                        <div style={{ width: '100%', height: '10px', background: '#333', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${(skill.xp / skill.nextLevelXp) * 100}%`, height: '100%', background: 'blue' }} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Inventory */}
            <div>
                <h4 style={{ margin: '0 0 10px 0' }}>Inventory</h4>
                {inventory.length === 0 ? (
                    <div style={{ fontSize: '12px', color: '#888' }}>Empty</div>
                ) : (
                    inventory.map((item, i) => (
                        <div key={i} style={{ fontSize: '12px', marginBottom: '5px' }}>
                            {item.name} x{item.quantity}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
```

---

## 14. Testing & Deployment

### Running Locally

```bash
# Terminal 1 - Start PostgreSQL
# Make sure PostgreSQL is running

# Terminal 2 - Start backend server
cd server
npm run dev

# Terminal 3 - Start frontend
cd client
npm run dev
```

### Production Build

```bash
# Backend
cd server
npm run build
npm start

# Frontend
cd client
npm run build
# Serve the dist/ folder with a static file server
```

### Environment Variables

Create `.env` files for production:

**server/.env**
```
DATABASE_URL=postgresql://user:password@localhost:5432/sacred_heart
JWT_SECRET=your-secure-random-secret
PORT=3000
```

**client/.env.production**
```
VITE_API_URL=https://your-server.com
```

### Deployment Options

1. **Backend**: Deploy to Heroku, Railway, or DigitalOcean
2. **Frontend**: Deploy to Vercel, Netlify, or Cloudflare Pages
3. **Database**: Use managed PostgreSQL (Heroku Postgres, Supabase, etc.)

---

## Key Concepts Learned

### 1. **Babylon.js 3D Engine**
- Scene management
- Mesh creation and materials
- Camera controls
- Collision detection
- Physics (gravity, jumping)
- Raycasting for ground detection

### 2. **Socket.IO Real-Time Networking**
- Bidirectional event-based communication
- Room management for multiplayer
- Event broadcasting vs targeted emits
- Authentication with JWT tokens

### 3. **React State Management**
- Functional setState to avoid closure issues
- useRef for mutable game instance
- useEffect for lifecycle management
- Prop drilling vs context

### 4. **Game Architecture Patterns**
- Separation of concerns (handlers)
- Entity-component pattern
- Client-server synchronization
- Optimistic updates vs server authority

### 5. **Database Design**
- Relational data modeling
- Foreign keys and cascading
- Indexing for performance
- Transaction handling

---

## Next Steps & Extensions

### Beginner Enhancements
- Add more 3D models from Mixamo
- Create different tree types
- Add sound effects
- Implement day/night cycle

### Intermediate Features
- Combat system with health bars
- Quest system
- NPC merchants
- Guilds/clans

### Advanced Systems
- Procedural world generation
- Instanced dungeons
- Crafting system
- Pet/mount system
- Server-side anti-cheat

---

## Common Issues & Solutions

### Issue: Players not syncing
**Solution**: Check Socket.IO connection, verify JWT token, ensure database is running

### Issue: Collision detection not working
**Solution**: Set `checkCollisions = true` on meshes, verify ellipsoid size

### Issue: Tree shake not visible to other players
**Solution**: Ensure treeShake event is broadcast via Socket.IO, verify tree IDs match

### Issue: Performance issues with many players
**Solution**: Implement spatial partitioning, reduce update frequency, use LOD (Level of Detail)

---

## Resources

- **Babylon.js Docs**: https://doc.babylonjs.com/
- **Socket.IO Docs**: https://socket.io/docs/
- **PostgreSQL Tutorial**: https://www.postgresqltutorial.com/
- **React TypeScript**: https://react-typescript-cheatsheet.netlify.app/
- **3D Models**: https://www.mixamo.com/

---

## Conclusion

You've now learned how to build a complete multiplayer 3D MMORPG from scratch! This project covers:

✅ Full-stack TypeScript development  
✅ Real-time multiplayer networking  
✅ 3D graphics with Babylon.js  
✅ Database design and management  
✅ Authentication and security  
✅ Game systems (skills, trading, combat)  
✅ UI/UX design  

The codebase you have is a solid foundation. Study each system, experiment with modifications, and build on top of it. Game development is an iterative process - start simple, test often, and gradually add complexity.

Happy coding! 🎮
