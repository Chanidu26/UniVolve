import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react';
import App from './App.jsx';
import { msalInstance } from './api/client.js';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <MsalProvider instance={msalInstance}>
    <BrowserRouter><App /></BrowserRouter>
  </MsalProvider>
);
