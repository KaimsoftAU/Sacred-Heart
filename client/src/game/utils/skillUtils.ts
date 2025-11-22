// RuneScape-style XP progression for skills (max level 20)

// XP required for each level (cumulative)
export const XP_TABLE: number[] = [
  0,      // Level 1
  100,    // Level 2
  250,    // Level 3
  450,    // Level 4
  700,    // Level 5
  1000,   // Level 6
  1350,   // Level 7
  1750,   // Level 8
  2200,   // Level 9
  2700,   // Level 10
  3250,   // Level 11
  3850,   // Level 12
  4500,   // Level 13
  5200,   // Level 14
  5950,   // Level 15
  6750,   // Level 16
  7600,   // Level 17
  8500,   // Level 18
  9450,   // Level 19
  10450,  // Level 20
];

/**
 * Calculate skill level from XP
 * @param xp - Current experience points
 * @returns Skill level (1-20)
 */
export function calculateLevel(xp: number): number {
  for (let i = XP_TABLE.length - 1; i >= 0; i--) {
    if (xp >= XP_TABLE[i]) {
      return i + 1;
    }
  }
  return 1;
}

/**
 * Get XP required for next level
 * @param currentLevel - Current skill level
 * @returns XP required for next level, or -1 if max level
 */
export function getXpForNextLevel(currentLevel: number): number {
  if (currentLevel >= 20) {
    return -1; // Max level reached
  }
  return XP_TABLE[currentLevel];
}

/**
 * Get XP progress towards next level
 * @param currentXp - Current experience points
 * @param currentLevel - Current skill level
 * @returns Object with progress info
 */
export function getXpProgress(currentXp: number, currentLevel: number): {
  currentLevelXp: number;
  nextLevelXp: number;
  progressXp: number;
  progressPercentage: number;
} {
  if (currentLevel >= 20) {
    return {
      currentLevelXp: XP_TABLE[19],
      nextLevelXp: XP_TABLE[19],
      progressXp: 0,
      progressPercentage: 100
    };
  }

  const currentLevelXp = XP_TABLE[currentLevel - 1];
  const nextLevelXp = XP_TABLE[currentLevel];
  const progressXp = currentXp - currentLevelXp;
  const xpNeeded = nextLevelXp - currentLevelXp;
  const progressPercentage = (progressXp / xpNeeded) * 100;

  return {
    currentLevelXp,
    nextLevelXp,
    progressXp,
    progressPercentage: Math.min(100, Math.max(0, progressPercentage))
  };
}

/**
 * Check if player leveled up after gaining XP
 * @param oldXp - XP before gaining
 * @param newXp - XP after gaining
 * @returns Array of levels gained (empty if no level up)
 */
export function checkLevelUp(oldXp: number, newXp: number): number[] {
  const oldLevel = calculateLevel(oldXp);
  const newLevel = calculateLevel(newXp);
  
  const levelsGained: number[] = [];
  for (let level = oldLevel + 1; level <= newLevel; level++) {
    levelsGained.push(level);
  }
  
  return levelsGained;
}
