import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DISABLED_PAGE_MODE,
  isFeatureEnabled,
  isPageEnabled,
  type ServerFeature,
} from "./capabilities.ts";

test("isPageEnabled: dashboard routes zijn enabled", () => {
  assert.equal(isPageEnabled("/"), true);
  assert.equal(isPageEnabled("/dashboard"), true);
});

test("isPageEnabled: settings en settings-subroutes zijn enabled", () => {
  assert.equal(isPageEnabled("/settings"), true);
  assert.equal(isPageEnabled("/settings/general"), true);
  assert.equal(isPageEnabled("/settings/anything/nested"), true);
});

test("isPageEnabled: overige routes zijn disabled", () => {
  assert.equal(isPageEnabled("/projects"), false);
  assert.equal(isPageEnabled("/webmail"), false);
  assert.equal(isPageEnabled("/x/foo"), false);
});

test("isFeatureEnabled: alle ServerFeature-waarden zijn disabled in fase 1", () => {
  const features: ServerFeature[] = [
    "webmail",
    "messenger",
    "websocket",
    "terminal",
    "nextcloud",
    "calendar-bridge",
    "stats",
    "vault",
    "extensions",
    "synced-prefs",
    "printview",
    "shared-settings",
    "desktop",
  ];
  for (const feature of features) {
    assert.equal(isFeatureEnabled(feature), false, `${feature} zou disabled moeten zijn`);
  }
});

test("DISABLED_PAGE_MODE is 'visible'", () => {
  assert.equal(DISABLED_PAGE_MODE, "visible");
});
