import { defineConfig } from 'vite'
import type { ProxyOptions, HttpProxy } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import pkg from './package.json' with { type: 'json' }

// Y-next draait single-tenant direct op ERPNext v16 (geen eigen backend meer).
// De productie-SPA wordt gepubliceerd als ERPNext Web Page (route "y-next")
// met assets als publieke File-documenten onder /files/. In dev proxyt Vite
// rechtstreeks naar de ERPNext-site zodat cookies/CSRF hetzelfde gedrag
// vertonen als in productie.
//   PowerShell:  $env:VITE_ERPNEXT_URL = "https://open-aec-studio-erp.prilk.cloud"; npm run dev
//   bash:        VITE_ERPNEXT_URL=https://open-aec-studio-erp.prilk.cloud npm run dev
const erpnextTarget = process.env.VITE_ERPNEXT_URL || "https://open-aec-studio-erp.prilk.cloud";
// Optioneel, alleen voor lokale dev: injecteert een Authorization-header
// server-side in de Vite-proxy zodat de dev-server als ingelogde gebruiker
// tegen ERPNext praat. Komt nooit in client-code of de bundle terecht.
const devToken = process.env.YNEXT_DEV_TOKEN;

const proxyEntry: ProxyOptions = {
  target: erpnextTarget,
  changeOrigin: true,
  secure: true,
  cookieDomainRewrite: "localhost",
  configure: (proxy: HttpProxy.ProxyServer) => {
    if (devToken) {
      proxy.on("proxyReq", (proxyReq) => proxyReq.setHeader("Authorization", `token ${devToken}`));
    }
  },
};

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  // Assets staan in productie fysiek plat op /files/<naam>; lazy chunks
  // resolven via base. In dev blijft base "/" (Vite dev-server serveert
  // vanaf root).
  base: command === "build" ? "/files/" : "/",
  // Inject the version from package.json at build time so lib/version.ts
  // never drifts out of sync with the manifest. Bump only package.json.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // assetsDir: "" maakt de build-output plat — vereist voor het
    // deployscript, dat elk bestand los als publieke File uploadt.
    assetsDir: '',
    manifest: true,
  },
  server: {
    proxy: {
      "/api": proxyEntry,
      "/files": proxyEntry,
      "/private/files": proxyEntry,
      "/login": proxyEntry,
      "/assets": proxyEntry,
    },
  },
}))
