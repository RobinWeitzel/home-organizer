import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initPersistence } from './model/initPersistence';
import { initRemoteSync } from './model/remoteSync';
import './styles.css';

initPersistence();
initRemoteSync();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
