import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Player } from '../models/Player';
import { JWT_SECRET } from '../config/env';

const router = express.Router();

interface AuthRequest extends Request {
  user?: any;
}

// Middleware to verify token
export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Verify token endpoint
router.get('/verify', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const player = await Player.findById(req.user.id).select('-password');
    
    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    res.json({
      valid: true,
      player: {
        id: player._id,
        username: player.username,
        email: player.email,
        position: player.position,
        rotation: player.rotation
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ error: 'Server error during verification' });
  }
});

export default router;
