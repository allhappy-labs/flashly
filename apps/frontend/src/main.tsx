import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';

import './styles.css';
import { frontendCapabilities } from './config/app-mode';
import reportWebVitals from './reportWebVitals.ts';
import { initApiClient } from './lib/api/init';
import { router } from './router';

// Initialize the Flashly API client only when hosted mode enables it.
if (frontendCapabilities.flashlyApi) {
    initApiClient();
}

const rootElement = document.getElementById('app');
if (rootElement && !rootElement.innerHTML) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
        <StrictMode>
            <RouterProvider router={router} />
        </StrictMode>,
    );
}

if (import.meta.env.DEV && import.meta.env.VITE_LOG_WEB_VITALS === 'true') {
    reportWebVitals(console.log);
}
