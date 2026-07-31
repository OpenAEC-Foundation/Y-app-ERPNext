import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'
import { initInstances } from './lib/instances'

// Apply default theme
initInstances()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Geen service worker in fase 1 — Y-next wordt als ERPNext Web Page
// geserveerd en registreert niets meer onder /sw.js.

// In dev, actively unregister any previously-installed service worker and
// wipe its caches. A stale SW from an earlier production-like session will
// otherwise intercept every request to localhost and cause endless loading.
if ("serviceWorker" in navigator && import.meta.env.DEV) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const reg of regs) reg.unregister().catch(() => { /* */ });
  });
  if ("caches" in window) {
    caches.keys().then((keys) => {
      for (const k of keys) caches.delete(k).catch(() => { /* */ });
    });
  }
}
