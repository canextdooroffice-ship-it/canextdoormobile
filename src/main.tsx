import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Register Service Worker for PWA compliance
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('Service Worker registered with scope: ', reg.scope);

        // Check for updates immediately on load
        reg.update().catch(() => {});

        // Check for updates periodically (every 5 minutes)
        setInterval(() => {
          reg.update().catch(() => {});
        }, 5 * 60 * 1000);

        const handleUpdate = (worker: ServiceWorker) => {
          // Dispatch custom event to notify App.tsx
          window.dispatchEvent(new CustomEvent('sw-update-available', { detail: worker }));
        };

        // If there's already a waiting worker
        if (reg.waiting) {
          handleUpdate(reg.waiting);
        }

        // Listen for future installing workers
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                handleUpdate(newWorker);
              }
            });
          }
        });
      })
      .catch((err) => {
        console.error('Service Worker registration failed: ', err);
      });

    // Listen for controller changes and reload the page
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

