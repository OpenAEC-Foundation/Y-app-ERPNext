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

// Actively unregister any previously-installed service worker and wipe its
// caches, in every environment (not just dev). A stale SW from an earlier
// deployment (e.g. the frontend-only Y-next port, or an older production
// build) would otherwise keep intercepting every request on this origin —
// including /api/* — with no self-healing path for a returning visitor.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const reg of regs) reg.unregister().catch(() => { /* */ });
  });
  if ("caches" in window) {
    caches.keys().then((keys) => {
      for (const k of keys) caches.delete(k).catch(() => { /* */ });
    });
  }
}
