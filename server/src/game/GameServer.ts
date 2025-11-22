import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env';
import { Player as PlayerModel } from '../models/Player';
import { TreeHandler } from './handlers/TreeHandler.js';

/**
 * Player interface for connected players
 */
interface Player {
  id: string;
  username?: string;
  userId?: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
}

/**
 * GameServer Class - WebSocket Game Server
 * 
 * Handles:
 * - Socket.IO connections with JWT authentication
 * - Player state management (position, rotation)
 * - Real-time multiplayer synchronization
 * - Player join/leave events
 * - Chat messages
 * - Tree/woodcutting system (delegated to TreeHandler)
 */
export class GameServer {
  private io: Server;
  private players: Map<string, Player>;
  private treeHandler: TreeHandler;

  /**
   * Constructor: Initialize game server
   * @param io - Socket.IO server instance
   */
  constructor(io: Server) {
    this.io = io;
    this.players = new Map<string, Player>();
    this.treeHandler = new TreeHandler(io);
    
    this.setupAuthentication();
    this.setupConnectionHandlers();
  }

  /**
   * Setup JWT authentication middleware for Socket.IO
   */
  private setupAuthentication(): void {
    this.io.use(async (socket, next) => {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        console.error('[GameServer] No token provided in socket connection');
        return next(new Error('Authentication error: No token provided'));
      }

      console.log('[GameServer] Attempting to verify token...');

      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        socket.data.userId = decoded.id;
        socket.data.username = decoded.username;
        
        console.log(`[GameServer] Token verified for user: ${decoded.username}`);
        next();
      } catch (error) {
        console.error('[GameServer] Token verification failed:', error);
        return next(new Error('Authentication error: Invalid token'));
      }
    });
  }

  /**
   * Setup connection event handlers
   */
  private setupConnectionHandlers(): void {
    this.io.on('connection', async (socket) => {
      console.log(`[GameServer] Player connected: ${socket.id}, User: ${socket.data.username}`);
      
      // Get player data from database
      const dbPlayer = await PlayerModel.findById(socket.data.userId);
      
      const playerData: Player = {
        id: socket.id,
        username: socket.data.username,
        userId: socket.data.userId,
        position: dbPlayer?.position || { x: 0, y: 0, z: 0 },
        rotation: dbPlayer?.rotation || { x: 0, y: 0, z: 0 }
      };
      
      this.players.set(socket.id, playerData);

      // Send welcome message with player data
      socket.emit('welcome', {
        message: 'Welcome to Sacred Heart Game Server',
        playerId: socket.id,
        connectedPlayers: this.players.size,
        playerData: playerData
      });

      // Send existing players to new player
      const existingPlayers = Array.from(this.players.values()).filter(p => p.id !== socket.id);
      if (existingPlayers.length > 0) {
        socket.emit('playersUpdate', existingPlayers);
      }

      // Send all tree states to new player
      socket.emit('treesUpdate', this.treeHandler.getAllTreeStates());

      // Notify others about new player
      socket.broadcast.emit('playerJoined', {
        playerId: socket.id,
        username: socket.data.username,
        totalPlayers: this.players.size,
        playerData: playerData
      });

      // Setup event handlers for this player
      this.setupPlayerHandlers(socket);
    });
  }

  /**
   * Setup event handlers for a connected player
   * @param socket - Player's socket connection
   */
  private setupPlayerHandlers(socket: any): void {
    // Handle player movement
    socket.on('playerMove', (data: { position: any; rotation: any }) => {
      const player = this.players.get(socket.id);
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

    // Handle chat messages
    socket.on('message', (data: string) => {
      console.log(`[GameServer] [${socket.data.username}]: ${data}`);
      // Broadcast to all OTHER players (not the sender)
      socket.broadcast.emit('playerMessage', {
        playerId: socket.id,
        username: socket.data.username,
        message: data
      });
    });

    // Handle tree chopping - Delegate to TreeHandler
    socket.on('treeChop', (data: { treeId: string }) => {
      this.treeHandler.handleTreeChop(socket, data);
    });

    // Handle tree shake - Broadcast to other players
    socket.on('treeShake', (data: { treeId: string }) => {
      // Broadcast to all OTHER players (not the sender who already sees it)
      socket.broadcast.emit('treeShake', {
        treeId: data.treeId,
        playerId: socket.id
      });
    });

    // Handle trade request
    socket.on('tradeRequest', (data: { targetPlayerId: string }) => {
      const requester = this.players.get(socket.id);
      const target = this.players.get(data.targetPlayerId);
      
      if (requester && target) {
        console.log(`[GameServer] Trade request from ${requester.username} to ${target.username}`);
        // Send trade request to target player
        this.io.to(data.targetPlayerId).emit('tradeRequest', {
          fromPlayerId: socket.id,
          fromPlayerName: requester.username
        });
      }
    });

    // Handle trade response (accept/decline)
    socket.on('tradeResponse', (data: { requesterId: string; accepted: boolean }) => {
      const responder = this.players.get(socket.id);
      
      if (responder) {
        console.log(`[GameServer] Trade response from ${responder.username}: ${data.accepted ? 'accepted' : 'declined'}`);
        // Send response back to requester
        this.io.to(data.requesterId).emit('tradeResponse', {
          fromPlayerId: socket.id,
          fromPlayerName: responder.username,
          accepted: data.accepted
        });
      }
    });

    // Handle trade item update
    socket.on('tradeUpdate', (data: { otherPlayerId: string; offeredItems: any[] }) => {
      const player = this.players.get(socket.id);
      
      if (player) {
        console.log(`[GameServer] Trade update from ${player.username}`);
        // Send updated offer to other player
        this.io.to(data.otherPlayerId).emit('tradeUpdate', {
          fromPlayerId: socket.id,
          offeredItems: data.offeredItems
        });
      }
    });

    // Handle trade acceptance
    socket.on('tradeAccept', (data: { otherPlayerId: string }) => {
      const player = this.players.get(socket.id);
      
      if (player) {
        console.log(`[GameServer] Trade accepted by ${player.username}`);
        // Notify other player of acceptance
        this.io.to(data.otherPlayerId).emit('tradeAccept', {
          fromPlayerId: socket.id
        });
      }
    });

    // Handle trade decline/cancel
    socket.on('tradeDecline', (data: { otherPlayerId: string }) => {
      const player = this.players.get(socket.id);
      
      if (player) {
        console.log(`[GameServer] Trade declined by ${player.username}`);
        // Notify other player of decline
        this.io.to(data.otherPlayerId).emit('tradeDecline', {
          fromPlayerId: socket.id
        });
      }
    });

    // Handle player name update (deprecated, username comes from auth)
    socket.on('setName', (name: string) => {
      const player = this.players.get(socket.id);
      if (player) {
        console.log(`[GameServer] Player ${socket.id} tried to set name to: ${name} (ignored, using authenticated username)`);
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`[GameServer] Player disconnected: ${socket.id}`);
      
      // Save final position to database
      const player = this.players.get(socket.id);
      if (player && player.userId) {
        try {
          await PlayerModel.findByIdAndUpdate(player.userId, {
            position: player.position,
            rotation: player.rotation
          });
        } catch (error) {
          console.error('[GameServer] Error saving player position on disconnect:', error);
        }
      }
      
      this.players.delete(socket.id);
      socket.broadcast.emit('playerLeft', {
        playerId: socket.id,
        totalPlayers: this.players.size
      });
    });
  }

  /**
   * Get number of connected players
   */
  public getPlayerCount(): number {
    return this.players.size;
  }

  /**
   * Cleanup: Clear all game state
   */
  public cleanup(): void {
    this.treeHandler.cleanup();
    this.players.clear();
    console.log('[GameServer] Cleaned up game server');
  }
}
