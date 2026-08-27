import { test } from "node:test";
import assert from "node:assert/strict";
import { isPermissionError, firstPermissionError } from "./permission-error.ts";
import { ApiError } from "./erpnext.ts";

test("isPermissionError: een ApiError met status 403 is een rechtenfout", () => {
  assert.equal(isPermissionError(new ApiError(403, "Forbidden")), true);
});

test("isPermissionError: herkent Frappe's PermissionError-teksten zonder 403-status", () => {
  // De add_tag-RPC geeft de rechtenfout als 417/500 mét reden in de body.
  const cases = [
    "frappe.exceptions.PermissionError: Not permitted",
    "User does not have doctype access via role permission for document Communication",
    "Insufficient Permission for ToDo",
    "You are not permitted to update this document",
    "No permission to access Communication",
    "Not allowed to delete Email Queue",
  ];
  for (const message of cases) {
    assert.equal(isPermissionError(new ApiError(500, message)), true, message);
  }
});

test("isPermissionError: een 417 uit de veld-self-heal is GEEN rechtenfout", () => {
  // "Field not permitted in query" bevat 'not permitted' maar is een
  // veldprobleem — die mag nooit als rechtenmelding bij de gebruiker landen.
  assert.equal(
    isPermissionError(new ApiError(417, "Field not permitted in query: custom_address")),
    false
  );
});

test("isPermissionError: gewone fouten en niet-objecten zijn geen rechtenfout", () => {
  assert.equal(isPermissionError(new ApiError(0, "Request timed out after 30s")), false);
  assert.equal(isPermissionError(new ApiError(500, "ERPNext API error: 500")), false);
  assert.equal(isPermissionError(new Error("boom")), false);
  assert.equal(isPermissionError("403"), false);
  assert.equal(isPermissionError(null), false);
  assert.equal(isPermissionError(undefined), false);
});

test("firstPermissionError: vindt de 403 tussen andere fouten", () => {
  const perm = new ApiError(403, "Forbidden");
  const found = firstPermissionError([new ApiError(500, "boom"), perm, new Error("x")]);
  assert.equal(found, perm);
});

test("firstPermissionError: null als er geen rechtenfout tussen zit", () => {
  assert.equal(firstPermissionError([new ApiError(500, "boom"), new Error("x")]), null);
  assert.equal(firstPermissionError([]), null);
});
