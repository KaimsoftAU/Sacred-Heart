import express, { Request, Response, NextFunction } from 'express';
import { Player } from '../models/Player';
import { verifyToken, AuthRequest } from './verify';
import { calculateLevel, checkLevelUp } from '../utils/skillUtils';

const router = express.Router();

// Update woodcutting skill (add XP)
router.post('/skills/woodcutting', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { xpGained } = req.body;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    if (typeof xpGained !== 'number' || xpGained <= 0) {
      res.status(400).json({ message: 'Invalid XP amount' });
      return;
    }

    const player = await Player.findById(userId);
    if (!player) {
      res.status(404).json({ message: 'Player not found' });
      return;
    }

    // Get current skill data
    const oldXp = player.skills?.woodcutting?.xp || 0;
    const oldLevel = player.skills?.woodcutting?.level || 1;
    
    // Calculate new XP and level
    const newXp = oldXp + xpGained;
    const newLevel = calculateLevel(newXp);
    
    // Check if leveled up
    const levelsGained = checkLevelUp(oldXp, newXp);
    
    // Cap at level 20
    const cappedLevel = Math.min(newLevel, 20);

    // Update player skills
    if (!player.skills) {
      player.skills = {
        woodcutting: {
          level: cappedLevel,
          xp: newXp
        }
      };
    } else {
      player.skills.woodcutting = {
        level: cappedLevel,
        xp: newXp
      };
    }

    await player.save();

    res.json({
      success: true,
      oldLevel,
      newLevel: cappedLevel,
      oldXp,
      newXp,
      xpGained,
      levelsGained
    });
  } catch (error) {
    console.error('Error updating woodcutting skill:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get player skills
router.get('/skills', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const player = await Player.findById(userId);
    if (!player) {
      res.status(404).json({ message: 'Player not found' });
      return;
    }

    res.json({
      skills: player.skills || {
        woodcutting: {
          level: 1,
          xp: 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching skills:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
