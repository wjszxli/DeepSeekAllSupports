import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import React from 'react';

import App from './App';
import { LanguageProvider } from '../contexts/LanguageContext';

import './App.scss';

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(
    <React.StrictMode>
        <LanguageProvider>
            <HashRouter>
                <App />
            </HashRouter>
        </LanguageProvider>
    </React.StrictMode>
);
