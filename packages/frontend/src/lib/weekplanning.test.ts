import { test } from "node:test";
import assert from "node:assert/strict";
import { geldigDashboardPad } from "./weekplanning.ts";

test("geldigDashboardPad: een pad op deze site gaat door", () => {
  assert.equal(geldigDashboardPad("/weekdashboard"), "/weekdashboard");
  assert.equal(geldigDashboardPad("  /dashboards/week?x=1  "), "/dashboards/week?x=1");
});

test("geldigDashboardPad: leeg of ontbrekend betekent geen weekplanning", () => {
  assert.equal(geldigDashboardPad(null), null);
  assert.equal(geldigDashboardPad(undefined), null);
  assert.equal(geldigDashboardPad(""), null);
  assert.equal(geldigDashboardPad("   "), null);
});

test("geldigDashboardPad: een pagina van elders wordt nooit ingesloten", () => {
  assert.equal(geldigDashboardPad("https://elders.voorbeeld.test/dashboard"), null);
  assert.equal(geldigDashboardPad("//elders.voorbeeld.test/dashboard"), null);
  assert.equal(geldigDashboardPad("javascript:alert(1)"), null);
  assert.equal(geldigDashboardPad("dashboard"), null);
  assert.equal(geldigDashboardPad("/" + String.fromCharCode(92) + "elders.voorbeeld.test"), null);
});
