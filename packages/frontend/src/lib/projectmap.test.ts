import test from "node:test";
import assert from "node:assert/strict";
import { isProjectmap, kiesProjectmap } from "./projectmap.ts";

test("een mapnaam hoort bij een projectnummer", () => {
  assert.equal(isProjectmap("2892 Bedrijfspand Jelier Einsteinstraat 10 Dordrecht", "2892"), true);
  assert.equal(isProjectmap("2892", "2892"), true);
  assert.equal(isProjectmap("2892-Jelier", "2892"), true);
  assert.equal(isProjectmap("2892_Jelier", "2892"), true);
  assert.equal(isProjectmap("0808 2HOEK", "808"), true, "voorloopnullen tellen mee");
});

test("een nummer dat alleen maar lijkt op het projectnummer telt niet", () => {
  assert.equal(isProjectmap("28920 Ander project", "2892"), false);
  assert.equal(isProjectmap("Project 2892", "2892"), false);
  assert.equal(isProjectmap("2892Jelier", "2892"), false);
  assert.equal(isProjectmap("", "2892"), false);
  assert.equal(isProjectmap("2892 Jelier", ""), false);
});

test("bij meerdere treffers wint de kortste naam", () => {
  const mappen = ["2892 Bedrijfspand Jelier", "2892", "3201 Pauluskerk"];
  assert.equal(kiesProjectmap(mappen, "2892"), "2892");
  assert.equal(kiesProjectmap(mappen, "3201"), "3201 Pauluskerk");
  assert.equal(kiesProjectmap(mappen, "9999"), null);
});
