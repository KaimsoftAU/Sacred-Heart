import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import Game from './pages/Game';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLogin, setShowLogin] = useState(true);
  const [token, setToken] = useState<string>('');
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in and validate token
    const validateToken = async () => {
      const savedToken = localStorage.getItem('token');
      
      if (savedToken) {
        try {
          const response = await fetch('http://localhost:3000/api/auth/verify', {
            headers: {
              'Authorization': `Bearer ${savedToken}`
            }
          });

          if (response.ok) {
            const data = await response.json();
            setToken(savedToken);
            setPlayer(data.player);
            setIsAuthenticated(true);
          } else {
            // Token is invalid, clear storage
            localStorage.removeItem('token');
            localStorage.removeItem('player');
          }
        } catch (error) {
          console.error('Token validation failed:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('player');
        }
      }
      
      setLoading(false);
    };

    validateToken();
  }, []);

  const handleAuthSuccess = (newToken: string, newPlayer: any) => {
    setToken(newToken);
    setPlayer(newPlayer);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('player');
    setToken('');
    setPlayer(null);
    setIsAuthenticated(false);
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        fontSize: '1.5rem'
      }}>
        Loading...
      </div>
    );
  }

  if (isAuthenticated) {
    return <Game player={player} token={token} onLogout={handleLogout} />;
  }

  return showLogin ? (
    <Login
      onSuccess={handleAuthSuccess}
      onSwitchToRegister={() => setShowLogin(false)}
    />
  ) : (
    <Register
      onSuccess={handleAuthSuccess}
      onSwitchToLogin={() => setShowLogin(true)}
    />
  );
}

export default App;
