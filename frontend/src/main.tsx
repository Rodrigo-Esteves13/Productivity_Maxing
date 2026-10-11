import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initServiceWorker } from './pwa/registerSW';
import { reportWebVitals } from './lib/reportWebVitals';
import { applyStoredPrefs } from './hooks/useAccessibilityPrefs';
import { applyStoredLanguage } from './i18n/storage';

// Antes do primeiro render: tema, tamanho do texto e idioma ja aplicados.
applyStoredPrefs();
applyStoredLanguage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

initServiceWorker();
reportWebVitals();