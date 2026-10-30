import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles.css';
import { guardGameSelection } from './platform/selection';

guardGameSelection('.lr-game, .lr-overlay', '[role="dialog"], .lr-coach-message');

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
