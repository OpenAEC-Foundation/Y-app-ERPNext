import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SALES_INVOICE_ACTIVE_FILTER,
  SALES_INVOICE_FINAL_FILTER,
  SALES_INVOICE_DRAFT_FILTER,
  DOCSTATUS_DRAFT,
  DOCSTATUS_SUBMITTED,
  DOCSTATUS_CANCELLED,
  isDraftInvoice,
  draftShare,
} from "./invoice-docstatus.ts";

/* ── De filters zelf ─────────────────────────────────────────────── */

test("ACTIVE-filter sluit alleen geannuleerde facturen uit", () => {
  assert.deepEqual(SALES_INVOICE_ACTIVE_FILTER, ["docstatus", "!=", 2]);
});

test("FINAL-filter houdt alleen definitieve facturen over", () => {
  assert.deepEqual(SALES_INVOICE_FINAL_FILTER, ["docstatus", "=", 1]);
});

test("DRAFT-filter houdt alleen concepten over", () => {
  assert.deepEqual(SALES_INVOICE_DRAFT_FILTER, ["docstatus", "=", 0]);
});

test("docstatus-constanten volgen ERPNext (0/1/2)", () => {
  assert.equal(DOCSTATUS_DRAFT, 0);
  assert.equal(DOCSTATUS_SUBMITTED, 1);
  assert.equal(DOCSTATUS_CANCELLED, 2);
});

test("de filters zijn los te spreiden in een ERPNext-filterlijst", () => {
  const filters: unknown[][] = [SALES_INVOICE_ACTIVE_FILTER];
  filters.push(["company", "=", "OpenAEC Studio BV"]);
  assert.deepEqual(filters, [
    ["docstatus", "!=", 2],
    ["company", "=", "OpenAEC Studio BV"],
  ]);
});

/* ── isDraftInvoice ──────────────────────────────────────────────── */

test("isDraftInvoice: alleen docstatus 0 is concept", () => {
  assert.equal(isDraftInvoice({ docstatus: 0 }), true);
  assert.equal(isDraftInvoice({ docstatus: 1 }), false);
  assert.equal(isDraftInvoice({ docstatus: 2 }), false);
});

test("isDraftInvoice: ontbrekende docstatus telt niet als concept", () => {
  assert.equal(isDraftInvoice({}), false);
  assert.equal(isDraftInvoice(null), false);
  assert.equal(isDraftInvoice(undefined), false);
});

/* ── draftShare ──────────────────────────────────────────────────── */

const rows = [
  { docstatus: 0, net_total: 1000 },
  { docstatus: 0, net_total: 250.5 },
  { docstatus: 1, net_total: 4000 },
  { docstatus: 1, net_total: 100 },
];

test("draftShare splitst bedragen in concept en definitief", () => {
  const s = draftShare(rows, (r) => r.net_total);
  assert.equal(s.draftCount, 2);
  assert.equal(s.draftAmount, 1250.5);
  assert.equal(s.finalCount, 2);
  assert.equal(s.finalAmount, 4100);
  assert.equal(s.totalCount, 4);
  assert.equal(s.totalAmount, 5350.5);
  assert.equal(s.hasDrafts, true);
});

test("draftShare: zonder concepten is hasDrafts false en draftAmount 0", () => {
  const s = draftShare([{ docstatus: 1, net_total: 42 }], (r) => r.net_total);
  assert.equal(s.hasDrafts, false);
  assert.equal(s.draftCount, 0);
  assert.equal(s.draftAmount, 0);
  assert.equal(s.finalAmount, 42);
});

test("draftShare: geannuleerde rijen tellen nergens mee", () => {
  const s = draftShare(
    [...rows, { docstatus: 2, net_total: 999999 }],
    (r) => r.net_total,
  );
  assert.equal(s.totalCount, 4);
  assert.equal(s.totalAmount, 5350.5);
});

test("draftShare: ontbrekende/onbruikbare bedragen tellen als 0", () => {
  const s = draftShare(
    [
      { docstatus: 0, net_total: undefined },
      { docstatus: 0, net_total: NaN },
      { docstatus: 1, net_total: null },
    ] as { docstatus: number; net_total: number | null | undefined }[],
    (r) => r.net_total,
  );
  assert.equal(s.draftCount, 2);
  assert.equal(s.draftAmount, 0);
  assert.equal(s.finalAmount, 0);
  assert.equal(s.totalAmount, 0);
});

test("draftShare: lege lijst geeft nullen en hasDrafts false", () => {
  const s = draftShare([] as { docstatus?: number }[], () => 0);
  assert.deepEqual(s, {
    draftCount: 0,
    draftAmount: 0,
    finalCount: 0,
    finalAmount: 0,
    totalCount: 0,
    totalAmount: 0,
    hasDrafts: false,
  });
});

test("draftShare: rijen zonder docstatus-veld gelden als definitief", () => {
  const s = draftShare([{ net_total: 10 }, { net_total: 5 }], (r) => r.net_total);
  assert.equal(s.finalCount, 2);
  assert.equal(s.draftCount, 0);
  assert.equal(s.totalAmount, 15);
});
