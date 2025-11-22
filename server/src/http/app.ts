import express from 'express';
import cors from 'cors';
import authRoutes from '../routes/auth.js';
import verifyRoutes from '../routes/verify.js';
import playerRoutes from '../routes/player.js';

/**
 * ExpressApp - HTTP REST API Server
 * 
 * Handles:
 * - Authentication endpoints (login, register, verify)
 * - Player endpoints (skills)
 * - Health check
 * - CORS configuration
 * - JSON/URL-encoded body parsing
 */

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth', verifyRoutes);
app.use('/api/player', playerRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
