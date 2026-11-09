import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

try {
  const t = localStorage.getItem('sandikale_pos_theme');
  if (t === 'terang' || t === 'krem') document.documentElement.setAttribute('data-theme', t);
} catch {
  /* abaikan */
}

createRoot(document.getElementById('root')!).render(<ErrorBoundary>
      <App />
    </ErrorBoundary>);
