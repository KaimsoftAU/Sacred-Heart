import { io, Socket } from 'socket.io-client'

class Game {
    private PORT: number;
    private socket: Socket;
    
    constructor(port: number) {
        this.PORT = port;
        this.socket = io(`http://localhost:${this.PORT}`);
        
        // Listen for connection events
        this.socket.on("connect", () => {
            console.log("✅ Connected to game server:", this.socket.id);
        });

        this.socket.on("disconnect", () => {
            console.log("❌ Disconnected from game server");
        });

        // Listen for data from server
        this.socket.on("getData", (data) => {
            console.log("Received data:", data);
        });

        // Listen for player data response
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
}