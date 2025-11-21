import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Player } from '../models/Player';
import { JWT_SECRET } from '../config/env';

const router = express.Router();

// Register endpoint
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password } = req.body;

    // Validate input
    if (!username || !email || !password) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    // Check if user already exists
    const existingUser = await Player.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new player
    const player = new Player({
      username,
      email,
      password: hashedPassword,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 }
    });

    await player.save();

    // Generate token
    const token = jwt.sign({ id: player._id, username: player.username }, JWT_SECRET, {
      expiresIn: '7d'
    });

    res.status(201).json({
      message: 'Player registered successfully',
      token,
      player: {
        id: player._id,
        username: player.username,
        email: player.email,
        position: player.position,
        rotation: player.rotation
      }
    });
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login endpoint
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Find player
    const player = await Player.findOne({ email });
    if (!player) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, player.password);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Generate token
    const token = jwt.sign({ id: player._id, username: player.username }, JWT_SECRET, {
      expiresIn: '7d'
    });

    res.json({
      message: 'Login successful',
      token,
      player: {
        id: player._id,
        username: player.username,
        email: player.email,
        position: player.position,
        rotation: player.rotation
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

export default router;
