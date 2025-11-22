import React, { useState } from 'react';
import './TradeWindow.css';

interface TradeItem {
  id: string;
  name: string;
  quantity: number;
}

interface TradeWindowProps {
  otherPlayerName: string;
  myInventory: TradeItem[];
  myOfferedItems: TradeItem[];
  theirOfferedItems: TradeItem[];
  myAccepted: boolean;
  theirAccepted: boolean;
  onAddItem: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onAccept: () => void;
  onDecline: () => void;
  onClose: () => void;
}

export const TradeWindow: React.FC<TradeWindowProps> = ({
  otherPlayerName,
  myInventory,
  myOfferedItems,
  theirOfferedItems,
  myAccepted,
  theirAccepted,
  onAddItem,
  onRemoveItem,
  onAccept,
  onDecline,
  onClose
}) => {
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<string | null>(null);
  const [selectedOfferedItem, setSelectedOfferedItem] = useState<string | null>(null);

  const handleAddToTrade = () => {
    if (selectedInventoryItem) {
      const item = myInventory.find(i => i.id === selectedInventoryItem);
      if (item) {
        // For now, add 1 quantity. Could add quantity selector later
        onAddItem(item.id, 1);
        setSelectedInventoryItem(null);
      }
    }
  };

  const handleRemoveFromTrade = () => {
    if (selectedOfferedItem) {
      onRemoveItem(selectedOfferedItem);
      setSelectedOfferedItem(null);
    }
  };

  const canAccept = myOfferedItems.length > 0 || theirOfferedItems.length > 0;

  return (
    <div className="trade-overlay">
      <div className="trade-window">
        <div className="trade-header">
          <h2>Trading with {otherPlayerName}</h2>
          <button className="trade-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="trade-body">
          {/* Left Side - My Offer */}
          <div className="trade-section">
            <div className="trade-section-header">
              <h3>Your Offer</h3>
              {myAccepted && <span className="accepted-badge">✓ Accepted</span>}
            </div>
            <div className="trade-items-container">
              {myOfferedItems.length === 0 ? (
                <div className="empty-trade">Add items to trade</div>
              ) : (
                myOfferedItems.map(item => (
                  <div 
                    key={item.id}
                    className={`trade-item ${selectedOfferedItem === item.id ? 'selected' : ''}`}
                    onClick={() => setSelectedOfferedItem(item.id)}
                  >
                    <span className="trade-item-name">{item.name}</span>
                    <span className="trade-item-quantity">x{item.quantity}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Middle - Controls */}
          <div className="trade-controls">
            <div className="trade-arrows">
              <button 
                className="trade-arrow-btn"
                onClick={handleAddToTrade}
                disabled={!selectedInventoryItem || myAccepted}
                title="Add to trade"
              >
                ▲
              </button>
              <button 
                className="trade-arrow-btn"
                onClick={handleRemoveFromTrade}
                disabled={!selectedOfferedItem || myAccepted}
                title="Remove from trade"
              >
                ▼
              </button>
            </div>
          </div>

          {/* Right Side - Their Offer */}
          <div className="trade-section">
            <div className="trade-section-header">
              <h3>{otherPlayerName}'s Offer</h3>
              {theirAccepted && <span className="accepted-badge">✓ Accepted</span>}
            </div>
            <div className="trade-items-container">
              {theirOfferedItems.length === 0 ? (
                <div className="empty-trade">Waiting for offer...</div>
              ) : (
                theirOfferedItems.map(item => (
                  <div key={item.id} className="trade-item">
                    <span className="trade-item-name">{item.name}</span>
                    <span className="trade-item-quantity">x{item.quantity}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Bottom - My Inventory */}
        <div className="trade-inventory">
          <h3>Your Inventory</h3>
          <div className="trade-inventory-grid">
            {myInventory.length === 0 ? (
              <div className="empty-inventory">No items to trade</div>
            ) : (
              myInventory.map(item => (
                <div 
                  key={item.id}
                  className={`inventory-trade-item ${selectedInventoryItem === item.id ? 'selected' : ''}`}
                  onClick={() => setSelectedInventoryItem(item.id)}
                >
                  <span className="item-name">{item.name}</span>
                  <span className="item-quantity">x{item.quantity}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer - Action Buttons */}
        <div className="trade-footer">
          <button 
            className="trade-btn trade-decline-btn"
            onClick={onDecline}
          >
            Decline
          </button>
          <button 
            className={`trade-btn trade-accept-btn ${myAccepted ? 'accepted' : ''}`}
            onClick={onAccept}
            disabled={!canAccept}
          >
            {myAccepted ? '✓ Accepted' : 'Accept'}
          </button>
        </div>

        {/* Trade Status */}
        {myAccepted && theirAccepted && (
          <div className="trade-status">
            <div className="trade-complete">Trade Complete!</div>
          </div>
        )}
      </div>
    </div>
  );
};
