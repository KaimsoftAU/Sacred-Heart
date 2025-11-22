import { Socket } from 'socket.io-client';

/**
 * Trade item interface
 */
export interface TradeItem {
    id: string;
    name: string;
    quantity: number;
}

/**
 * Trade request callback
 */
export type TradeRequestCallback = (fromPlayerId: string, fromPlayerName: string) => void;

/**
 * Trade response callback
 */
export type TradeResponseCallback = (fromPlayerId: string, fromPlayerName: string, accepted: boolean) => void;

/**
 * Trade update callback
 */
export type TradeUpdateCallback = (fromPlayerId: string, offeredItems: TradeItem[]) => void;

/**
 * Trade accept callback
 */
export type TradeAcceptCallback = (fromPlayerId: string) => void;

/**
 * Trade decline callback
 */
export type TradeDeclineCallback = (fromPlayerId: string) => void;

/**
 * TradeHandler Class - Manages player-to-player trading
 * 
 * Handles:
 * - Sending trade requests to other players
 * - Receiving and responding to trade requests
 * - Updating trade offers (adding/removing items)
 * - Trade acceptance/decline
 * - Trade completion
 */
export class TradeHandler {
    private socket: Socket;
    private onTradeRequest?: TradeRequestCallback;
    private onTradeResponse?: TradeResponseCallback;
    private onTradeUpdate?: TradeUpdateCallback;
    private onTradeAccept?: TradeAcceptCallback;
    private onTradeDecline?: TradeDeclineCallback;

    constructor(
        socket: Socket,
        onTradeRequest?: TradeRequestCallback,
        onTradeResponse?: TradeResponseCallback,
        onTradeUpdate?: TradeUpdateCallback,
        onTradeAccept?: TradeAcceptCallback,
        onTradeDecline?: TradeDeclineCallback
    ) {
        this.socket = socket;
        this.onTradeRequest = onTradeRequest;
        this.onTradeResponse = onTradeResponse;
        this.onTradeUpdate = onTradeUpdate;
        this.onTradeAccept = onTradeAccept;
        this.onTradeDecline = onTradeDecline;

        this.setupSocketListeners();
    }

    /**
     * Setup socket listeners for trade events
     */
    private setupSocketListeners(): void {
        // Listen for incoming trade requests
        this.socket.on('tradeRequest', (data: { fromPlayerId: string; fromPlayerName: string }) => {
            console.log(`[TradeHandler] Received trade request from ${data.fromPlayerName}`);
            if (this.onTradeRequest) {
                this.onTradeRequest(data.fromPlayerId, data.fromPlayerName);
            }
        });

        // Listen for trade responses (accept/decline)
        this.socket.on('tradeResponse', (data: { fromPlayerId: string; fromPlayerName: string; accepted: boolean }) => {
            console.log(`[TradeHandler] Trade response from ${data.fromPlayerName}: ${data.accepted ? 'accepted' : 'declined'}`);
            if (this.onTradeResponse) {
                this.onTradeResponse(data.fromPlayerId, data.fromPlayerName, data.accepted);
            }
        });

        // Listen for trade updates (item changes)
        this.socket.on('tradeUpdate', (data: { fromPlayerId: string; offeredItems: TradeItem[] }) => {
            console.log(`[TradeHandler] Trade update from player ${data.fromPlayerId}`);
            if (this.onTradeUpdate) {
                this.onTradeUpdate(data.fromPlayerId, data.offeredItems);
            }
        });

        // Listen for trade acceptance
        this.socket.on('tradeAccept', (data: { fromPlayerId: string }) => {
            console.log(`[TradeHandler] Trade accepted by player ${data.fromPlayerId}`);
            if (this.onTradeAccept) {
                this.onTradeAccept(data.fromPlayerId);
            }
        });

        // Listen for trade decline/cancel
        this.socket.on('tradeDecline', (data: { fromPlayerId: string }) => {
            console.log(`[TradeHandler] Trade declined by player ${data.fromPlayerId}`);
            if (this.onTradeDecline) {
                this.onTradeDecline(data.fromPlayerId);
            }
        });
    }

    /**
     * Send a trade request to another player
     */
    public requestTrade(targetPlayerId: string): void {
        console.log(`[TradeHandler] Sending trade request to player ${targetPlayerId}`);
        this.socket.emit('tradeRequest', { targetPlayerId });
    }

    /**
     * Respond to a trade request
     */
    public respondToTradeRequest(requesterId: string, accepted: boolean): void {
        console.log(`[TradeHandler] Responding to trade request: ${accepted ? 'accepted' : 'declined'}`);
        this.socket.emit('tradeResponse', { requesterId, accepted });
    }

    /**
     * Update trade offer (when adding/removing items)
     */
    public updateTradeOffer(otherPlayerId: string, offeredItems: TradeItem[]): void {
        console.log(`[TradeHandler] Updating trade offer`);
        this.socket.emit('tradeUpdate', { otherPlayerId, offeredItems });
    }

    /**
     * Accept the current trade
     */
    public acceptTrade(otherPlayerId: string): void {
        console.log(`[TradeHandler] Accepting trade`);
        this.socket.emit('tradeAccept', { otherPlayerId });
    }

    /**
     * Decline or cancel the trade
     */
    public declineTrade(otherPlayerId: string): void {
        console.log(`[TradeHandler] Declining trade`);
        this.socket.emit('tradeDecline', { otherPlayerId });
    }

    /**
     * Cleanup: Remove socket listeners
     */
    public dispose(): void {
        this.socket.off('tradeRequest');
        this.socket.off('tradeResponse');
        this.socket.off('tradeUpdate');
        this.socket.off('tradeAccept');
        this.socket.off('tradeDecline');
    }
}
