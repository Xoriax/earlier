import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { PlayerProvider } from './components/PlayerProvider';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <PlayerProvider>
        <App />
      </PlayerProvider>
    </ErrorBoundary>
  </StrictMode>,
);
