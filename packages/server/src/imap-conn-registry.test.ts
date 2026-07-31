import { test } from "node:test";
import assert from "node:assert/strict";

import { createConnectionLimiter } from "./imap-conn-registry.ts";

// Minimale fake van een ImapFlow-client: onthoudt of close() is aangeroepen en
// laat ons het 'close'-event handmatig vuren.
function fakeConn() {
  const handlers: Array<() => void> = [];
  return {
    closed: false,
    close() { this.closed = true; handlers.forEach((h) => h()); },
    once(_event: "close", cb: () => void) { handlers.push(cb); },
  };
}

test("houdt het aantal binnen de cap door de oudste te sluiten", () => {
  const lim = createConnectionLimiter(3);
  const conns = Array.from({ length: 3 }, () => fakeConn());
  conns.forEach((c) => lim.track("h", c));
  assert.equal(lim.count("h"), 3);
  assert.ok(conns.every((c) => !c.closed), "binnen de cap wordt niets gesloten");

  const c4 = fakeConn();
  lim.track("h", c4);
  assert.equal(lim.count("h"), 3, "cap blijft 3");
  assert.equal(conns[0].closed, true, "de oudste is gesloten");
  assert.equal(c4.closed, false, "de nieuwste blijft open");
});

test("verschillende hosts hebben onafhankelijke caps", () => {
  const lim = createConnectionLimiter(2);
  const a = [fakeConn(), fakeConn()];
  const b = [fakeConn(), fakeConn()];
  a.forEach((c) => lim.track("a", c));
  b.forEach((c) => lim.track("b", c));
  assert.equal(lim.count("a"), 2);
  assert.equal(lim.count("b"), 2);
  assert.ok([...a, ...b].every((c) => !c.closed), "geen host overschrijdt z'n cap");
});

test("een gesloten verbinding telt niet meer mee (close-event ruimt op)", () => {
  const lim = createConnectionLimiter(2);
  const c1 = fakeConn(); const c2 = fakeConn();
  lim.track("h", c1); lim.track("h", c2);
  assert.equal(lim.count("h"), 2);
  c1.close(); // extern gesloten (server/sluiting)
  assert.equal(lim.count("h"), 1, "na close telt 'ie niet meer mee");
  const c3 = fakeConn();
  lim.track("h", c3);
  assert.equal(lim.count("h"), 2);
  assert.equal(c2.closed, false, "c2 hoeft niet gesloten te worden — er was ruimte");
});
