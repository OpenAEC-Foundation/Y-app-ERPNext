import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { eventsForDay } from "./today-events.ts";
describe("dashboard events", () => {
  it("orders mixed ERPNext and mailbox datetime separators chronologically", () => {
    const events = [{ name: "late", starts_on: "2026-10-12 16:00:00" }, { name: "early", starts_on: "2026-10-12T08:00:00" }];
    assert.deepEqual(eventsForDay(events, "2026-10-12").map(e => e.name), ["early", "late"]);
  });
  it("filters a cached mailbox week down to today", () => {
    const events = [{ name: "friday", starts_on: "2026-10-16T08:00:00" }, { name: "today", starts_on: "2026-10-12T10:00:00" }];
    assert.deepEqual(eventsForDay(events, "2026-10-12").map(e => e.name), ["today"]);
  });
  it("includes today's appointments and an overnight appointment", () => {
    const events = [
      { name: "morning", subject: "Review", starts_on: "2026-10-12 09:00:00", ends_on: "2026-10-12 10:00:00" },
      { name: "night", subject: "Shift", starts_on: "2026-10-11 23:00:00", ends_on: "2026-10-12 01:00:00" },
      { name: "past", starts_on: "2026-10-11 12:00:00", ends_on: "2026-10-11 13:00:00" },
      { name: "future", starts_on: "2026-10-13 09:00:00" },
    ];
    assert.deepEqual(eventsForDay(events, "2026-10-12").map(e => e.name), ["night", "morning"]);
  });
  it("expands recurring events using the shared calendar rules", () => {
    const result = eventsForDay([{ name: "weekly", subject: "Review", starts_on: "2026-09-28 09:00:00", ends_on: "2026-09-28 10:30:00", repeat_this_event: 1, repeat_on: "Weekly", monday: 1 }], "2026-10-12");
    assert.equal(result.length, 1);
    assert.equal(result[0].starts_on, "2026-10-12 09:00:00");
    assert.equal(result[0].ends_on, "2026-10-12 10:30:00");
  });
  it("does not show expired recurrences, closed events or malformed dates", () => {
    const events = [
      { name: "closed", starts_on: "2026-10-12 10:00:00", status: "Closed" },
      { name: "broken", starts_on: "" },
      { name: "expired", starts_on: "2026-09-28 10:00:00", repeat_this_event: 1, repeat_on: "Weekly", repeat_till: "2026-10-05", monday: 1 },
    ];
    assert.deepEqual(eventsForDay(events, "2026-10-12"), []);
  });
  it("includes previous-day occurrences that continue after midnight", () => {
    const events = [{ name: "repeat-night", starts_on: "2026-09-27 23:00:00", ends_on: "2026-09-28 01:00:00", repeat_this_event: 1, repeat_on: "Weekly", sunday: 1 }];
    assert.equal(eventsForDay(events, "2026-10-12")[0].starts_on, "2026-10-11 23:00:00");
  });
});
