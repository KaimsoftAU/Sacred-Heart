import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { MONGODB_URI, PORT } from './src/config/env';
import app from './src/http/app';
import { GameServer } from './src/game/GameServer';

/**
 * Main Server Entry Point
 * 
 * Combines:
 * - Express HTTP API (authentication, REST endpoints)
 * - Socket.IO Game Server (real-time multiplayer)
 * 
 * Both share the same HTTP server instance but are logically separated
 */

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });

// Create HTTP server with Express app
const httpServer = createServer(app);

// Create Socket.IO server for game
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  allowEIO3: true
});

// Initialize Game Server
const gameServer = new GameServer(io);

// Start server
httpServer.listen(PORT, () => {
  console.log(`\n=================================`);
  console.log(`Sacred Heart Server Running`);
  console.log(`=================================`);
  console.log(`Port: ${PORT}`);
  console.log(`HTTP API: http://localhost:${PORT}/api`);
  console.log(`WebSocket: ws://localhost:${PORT}`);
  console.log(`=================================\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  gameServer.cleanup();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  gameServer.cleanup();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
