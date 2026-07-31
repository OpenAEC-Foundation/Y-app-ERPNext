import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import dashboardPlugin from './vite-plugin-dashboard'
import pkg from './package.json' with { type: 'json' }

// Backend port: 3501 for mini variant, 3500 for full
const backendPort = process.env.VITE_APP_VARIANT === "mini" ? 3501 : 3500;
// Override the proxy target with VITE_API_TARGET to point dev frontend
// at a remote backend (e.g. production). Default: local Express server.
//   PowerShell:    $env:VITE_API_TARGET="https://y-app.impertio.app"; npm run dev
//   bash:          VITE_API_TARGET=https://y-app.impertio.app npm run dev
const apiTarget = process.env.VITE_API_TARGET || `http://localhost:${backendPort}`;

// All API requests go through the backend server
export default defineConfig({
  plugins: [react(), tailwindcss(), dashboardPlugin()],
  // Inject the version from package.json at build time so lib/version.ts
  // never drifts out of sync with the manifest. Bump only package.json.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true, secure: true },
      // WS proxy: target blijft http:// — `ws: true` regelt de upgrade.
      // Eerder werd http→ws geflipt, dat breekt de proxy in nieuwe Vite/
      // http-proxy-middleware versies (geen WS upgrade meer).
      "/ws":  { target: apiTarget, changeOrigin: true, secure: true, ws: true },
      "/erpnext-proxy": { target: apiTarget, changeOrigin: true, secure: true },
    },
  },
})
