import { io, Socket } from 'socket.io-client'

class SacredHeart {
    private PORT: number;
    private socket: Socket;
    
    constructor(port: number) {
        this.PORT = port;
        this.socket = io(`http://localhost:${this.PORT}`);
        
        // Listen for connection events
        this.socket.on("connect", () => {
            console.log("✅ Connected to game server:", this.socket.id);
            // Request data AFTER connected
            this.getPlayerData();
        });

        this.socket.on("disconnect", () => {
            console.log("❌ Disconnected from game server");
        });

        // Listen for player data response from server
        this.socket.on("playerData", (data) => {
            console.log("📥 Received player data:", data);
        });

        // Debug: listen for any event
        this.socket.onAny((eventName, ...args) => {
            console.log("🔔 Event received:", eventName, args);
        });
    }

    // Request player data from server
    getPlayerData() {
        console.log("📤 Requesting player data...");
        this.socket.emit("getPlayerData");
    }

    // Disconnect from server (cleanup)
    disconnect() {
        console.log("🔌 Disconnecting from game server...");
        this.socket.disconnect();
    }
}

export default SacredHeart;