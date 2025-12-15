import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Service Worker registration with better update handling
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', {
        scope: '/'
      });
      
      console.log('SW registered: ', registration);
      
      // Handle SW updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New SW is installed, show update notification
              console.log('Service Worker update found');
              
              // Auto-reload after a short delay to ensure the update is applied
              setTimeout(() => {
                if (confirm('App update available. Reload to apply?')) {
                  window.location.reload();
                }
              }, 1000);
            }
          });
        }
      });
      
      // Check for SW updates periodically
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000); // Check every hour
      
    } catch (error) {
      console.error('SW registration failed: ', error);
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)