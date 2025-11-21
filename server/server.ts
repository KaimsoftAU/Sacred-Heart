import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, MONGODB_URI, PORT } from './src/config/env';
import authRoutes from './src/routes/auth';
import verifyRoutes from './src/routes/verify';
import { Player as PlayerModel } from './src/models/Player';

console.log('JWT_SECRET loaded:', JWT_SECRET ? 'Yes' : 'No');
console.log('JWT_SECRET value:', JWT_SECRET);

interface Player {
  id: string;
  username?: string;
  userId?: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
}

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });

// Setup Express
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth', verifyRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  allowEIO3: true
});

const players: Map<string, Player> = new Map();

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    console.error('No token provided in socket connection');
    return next(new Error('Authentication error: No token provided'));
  }

  console.log('Attempting to verify token...');
  console.log('Token preview:', token.substring(0, 20) + '...');

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    socket.data.userId = decoded.id;
    socket.data.username = decoded.username;
    console.log('Socket authenticated for user:', decoded.username);
    next();
  } catch (err: any) {
    console.error('Socket authentication failed:', err.message);
    console.error('JWT_SECRET being used:', JWT_SECRET.substring(0, 10) + '...');
    return next(new Error('Authentication error: Invalid token'));
  }
});

io.on('connection', async (socket) => {
  console.log(`Player connected: ${socket.id}, User: ${socket.data.username}`);
  
  // Get player data from database
  const dbPlayer = await PlayerModel.findById(socket.data.userId);
  
  const playerData: Player = {
    id: socket.id,
    username: socket.data.username,
    userId: socket.data.userId,
    position: dbPlayer?.position || { x: 0, y: 0, z: 0 },
    rotation: dbPlayer?.rotation || { x: 0, y: 0, z: 0 }
  };
  
  players.set(socket.id, playerData);

  // Send welcome message with player data
  socket.emit('welcome', {
    message: 'Welcome to Sacred Heart Game Server',
    playerId: socket.id,
    connectedPlayers: players.size,
    playerData: playerData
  });

  // Send existing players to new player
  const existingPlayers = Array.from(players.values()).filter(p => p.id !== socket.id);
  if (existingPlayers.length > 0) {
    socket.emit('playersUpdate', existingPlayers);
  }

  // Notify others about new player
  socket.broadcast.emit('playerJoined', {
    playerId: socket.id,
    username: socket.data.username,
    totalPlayers: players.size,
    playerData: playerData
  });

  // Handle player movement
  socket.on('playerMove', (data: { position: any; rotation: any }) => {
    const player = players.get(socket.id);
    if (player) {
      player.position = data.position;
      player.rotation = data.rotation;

      // Broadcast to other players
      socket.broadcast.emit('playerMove', {
        id: socket.id,
        username: player.username,
        position: data.position,
        rotation: data.rotation
      });
    }
  });

  // Handle player messages
  socket.on('message', (data) => {
    console.log(`[${socket.data.username}]: ${data}`);
    // Broadcast to all OTHER players (not the sender)
    socket.broadcast.emit('playerMessage', {
      playerId: socket.id,
      username: socket.data.username,
      message: data
    });
  });

  // Handle player name update (deprecated, username comes from auth)
  socket.on('setName', (name: string) => {
    const player = players.get(socket.id);
    if (player) {
      console.log(`Player ${socket.id} tried to set name to: ${name} (ignored, using authenticated username)`);
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    console.log(`Player disconnected: ${socket.id}`);
    
    // Save final position to database
    const player = players.get(socket.id);
    if (player && player.userId) {
      try {
        await PlayerModel.findByIdAndUpdate(player.userId, {
          position: player.position,
          rotation: player.rotation
        });
      } catch (error) {
        console.error('Error saving player position on disconnect:', error);
      }
    }
    
    players.delete(socket.id);
    socket.broadcast.emit('playerLeft', {
      playerId: socket.id,
      totalPlayers: players.size
    });
  });
});

httpServer.listen(PORT, () => {
  console.log(`Sacred Heart Game Server is running on port ${PORT}`);
  console.log(`WebSocket server ready for connections`);
});
