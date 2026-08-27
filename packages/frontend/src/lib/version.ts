// Injected at build time by Vite via `define` — see vite.config.ts in
// packages/frontend AND packages/desktop. Bumping the version now means
// editing only packages/frontend/package.json (plus the other manifests).
declare const __APP_VERSION__: string;
export const APP_VERSION = __APP_VERSION__;
export const APP_NAME = "Y-App";
