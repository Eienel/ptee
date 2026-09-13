import { Buffer } from 'buffer';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// @solana/web3.js expects a global Buffer in the browser.
(globalThis as unknown as { Buffer: typeof Buffer }).Buffer ??= Buffer;

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
