import React, { useEffect } from 'react';
import './ContextMenu.css';

interface ContextMenuProps {
  x: number;
  y: number;
  options: Array<{
    label: string;
    icon?: string;
    onClick: () => void;
  }>;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, options, onClose }) => {
  useEffect(() => {
    let cleanupFunctions: (() => void)[] = [];
    
    // Small delay before attaching click listeners to prevent immediate close
    const timer = setTimeout(() => {
      const handleClick = (e: MouseEvent) => {
        // Only close if clicking outside the menu
        const target = e.target as HTMLElement;
        if (!target.closest('.context-menu')) {
          onClose();
        }
      };
      
      const handleContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        onClose();
      };

      // Close on any click outside or right-click
      document.addEventListener('click', handleClick);
      document.addEventListener('contextmenu', handleContextMenu);

      cleanupFunctions.push(() => {
        document.removeEventListener('click', handleClick);
        document.removeEventListener('contextmenu', handleContextMenu);
      });
    }, 250); // 250ms delay to prevent immediate close from mouseup

    return () => {
      clearTimeout(timer);
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [onClose]);

  return (
    <div 
      className="context-menu"
      style={{ 
        left: `${x}px`, 
        top: `${y}px` 
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {options.map((option, index) => (
        <button
          key={index}
          className="context-menu-item"
          onClick={() => {
            option.onClick();
            onClose();
          }}
        >
          {option.icon && <span className="context-menu-icon">{option.icon}</span>}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
};
