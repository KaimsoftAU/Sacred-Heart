import React from 'react';
import './TradeRequestNotification.css';

interface TradeRequestNotificationProps {
    fromPlayerName: string;
    onAccept: () => void;
    onDecline: () => void;
}

/**
 * TradeRequestNotification Component
 * 
 * Shows when another player wants to trade with you
 * Displays their name and Accept/Decline buttons
 */
export const TradeRequestNotification: React.FC<TradeRequestNotificationProps> = ({
    fromPlayerName,
    onAccept,
    onDecline
}) => {
    return (
        <div className="trade-request-notification">
            <div className="trade-request-content">
                <div className="trade-request-icon">⚔️</div>
                <div className="trade-request-text">
                    <div className="trade-request-title">Trade Request</div>
                    <div className="trade-request-message">
                        <span className="player-name">{fromPlayerName}</span> wants to trade with you
                    </div>
                </div>
                <div className="trade-request-buttons">
                    <button className="trade-request-accept" onClick={onAccept}>
                        Accept
                    </button>
                    <button className="trade-request-decline" onClick={onDecline}>
                        Decline
                    </button>
                </div>
            </div>
        </div>
    );
};
