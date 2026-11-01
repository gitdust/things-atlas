import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App';
// Self-hosted variable fonts (woff2, unicode-range subsets, font-display: swap).
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/source-serif-4/opsz.css';
import '@fontsource-variable/source-serif-4/opsz-italic.css';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/app.css';

const container = document.getElementById('root')!;
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

// Build-time prerendered markup is hydrated when the URL matches the state it
// was rendered for; otherwise (e.g. ?lang=en, ?cat=…) index.html has flagged
// it `ssr-stale` and we render fresh.
const prerendered = container.firstElementChild !== null;
const stale = document.documentElement.classList.contains('ssr-stale');
if (prerendered && !stale) {
  hydrateRoot(container, app);
} else {
  createRoot(container).render(app);
}
