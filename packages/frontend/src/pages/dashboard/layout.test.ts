import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { restoreWidgetLayout, splitWorkspaceWidgets } from "./layout.ts";

const defaults = [{ id: "time-booking", col: 0 }, { id: "projects", col: 1 }, { id: "km-booking", col: 0 }, { id: "my-tasks", col: 1 }, { id: "today-agenda", col: 1 }];
const available = defaults.map(w => w.id);
describe("light workspace layout", () => {
  it("keeps each saved column's order when converting legacy column storage to rows", () => {
    const stored = [{ id: "time-booking", col: 0 }, { id: "km-booking", col: 0 }, { id: "projects", col: 1 }, { id: "my-tasks", col: 1 }];
    assert.deepEqual(splitWorkspaceWidgets(stored).main.map(w => w.id), ["time-booking", "projects", "km-booking", "my-tasks"]);
  });
  it("places booking and projects first, and agenda in the utility panel", () => {
    const layout = restoreWidgetLayout(null, defaults, available);
    const { main, utility } = splitWorkspaceWidgets(layout);
    assert.deepEqual(main.map(w => w.id), ["time-booking", "projects", "km-booking", "my-tasks"]);
    assert.deepEqual(utility.map(w => w.id), ["today-agenda"]);
  });
  it("preserves saved order, columns and hidden widgets", () => {
    const saved = [{ id: "my-tasks", col: 0 }, { id: "time-booking", col: 1 }];
    assert.deepEqual(restoreWidgetLayout(saved, defaults, available), saved);
    assert.deepEqual(restoreWidgetLayout([], defaults, available), []);
  });
  it("rejects unknown, disabled and wrong-role widgets, invalid positions and duplicates", () => {
    const saved = [{ id: "leave", col: 0 }, { id: "projects", col: 1 }, { id: "projects", col: 0 }, { id: "email", col: 1 }, { id: "km-booking", col: 4 }, null];
    assert.deepEqual(restoreWidgetLayout(saved, defaults, available), [{ id: "projects", col: 1 }]);
  });
  it("uses defaults for corrupt storage without mutating the defaults", () => {
    const restored = restoreWidgetLayout({ invalid: true }, defaults, available);
    restored[0].col = 1;
    assert.equal(defaults[0].col, 0);
  });
});
