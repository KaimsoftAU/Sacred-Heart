import React, { useState } from 'react';
import './GameUI.css';

interface Skill {
  name: string;
  level: number;
  xp: number;
  nextLevelXp: number;
}

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  icon?: string;
}

interface GameUIProps {
  skills: Skill[];
  inventory: InventoryItem[];
}

export const GameUI: React.FC<GameUIProps> = ({ skills, inventory }) => {
  const [showSkills, setShowSkills] = useState(false);
  const [showInventory, setShowInventory] = useState(false);

  const toggleSkills = () => {
    setShowSkills(!showSkills);
    if (showInventory) setShowInventory(false);
  };

  const toggleInventory = () => {
    setShowInventory(!showInventory);
    if (showSkills) setShowSkills(false);
  };

  const calculateXpPercentage = (skill: Skill) => {
    if (skill.level >= 20) return 100;
    const currentLevelXp = skill.xp;
    const xpForLevel = skill.nextLevelXp;
    const previousLevelXp = skill.level === 1 ? 0 : getPreviousLevelXp(skill.level);
    const xpNeeded = xpForLevel - previousLevelXp;
    const xpProgress = currentLevelXp - previousLevelXp;
    return Math.min(100, Math.max(0, (xpProgress / xpNeeded) * 100));
  };

  const getPreviousLevelXp = (level: number): number => {
    const xpTable = [0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700, 3250, 3850, 4500, 5200, 5950, 6750, 7600, 8500, 9450, 10450];
    return xpTable[level - 1] || 0;
  };

  return (
    <div className="game-ui-container">
      {/* Skills Panel */}
      {showSkills && (
        <div className="skills-panel">
          <div className="panel-header">
            <h3>Skills</h3>
            <button className="close-btn" onClick={() => setShowSkills(false)}>×</button>
          </div>
          <div className="panel-content">
            {skills.map((skill, index) => (
              <div key={index} className="skill-item">
                <div className="skill-info">
                  <span className="skill-name">{skill.name}</span>
                  <span className="skill-level">Level {skill.level}</span>
                </div>
                <div className="skill-xp-bar">
                  <div 
                    className="skill-xp-fill" 
                    style={{ width: `${calculateXpPercentage(skill)}%` }}
                  ></div>
                  <span className="skill-xp-text">
                    {skill.level >= 20 ? 'MAX' : `${skill.xp} / ${skill.nextLevelXp} XP`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inventory Panel */}
      {showInventory && (
        <div className="inventory-panel">
          <div className="panel-header">
            <h3>Inventory</h3>
            <button className="close-btn" onClick={() => setShowInventory(false)}>×</button>
          </div>
          <div className="panel-content">
            <div className="inventory-grid">
              {inventory.length === 0 ? (
                <div className="empty-inventory">Your inventory is empty</div>
              ) : (
                inventory.map((item) => (
                  <div key={item.id} className="inventory-item">
                    <div className="item-icon">
                      {item.icon ? (
                        <img src={item.icon} alt={item.name} />
                      ) : (
                        <div className="item-placeholder">
                          {item.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="item-info">
                      <span className="item-name">{item.name}</span>
                      <span className="item-quantity">x{item.quantity}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Right Buttons */}
      <div className="game-ui-buttons">
        <button 
          className={`ui-button skills-button ${showSkills ? 'active' : ''}`}
          onClick={toggleSkills}
          title="Skills"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </button>
        <button 
          className={`ui-button inventory-button ${showInventory ? 'active' : ''}`}
          onClick={toggleInventory}
          title="Inventory"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
        </button>
      </div>
    </div>
  );
};
