import { createServer } from "http";
import {Server, Socket} from "socket.io"


class GameServer {
    private PORT: number;
    private io: Server;

    constructor(PORT: number) {
        this.PORT = PORT;
        const httpServer = createServer();
        this.io = new Server(httpServer, {
            cors: {
                origin: "http://localhost:5173", // Vite dev server
                methods: ["GET", "POST"]
            }
        })
        httpServer.listen(this.PORT);
        console.log(`🚀 Game Server running on ws://localhost:${this.PORT}`);
    }

    start() {
         this.io.on("connection", (socket: Socket) => {
            console.log("✅ New connection:", socket.id);
            
            // Listen for getPlayerData from this specific socket
            socket.on("getPlayerData", () => {
                console.log("📨 Received getPlayerData from:", socket.id);
                this.givePlayerData(socket);
            });

            socket.on("disconnect", () => {
                console.log("❌ Client disconnected:", socket.id);
            });
        })
    }

    
    private givePlayerData(socket: Socket) {
        const data = { test: "test", playerId: socket.id };
        console.log("📤 Sending playerData:", data);
        socket.emit("playerData", data);
    }
}
export default GameServer;