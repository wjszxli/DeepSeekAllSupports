import './App.scss';

import { createRoot } from 'react-dom/client';
import React from 'react';

import App from './App';
import { LanguageProvider } from '../contexts/LanguageContext';

const container = document.getElementById('root');

const root = createRoot(container!);
root.render(
    <React.StrictMode>
        <LanguageProvider>
            <App />
        </LanguageProvider>
    </React.StrictMode>,
);
