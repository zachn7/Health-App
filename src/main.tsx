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
  // E2E tests seed IndexedDB via an initScript. Dexie can race that.
  // In normal app usage this is undefined and skipped.
  const seedPromise = (window as any).__e2e_seed_promise__ as Promise<void> | undefined
  if (seedPromise) {
    await seedPromise
  }

  // Initialize core database only. Heavy route-specific data like the exercise
  // library now loads on demand instead of bloating every first paint.
  await initDatabase()

  // Tell tests we finished the init pipeline.
  ;(window as any).__APP_INIT_DONE__ = true
}

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Root element not found')
}

const root = ReactDOM.createRoot(rootEl)

// Render something immediately so users don't stare at a blank page.
root.render(
  <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
    Loading FitBud AI...
  </div>,
)

async function bootstrap() {
  try {
    await initializeApp()
    console.log('App initialization complete')
  } catch (error) {
    console.error('App initialization failed:', error)
    // Keep going anyway - some pages can still render without IndexedDB.
  } finally {
    // Even if init fails, render the app so the UI can show a helpful state.
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    )
  }
}

// Register SW in a non-blocking way.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    registerServiceWorker()
    void bootstrap()
  })
} else {
  registerServiceWorker()
  void bootstrap()
}