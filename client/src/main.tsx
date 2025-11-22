import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Note: StrictMode is disabled because Babylon.js game engine doesn't work well with
// React's double-mounting in development (causes scene disposal issues)
createRoot(document.getElementById('root')!).render(
  <App />
)
