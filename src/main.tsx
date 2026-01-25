import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Validate preset frequencies in development
if (import.meta.env.DEV) {
  try {
    import('./lib/validate-preset-frequencies').then(({ validatePresetFrequency }) => {
      validatePresetFrequency();
    }).catch(err => {
      console.error('Preset frequency validation error:', err);
    });
  } catch (err) {
    console.error('Failed to import preset validator:', err);
  }
}

// Initialize exercise database on app startup
import { ExerciseDBService } from '@/lib/exercise-db'
import { initDatabase } from '@/db'

// Service Worker registration with better error handling and security context check
// This registration is entirely optional - the app works perfectly without it
const registerServiceWorker = async () => {
  // Only attempt registration if conditions are met
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker not supported in this browser');
    return;
  }

  // Check for secure context (required for SW in modern browsers)
  if (typeof window.isSecureContext !== 'undefined' && !window.isSecureContext) {
    console.warn('Service Worker registration skipped: insecure context (non-HTTPS or localhost)');
    return;
  }

  // Skip in development to avoid caching issues
  if (import.meta.env.DEV) {
    console.log('Service Worker registration skipped in development mode');
    return;
  }

  // TEMPORARY: Disable service worker in production until core flows are stable
  if (import.meta.env.PROD) {
    console.log('Service Worker registration temporarily disabled in production (stabilization phase)');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('./sw.js', {
      scope: import.meta.env.BASE_URL || '/'
    });
    
    console.log('SW registered successfully: ', registration.scope);
    
    // Handle SW updates gracefully
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('Service Worker update available');
          
          // Silent update - no blocking prompts
          setTimeout(() => {
            // Only show update prompt if user is not actively using the app
            /*
            if (document.visibilityState === 'visible' && confirm('App update available. Reload to apply?')) {
              window.location.reload();
            }
            */
          }, 2000);
        }
      });
    });

    // Less frequent update checks to avoid performance issues
    setInterval(() => {
      try {
        registration.update();
      } catch (e) {
        console.warn('Service Worker update check failed:', e);
      }
    }, 2 * 60 * 60 * 1000); // Check every 2 hours (less frequent)
    
  } catch (error) {
    // Service Worker failure should NEVER break the app
    console.warn('Service Worker registration failed (app will still work):', error instanceof Error ? error.message : error);
    
    // Do NOT rethrow - app should continue without SW
  }
};

// Initialize app and database
const initializeApp = async () => {
  try {
    // Initialize database first
    await initDatabase();
    
    // Initialize exercise database
    await ExerciseDBService.initialize();
    
    console.log('App initialization complete');
  } catch (error) {
    console.error('App initialization failed:', error);
    // Continue anyway - app should work even if init fails
  }
};

// Register SW in a non-blocking way
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    registerServiceWorker();
    initializeApp();
  });
} else {
  registerServiceWorker();
  initializeApp();
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)