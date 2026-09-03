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

test("isPageEnabled: gemigreerde ERPNext-pagina's zijn enabled", () => {
  for (const path of [
    "/projects",
    "/tasks",
    "/quotations",
    "/sales",
    "/timesheets",
    "/leave",
    "/contacts",
    "/calendar",
    "/financieel-dashboard",
    "/management-dashboard",
  ]) {
    assert.equal(isPageEnabled(path), true, `${path} zou enabled moeten zijn`);
  }
});

test("isPageEnabled: fase-2-routes zijn enabled", () => {
  for (const path of ["/webmail", "/meeting-notes", "/release-notes", "/x", "/x/foo"]) {
    assert.equal(isPageEnabled(path), true, `${path} zou enabled moeten zijn`);
  }
});

test("isPageEnabled: /messenger draait op de ERPNext-berichtenadapter en is dus enabled", () => {
  assert.equal(isPageEnabled("/messenger"), true);
});

test("isPageEnabled: serverloze-onmogelijke routes blijven disabled", () => {
  for (const path of ["/nextcloud-files", "/nextcloud-talk", "/passwords"]) {
    assert.equal(isPageEnabled(path), false, `${path} zou disabled moeten zijn`);
  }
});

test("isFeatureEnabled: alleen serverloze features zijn actief", () => {
  const enabled: ServerFeature[] = ["erpnext-mail", "erpnext-messages", "extensions"];
  const disabled: ServerFeature[] = [
    "webmail",
    // De oude multi-platform brug blijft uit; `erpnext-messages` is een
    // andere feature op dezelfde route.
    "messenger",
    "websocket",
    "terminal",
    "nextcloud",
    "calendar-bridge",
    "stats",
    "vault",
    "synced-prefs",
    "printview",
    "shared-settings",
    "desktop",
  ];
  for (const feature of enabled) {
    assert.equal(isFeatureEnabled(feature), true, `${feature} zou enabled moeten zijn`);
  }
  for (const feature of disabled) {
    assert.equal(isFeatureEnabled(feature), false, `${feature} zou disabled moeten zijn`);
  }
});

test("DISABLED_PAGE_MODE is 'visible'", () => {
  assert.equal(DISABLED_PAGE_MODE, "visible");
});
