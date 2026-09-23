import test from "node:test";
import assert from "node:assert/strict";
import { kiesOpdrachtgeverAdres } from "./project-opdrachtgever.ts";

test("het adres op de klant gaat voor", () => {
  assert.equal(kiesOpdrachtgeverAdres("info@klant.nl", "Jan", [{ name: "Jan", email_id: "jan@klant.nl" }]), "info@klant.nl");
});

test("anders de primaire contactpersoon, dan het vinkje, dan de eerste met een adres", () => {
  const contacten = [
    { name: "Piet", email_id: "piet@klant.nl" },
    { name: "Kees", email_id: "kees@klant.nl", is_primary_contact: 1 },
    { name: "Jan", email_id: "jan@klant.nl" },
  ];
  assert.equal(kiesOpdrachtgeverAdres("", "Jan", contacten), "jan@klant.nl");
  assert.equal(kiesOpdrachtgeverAdres(undefined, undefined, contacten), "kees@klant.nl");
  assert.equal(kiesOpdrachtgeverAdres(undefined, undefined, [{ name: "Piet", email_id: "piet@klant.nl" }]), "piet@klant.nl");
});

test("ongeldige of lege adressen tellen niet", () => {
  assert.equal(kiesOpdrachtgeverAdres("geen adres", undefined, [{ name: "A", email_id: "" }, { name: "B", email_id: "b@x" }]), "");
  assert.equal(kiesOpdrachtgeverAdres(undefined, "A", [{ name: "A" }, { name: "B", email_id: "b@klant.nl" }]), "b@klant.nl");
});
