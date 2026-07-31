import { test } from "node:test";
import assert from "node:assert/strict";

import config from "../../vite.config.ts";

// vite.config.ts exports a function of (env) => UserConfig when the base path
// depends on the Vite `command` (build vs serve). `defineConfig` is an
// identity helper, so the default export can be either the resolved config
// object or the function itself — handle both.
async function resolveConfig(env: { command: "build" | "serve"; mode: string }) {
  const resolved = typeof config === "function" ? await config(env) : config;
  return resolved;
}

test("build config: assets are served flat from /files/ with a manifest", async () => {
  const resolved = await resolveConfig({ command: "build", mode: "production" });
  assert.equal(resolved.base, "/files/");
  assert.equal(resolved.build?.assetsDir, "");
  assert.equal(resolved.build?.manifest, true);
});

test("serve config: dev server keeps root base", async () => {
  const resolved = await resolveConfig({ command: "serve", mode: "development" });
  assert.equal(resolved.base, "/");
});
