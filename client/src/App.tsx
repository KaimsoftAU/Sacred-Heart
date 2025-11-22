import React from 'react'
import './App.css'
import SacredHeart from './game/SacredHeart'

function App() {
  React.useEffect(() => {
    const game = new SacredHeart(5001);
    
    return () => {
      // Cleanup: disconnect when component unmounts
      game.disconnect();
    };
  }, [])
  
  return (
    <canvas>
    </canvas>
  )
}

export default App
