import test from "node:test";
import assert from "node:assert/strict";
import { aanwezigheid, fotoUrl, isOnline, leesCollegaStatus } from "./berichten-aanwezigheid.ts";

const NU = "2026-09-15 10:40:00";

test("isOnline: binnen vijf minuten online, daarna niet", () => {
  assert.equal(isOnline("2026-09-15 10:36:00.123456", NU), true);
  assert.equal(isOnline("2026-09-15 10:35:00", NU), true);
  assert.equal(isOnline("2026-09-15 10:34:59", NU), false);
  assert.equal(isOnline(null, NU), false);
  assert.equal(isOnline("onzin", NU), false);
});

test("isOnline: een laatst-actief net na de servertijd is geen reden voor offline", () => {
  assert.equal(isOnline("2026-09-15 10:41:00", NU), true);
  assert.equal(isOnline("2026-09-15 10:50:00", NU), false);
});

test("aanwezigheid: online, vandaag, gisteren, eerder en onbekend", () => {
  assert.deepEqual(aanwezigheid("2026-09-15 10:39:00", NU), { soort: "online" });
  assert.deepEqual(aanwezigheid("2026-09-15 09:05:12", NU), { soort: "vandaag", tijd: "09:05" });
  assert.deepEqual(aanwezigheid("2026-09-14 17:12:14", NU), { soort: "gisteren", tijd: "17:12" });
  assert.deepEqual(aanwezigheid("2026-08-27 09:31:31", NU), { soort: "eerder", datum: "2026-08-27" });
  assert.deepEqual(aanwezigheid(null, NU), { soort: "onbekend" });
});

test("aanwezigheid: gisteren over een maandgrens heen", () => {
  assert.deepEqual(aanwezigheid("2026-08-31 23:59:00", "2026-09-01 08:00:00"), { soort: "gisteren", tijd: "23:59" });
});

test("leesCollegaStatus: onvolledige rijen vallen af of krijgen een veilige invulling", () => {
  const lijst = leesCollegaStatus({
    collegas: [
      { user: "lara@3bm.co.nl", naam: "Lara Nazari", foto: 1, laatst_actief: "2026-09-15 10:00:00" },
      { user: "", naam: "zonder adres" },
      { user: "nino@3bm.co.nl" },
      "onzin",
    ],
    nu: NU,
  });
  assert.equal(lijst.serverNu, NU);
  assert.equal(lijst.collegas.size, 2);
  assert.deepEqual(lijst.collegas.get("lara@3bm.co.nl"), {
    user: "lara@3bm.co.nl", naam: "Lara Nazari", foto: true, laatstActief: "2026-09-15 10:00:00",
  });
  assert.deepEqual(lijst.collegas.get("nino@3bm.co.nl"), {
    user: "nino@3bm.co.nl", naam: "nino@3bm.co.nl", foto: false, laatstActief: null,
  });
  assert.equal(leesCollegaStatus(null).collegas.size, 0);
  assert.equal(leesCollegaStatus(null).serverNu, null);
});

test("fotoUrl: het adres gaat gecodeerd mee", () => {
  assert.equal(fotoUrl("maarten@3bm.co.nl"), "/api/method/berichten_foto?gebruiker=maarten%403bm.co.nl");
});
