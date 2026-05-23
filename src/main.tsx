import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initializeDesktopPersistence } from './features/desktop/desktopPersistence';
import './styles/global.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Mission Control Center root element was not found.');
}

await initializeDesktopPersistence();

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
