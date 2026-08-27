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

test("build config: output file names carry the YNEXT_BUILD_TAG build tag", async () => {
  const tag = "testtag123";
  const previous = process.env.YNEXT_BUILD_TAG;
  process.env.YNEXT_BUILD_TAG = tag;
  try {
    // vite.config.ts reads process.env.YNEXT_BUILD_TAG once at module
    // top-level, so a plain (cached) re-import would keep the value from
    // whichever import ran first. A cache-busting query param forces Node
    // to re-evaluate the module with the env var set beforehand.
    const mod = await import(`../../vite.config.ts?tag=${tag}`);
    const freshConfig = mod.default;
    const resolved =
      typeof freshConfig === "function"
        ? await freshConfig({ command: "build", mode: "production" })
        : freshConfig;
    const output = resolved.build?.rolldownOptions?.output;
    assert.match(output.entryFileNames, new RegExp(`^y${tag}-`));
    assert.match(output.chunkFileNames, new RegExp(`^y${tag}-`));
    assert.match(output.assetFileNames, new RegExp(`^y${tag}-`));
  } finally {
    if (previous === undefined) delete process.env.YNEXT_BUILD_TAG;
    else process.env.YNEXT_BUILD_TAG = previous;
  }
});
