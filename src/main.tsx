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
import './styles/language-fonts.css';
import './styles/guide.css';
import './components/earliest-use-evidence.css';

const container = document.getElementById('root')!;
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

// Build-time prerendered markup is hydrated when the URL matches the state it
// was rendered for; otherwise (e.g. ?lang=en, ?y=…) index.html has flagged
// it `ssr-stale` and we render fresh.
const prerendered = container.querySelector('.app') !== null;
const stale = document.documentElement.classList.contains('ssr-stale');
// Remove the static loading sibling before hydrating the preserved SSR tree.
container.querySelector('.initial-loading')?.remove();
container.removeAttribute('data-loading');
if (prerendered && !stale) {
  // Discard template whitespace and loading comments around the SSR element.
  container.replaceChildren(container.querySelector('.app')!);
  hydrateRoot(container, app);
} else {
  createRoot(container).render(app);
}
