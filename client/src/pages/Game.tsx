import React, { useState, useRef } from 'react';
import GameClass from '../game/Game';
import ChatUI from '../components/ChatUI';
import { PlayerInfoUI } from '../game/components/PlayerInfoUI';
import { GameUI } from '../game/components/GameUI';
import { ContextMenu } from '../game/components/ContextMenu';
import { TradeWindow } from '../game/components/TradeWindow';
import { TradeRequestNotification } from '../game/components/TradeRequestNotification';
import { getXpForNextLevel } from '../game/utils/skillUtils';
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
        woodcuttingLevel: number;
    } | null>(null);

    // State: Skills and inventory for GameUI
    const [skills, setSkills] = useState([
        { name: 'Woodcutting', level: 1, xp: 0, nextLevelXp: 100 }
    ]);
    
    const [inventory, setInventory] = useState<Array<{ id: string; name: string; quantity: number }>>([]);

    // State: Context menu for player right-click
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        playerId: string;
        playerName: string;
    } | null>(null);

    // State: Trade window
    const [tradeWindow, setTradeWindow] = useState<{
        otherPlayerId: string;
        otherPlayerName: string;
        myOfferedItems: Array<{ id: string; name: string; quantity: number }>;
        theirOfferedItems: Array<{ id: string; name: string; quantity: number }>;
        myAccepted: boolean;
        theirAccepted: boolean;
    } | null>(null);

    // State: Trade request notification
    const [tradeRequest, setTradeRequest] = useState<{
        fromPlayerId: string;
        fromPlayerName: string;
    } | null>(null);

    // Update skills periodically from game instance
    React.useEffect(() => {
        const interval = setInterval(() => {
            if (gameInstanceRef.current) {
                const woodcuttingHandler = gameInstanceRef.current.getWoodcuttingHandler();
                const level = woodcuttingHandler.getWoodcuttingLevel();
                const xp = woodcuttingHandler.getWoodcuttingXP();
                const logs = woodcuttingHandler.getLogsCollected();
                
                setSkills([{
                    name: 'Woodcutting',
                    level,
                    xp,
                    nextLevelXp: getXpForNextLevel(level)
                }]);

                // Update logs in inventory
                if (logs > 0) {
                    setInventory([{ id: 'logs', name: 'Logs', quantity: logs }]);
                } else {
                    setInventory([]);
                }
            }
        }, 500); // Update twice per second

        return () => clearInterval(interval);
    }, []);

    /**
     * Effect: Initialize the Babylon.js game instance when component mounts
     * Creates game with:
     * - Canvas element ID to render to
     * - Player data for positioning and identification
     * - JWT token for WebSocket authentication
     * - Callback to receive messages from other players
     * - Trade callbacks
     */
    React.useEffect(() => {
        const GameInstance = new GameClass(
            'GameCanvas',
            player,
            token,
            (msg) => {
                // When other players send messages, add them to our chat UI
                setMessages(prev => [...prev, msg]);
            },
            (playerData: { name: string; health: number; maxHealth: number; mesh: BABYLON.Mesh | null; woodcuttingLevel: number } | null) => {
                // When a player is selected, update UI
                setSelectedPlayer(playerData);
            },
            (playerData: { id: string; name: string; x: number; y: number }) => {
                // When a player is right-clicked, show context menu
                setContextMenu({
                    x: playerData.x,
                    y: playerData.y,
                    playerId: playerData.id,
                    playerName: playerData.name
                });
            },
            (fromPlayerId: string, fromPlayerName: string) => {
                // When receiving a trade request
                console.log(`Received trade request from ${fromPlayerName}`);
                setTradeRequest({ fromPlayerId, fromPlayerName });
            },
            (fromPlayerId: string, fromPlayerName: string, accepted: boolean) => {
                // When trade request is responded to
                console.log(`Trade response from ${fromPlayerName}: ${accepted ? 'accepted' : 'declined'}`);
                if (accepted) {
                    // Open trade window
                    setTradeWindow({
                        otherPlayerId: fromPlayerId,
                        otherPlayerName: fromPlayerName,
                        myOfferedItems: [],
                        theirOfferedItems: [],
                        myAccepted: false,
                        theirAccepted: false
                    });
                } else {
                    alert(`${fromPlayerName} declined your trade request`);
                }
            },
            (fromPlayerId: string, offeredItems: any[]) => {
                // When trade offer updates
                console.log(`Trade updated from player ${fromPlayerId}`, offeredItems);
                setTradeWindow(currentTradeWindow => {
                    if (currentTradeWindow && currentTradeWindow.otherPlayerId === fromPlayerId) {
                        return {
                            ...currentTradeWindow,
                            theirOfferedItems: offeredItems,
                            theirAccepted: false // Reset acceptance when offer changes
                        };
                    }
                    return currentTradeWindow;
                });
            },
            (fromPlayerId: string) => {
                // When other player accepts
                console.log(`Player ${fromPlayerId} accepted trade`);
                setTradeWindow(currentTradeWindow => {
                    if (currentTradeWindow && currentTradeWindow.otherPlayerId === fromPlayerId) {
                        const newTradeWindow = {
                            ...currentTradeWindow,
                            theirAccepted: true
                        };
                        
                        // If both accepted, complete trade
                        if (currentTradeWindow.myAccepted) {
                            setTimeout(() => {
                                alert('Trade complete!');
                                setTradeWindow(null);
                            }, 1000);
                        }
                        
                        return newTradeWindow;
                    }
                    return currentTradeWindow;
                });
            },
            (fromPlayerId: string) => {
                // When other player declines
                console.log(`Player ${fromPlayerId} declined trade`);
                setTradeWindow(currentTradeWindow => {
                    if (currentTradeWindow && currentTradeWindow.otherPlayerId === fromPlayerId) {
                        alert('Trade declined by other player');
                        return null;
                    }
                    return currentTradeWindow;
                });
            }
        );
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

    // Handler: Inspect player (left-click from context menu)
    const handleInspectPlayer = () => {
        if (contextMenu && gameInstanceRef.current) {
            const playerHandler = (gameInstanceRef.current as any).playerHandler;
            const woodcuttingHandler = gameInstanceRef.current.getWoodcuttingHandler();
            const targetPlayer = playerHandler.getRemotePlayer(contextMenu.playerId);
            
            if (targetPlayer) {
                setSelectedPlayer({
                    name: targetPlayer.getUsername() || 'Unknown Player',
                    health: targetPlayer.getHealth(),
                    maxHealth: targetPlayer.getMaxHealth(),
                    mesh: targetPlayer.getMesh(),
                    woodcuttingLevel: woodcuttingHandler.getWoodcuttingLevel()
                });
            }
        }
        setContextMenu(null);
    };

    // Handler: Initiate trade with player
    const handleTradePlayer = () => {
        if (contextMenu && gameInstanceRef.current) {
            console.log(`Sending trade request to ${contextMenu.playerName}`);
            gameInstanceRef.current.getTradeHandler().requestTrade(contextMenu.playerId);
        }
        setContextMenu(null);
    };

    // Handler: Accept incoming trade request
    const handleAcceptTradeRequest = () => {
        if (tradeRequest && gameInstanceRef.current) {
            console.log(`Accepting trade request from ${tradeRequest.fromPlayerName}`);
            gameInstanceRef.current.getTradeHandler().respondToTradeRequest(tradeRequest.fromPlayerId, true);
            
            // Open trade window
            setTradeWindow({
                otherPlayerId: tradeRequest.fromPlayerId,
                otherPlayerName: tradeRequest.fromPlayerName,
                myOfferedItems: [],
                theirOfferedItems: [],
                myAccepted: false,
                theirAccepted: false
            });
            
            setTradeRequest(null);
        }
    };

    // Handler: Decline incoming trade request
    const handleDeclineTradeRequest = () => {
        if (tradeRequest && gameInstanceRef.current) {
            console.log(`Declining trade request from ${tradeRequest.fromPlayerName}`);
            gameInstanceRef.current.getTradeHandler().respondToTradeRequest(tradeRequest.fromPlayerId, false);
            setTradeRequest(null);
        }
    };

    // Handler: Add item to trade
    const handleAddItemToTrade = (itemId: string, quantity: number) => {
        if (tradeWindow && gameInstanceRef.current) {
            const item = inventory.find(i => i.id === itemId);
            if (item && item.quantity >= quantity) {
                const existingItem = tradeWindow.myOfferedItems.find(i => i.id === itemId);
                let newOfferedItems;
                
                if (existingItem) {
                    // Update quantity
                    newOfferedItems = tradeWindow.myOfferedItems.map(i =>
                        i.id === itemId ? { ...i, quantity: i.quantity + quantity } : i
                    );
                } else {
                    // Add new item
                    newOfferedItems = [...tradeWindow.myOfferedItems, { id: itemId, name: item.name, quantity }];
                }
                
                setTradeWindow({
                    ...tradeWindow,
                    myOfferedItems: newOfferedItems,
                    myAccepted: false // Reset acceptance when offer changes
                });
                
                // Send update to server
                gameInstanceRef.current.getTradeHandler().updateTradeOffer(tradeWindow.otherPlayerId, newOfferedItems);
            }
        }
    };

    // Handler: Remove item from trade
    const handleRemoveItemFromTrade = (itemId: string) => {
        if (tradeWindow && gameInstanceRef.current) {
            const newOfferedItems = tradeWindow.myOfferedItems.filter(i => i.id !== itemId);
            
            setTradeWindow({
                ...tradeWindow,
                myOfferedItems: newOfferedItems,
                myAccepted: false // Reset acceptance when offer changes
            });
            
            // Send update to server
            gameInstanceRef.current.getTradeHandler().updateTradeOffer(tradeWindow.otherPlayerId, newOfferedItems);
        }
    };

    // Handler: Accept trade
    const handleAcceptTrade = () => {
        if (tradeWindow && gameInstanceRef.current) {
            setTradeWindow({
                ...tradeWindow,
                myAccepted: true
            });

            // Send acceptance to server
            gameInstanceRef.current.getTradeHandler().acceptTrade(tradeWindow.otherPlayerId);
            
            // If both accepted, complete trade
            if (tradeWindow.theirAccepted) {
                setTimeout(() => {
                    alert('Trade complete!');
                    setTradeWindow(null);
                }, 1000);
            }
        }
    };

    // Handler: Decline trade
    const handleDeclineTrade = () => {
        if (tradeWindow && gameInstanceRef.current) {
            // Send trade decline to server
            gameInstanceRef.current.getTradeHandler().declineTrade(tradeWindow.otherPlayerId);
            setTradeWindow(null);
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
          woodcuttingLevel={selectedPlayer.woodcuttingLevel}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
      {tradeRequest && (
        <TradeRequestNotification
          fromPlayerName={tradeRequest.fromPlayerName}
          onAccept={handleAcceptTradeRequest}
          onDecline={handleDeclineTradeRequest}
        />
      )}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          options={[
            {
              label: 'Inspect',
              icon: '👁️',
              onClick: handleInspectPlayer
            },
            {
              label: 'Trade',
              icon: '🤝',
              onClick: handleTradePlayer
            }
          ]}
          onClose={() => setContextMenu(null)}
        />
      )}
      {tradeWindow && (
        <TradeWindow
          otherPlayerName={tradeWindow.otherPlayerName}
          myInventory={inventory}
          myOfferedItems={tradeWindow.myOfferedItems}
          theirOfferedItems={tradeWindow.theirOfferedItems}
          myAccepted={tradeWindow.myAccepted}
          theirAccepted={tradeWindow.theirAccepted}
          onAddItem={handleAddItemToTrade}
          onRemoveItem={handleRemoveItemFromTrade}
          onAccept={handleAcceptTrade}
          onDecline={handleDeclineTrade}
          onClose={() => setTradeWindow(null)}
        />
      )}
      <GameUI skills={skills} inventory={inventory} />
    </div>
  );
};

export default Game;
