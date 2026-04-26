// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { TermProvider } from './context/TermContext';
import { DataProvider } from './context/DataContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <TermProvider>
        <DataProvider>
          <App />
        </DataProvider>
      </TermProvider>
    </BrowserRouter>
  </React.StrictMode>
);