import test from "node:test";
import assert from "node:assert/strict";
import { cleanBookingError } from "./booking-error.ts";

test("cleanBookingError: strips the Python exception path from a Frappe error", () => {
  assert.equal(
    cleanBookingError(
      "erpnext.projects.doctype.timesheet.timesheet.OverlapError: Row 1: From Time and To Time of TS-2026-00001 is overlapping with TS-2026-00001"
    ),
    "Row 1: From Time and To Time of TS-2026-00001 is overlapping with TS-2026-00001"
  );
});

test("cleanBookingError: handles a bare exception class without a module path", () => {
  assert.equal(
    cleanBookingError("LinkValidationError: Could not find Activity Type: Execution"),
    "Could not find Activity Type: Execution"
  );
});

test("cleanBookingError: leaves a plain message untouched", () => {
  assert.equal(cleanBookingError("ERPNext API error: 403"), "ERPNext API error: 403");
});

test("cleanBookingError: keeps multi-line server messages intact", () => {
  assert.equal(
    cleanBookingError("frappe.exceptions.ValidationError: Regel 1 klopt niet\nControleer de tijden"),
    "Regel 1 klopt niet\nControleer de tijden"
  );
});
