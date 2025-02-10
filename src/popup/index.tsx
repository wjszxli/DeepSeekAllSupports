import './App.scss';

import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';

import App from './App';

const container = document.querySelector('#root');

const root = createRoot(container!);
root.render(
    <HashRouter>
        <App />
    </HashRouter>,
);
