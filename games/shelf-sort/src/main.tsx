import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import { guardGameSelection } from './platform/selection';

guardGameSelection('.game, .overlay', '[role="dialog"], .coach__copy, .coach__keys');

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
