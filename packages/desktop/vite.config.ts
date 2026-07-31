import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import frontendPkg from "../frontend/package.json" with { type: "json" };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Inject the version from frontend's package.json so lib/version.ts
  // (consumed via the @frontend alias) stays in sync without manual edits.
  define: {
    __APP_VERSION__: JSON.stringify(frontendPkg.version),
  },
  resolve: {
    alias: {
      "@frontend": path.resolve(__dirname, "../frontend/src"),
      // Force ALL imports of shared packages to resolve from the desktop
      // node_modules — prevents duplicate React/lucide instances when
      // importing components from @frontend that have their own imports.
      "react": path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(__dirname, "node_modules/react/jsx-runtime"),
      "react/jsx-dev-runtime": path.resolve(__dirname, "node_modules/react/jsx-dev-runtime"),
      "lucide-react": path.resolve(__dirname, "node_modules/lucide-react"),
      "react-router-dom": path.resolve(__dirname, "node_modules/react-router-dom"),
      "react-i18next": path.resolve(__dirname, "node_modules/react-i18next"),
      "i18next": path.resolve(__dirname, "node_modules/i18next"),
    },
    dedupe: [
      "react", "react-dom", "react-router-dom", "react-i18next", "i18next",
      "lucide-react", "@dnd-kit/core", "@dnd-kit/sortable",
    ],
  },
  server: {
    port: 5174,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
