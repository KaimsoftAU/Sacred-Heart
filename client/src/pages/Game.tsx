import React, { useState, useRef } from 'react';
import GameClass from '../game/Game';
import ChatUI from '../components/ChatUI';
import { PlayerInfoUI } from '../game/components/PlayerInfoUI';
import * as BABYLON from '@babylonjs/core';

// Props passed from App.tsx after successful login
interface GameProps {
  player: any;              // Player data from database (username, position, etc.)
  token: string;            // JWT token for authentication
  onLogout: () => void;     // Callback to handle logout
}

/**
 * Game Component - Main game page that hosts both the 3D game canvas and chat UI
 * This component:
 * 1. Creates and manages the Babylon.js game instance
 * 2. Manages chat message state
 * 3. Provides communication bridge between UI and game logic
 */
const Game: React.FC<GameProps> = ({ player, token, onLogout }) => {
    // State: Array of all chat messages to display in ChatUI
    const [messages, setMessages] = useState<Array<{ username: string; message: string; timestamp: number }>>([]);
    
    // Ref: Reference to the game instance so we can call methods on it
    const gameInstanceRef = useRef<GameClass | null>(null);

    // State: Selected player info for UI
    const [selectedPlayer, setSelectedPlayer] = useState<{
        name: string;
        health: number;
        maxHealth: number;
        mesh: BABYLON.Mesh | null;
    } | null>(null);

    /**
     * Effect: Initialize the Babylon.js game instance when component mounts
     * Creates game with:
     * - Canvas element ID to render to
     * - Player data for positioning and identification
     * - JWT token for WebSocket authentication
     * - Callback to receive messages from other players
     */
    React.useEffect(() => {
        const GameInstance = new GameClass('GameCanvas', player, token, (msg) => {
            // When other players send messages, add them to our chat UI
            setMessages(prev => [...prev, msg]);
        }, (playerData: { name: string; health: number; maxHealth: number; mesh: BABYLON.Mesh | null } | null) => {
            // When a player is selected, update UI
            setSelectedPlayer(playerData);
        });
        gameInstanceRef.current = GameInstance;
        
        // Cleanup: Dispose game resources when component unmounts
        return () => {
            GameInstance?.dispose();
        };
    }, []); // Empty dependency array = run once on mount

    /**
     * Handler: Send chat message
     * 1. Add message to local chat UI immediately (for instant feedback)
     * 2. Send to server which broadcasts to other players only
     * This prevents duplicate messages (we see ours immediately, others get it from server)
     */
    const handleSendMessage = (message: string) => {
        if (gameInstanceRef.current) {
            // Add own message to chat immediately
            setMessages(prev => [...prev, {
                username: player.username,
                message,
                timestamp: Date.now()
            }]);
            // Send to server via chat handler (server will broadcast to others only)
            gameInstanceRef.current.getChatHandler().sendMessage(message);
        }
    };
  return (
    <div>
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000 }}>
        <div style={{ background: 'rgba(0,0,0,0.7)', color: 'white', padding: '10px', borderRadius: '5px' }}>
          <p>Welcome, {player.username}!</p>
          <button onClick={onLogout} style={{ padding: '5px 10px', cursor: 'pointer' }}>
            Logout
          </button>
        </div>
      </div>
      <canvas id="GameCanvas" style={{ width: '100%', height: '100vh' }}>
      </canvas>
      <ChatUI 
        messages={messages} 
        onSendMessage={handleSendMessage}
        username={player.username}
      />
      {selectedPlayer && (
        <PlayerInfoUI
          playerName={selectedPlayer.name}
          health={selectedPlayer.health}
          maxHealth={selectedPlayer.maxHealth}
          playerMesh={selectedPlayer.mesh}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
};

export default Game;
