import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { PreferencesProvider } from './preferences/Preferences';
import './styles.css';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PreferencesProvider>
      <App />
    </PreferencesProvider>
  </React.StrictMode>,
);
