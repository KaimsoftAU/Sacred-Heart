import express, { Request, Response } from 'express';
import cors from 'cors';



// Uses CORS middleware
// Uses Express.js as the web framework
class WebServer {
    public app: express.Application;
    public PORT: number | string;
    constructor() {
        this.app = express();
        this.PORT = process.env.PORT || 3001;
        // Middleware
        this.app.use(cors());
        this.app.use(express.json());
    }

    public start(): void {
        // Start server
        this.app.listen(this.PORT, () => {
            console.log(`🚀 Web Server running on http://localhost:${this.PORT}`);
        });
    }

}

export default WebServer;