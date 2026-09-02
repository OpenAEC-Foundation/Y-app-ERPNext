/**
 * Tests voor de opstel-hulpjes van de Communication-webmail.
 *
 * Puur rekenwerk, dus geen fetch-mock nodig — dat is precies waarom deze
 * logica uit `Webmail.tsx` is gehaald.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  appendSignature,
  buildOutgoingHtml,
  buildReplyRecipients,
  effectiveSignature,
  extractEmail,
  formatAttachmentNames,
  isPdfName,
  isValidFolderLabel,
  joinAddresses,
  prefixSubject,
  splitAddresses,
} from "./mail-erpnext-compose.ts";

test("extractEmail: kaal adres, adres met naam, hoofdletters", () => {
  assert.equal(extractEmail("piet@3bm.co.nl"), "piet@3bm.co.nl");
  assert.equal(extractEmail("Piet Mol <Piet@3BM.co.nl>"), "piet@3bm.co.nl");
  assert.equal(extractEmail("  "), "");
});

test("splitAddresses/joinAddresses: lege entries vallen weg, vorm blijft", () => {
  const parsed = splitAddresses("a@x.nl, , Bea <b@x.nl>,");
  assert.deepEqual(parsed.map((a) => a.email), ["a@x.nl", "b@x.nl"]);
  assert.equal(joinAddresses(parsed), "a@x.nl, Bea <b@x.nl>");
});

test("buildReplyRecipients: gewoon antwoord gaat alleen naar de afzender", () => {
  const out = buildReplyRecipients(
    { sender: "klant@extern.nl", recipients: "piet@3bm.co.nl, jan@3bm.co.nl", cc: "baas@3bm.co.nl" },
    "piet@3bm.co.nl",
    false,
  );
  assert.deepEqual(out, { to: "klant@extern.nl", cc: "" });
});

test("buildReplyRecipients: allen beantwoorden laat het eigen adres weg", () => {
  const out = buildReplyRecipients(
    {
      sender: "Klant <klant@extern.nl>",
      recipients: "Piet <PIET@3bm.co.nl>, jan@3bm.co.nl",
      cc: "baas@3bm.co.nl, piet@3bm.co.nl",
    },
    "piet@3bm.co.nl",
    true,
  );
  assert.equal(out.to, "Klant <klant@extern.nl>, jan@3bm.co.nl");
  assert.equal(out.cc, "baas@3bm.co.nl");
});

test("buildReplyRecipients: een adres dat al in To staat komt niet ook in Cc", () => {
  const out = buildReplyRecipients(
    { sender: "klant@extern.nl", recipients: "jan@3bm.co.nl", cc: "jan@3bm.co.nl, klant@extern.nl" },
    "piet@3bm.co.nl",
    true,
  );
  assert.equal(out.to, "klant@extern.nl, jan@3bm.co.nl");
  assert.equal(out.cc, "");
});

test("buildReplyRecipients: zonder bekend eigen adres wordt niets weggefilterd", () => {
  const out = buildReplyRecipients(
    { sender: "klant@extern.nl", recipients: "piet@3bm.co.nl", cc: "baas@3bm.co.nl" },
    "",
    true,
  );
  assert.equal(out.to, "klant@extern.nl, piet@3bm.co.nl");
  assert.equal(out.cc, "baas@3bm.co.nl");
});

test("buildReplyRecipients: antwoord op je eigen mail houdt de afzender staan", () => {
  const out = buildReplyRecipients({ sender: "piet@3bm.co.nl" }, "piet@3bm.co.nl", false);
  assert.equal(out.to, "piet@3bm.co.nl");
});

test("prefixSubject: stapelt niet, ook niet over talen heen", () => {
  assert.equal(prefixSubject("Offerte", "Re"), "Re: Offerte");
  assert.equal(prefixSubject("Re: Offerte", "Re"), "Re: Offerte");
  assert.equal(prefixSubject("ANTW: Offerte", "Re"), "ANTW: Offerte");
  assert.equal(prefixSubject("Offerte", "Fwd"), "Fwd: Offerte");
  assert.equal(prefixSubject("FW: Offerte", "Fwd"), "FW: Offerte");
  assert.equal(prefixSubject("Doorgestuurd: Offerte", "Fwd"), "Doorgestuurd: Offerte");
  assert.equal(prefixSubject("", "Re"), "Re:");
});

test("appendSignature: eenmalig, en een lege handtekening verandert niets", () => {
  assert.equal(appendSignature("<p>Hoi</p>", ""), "<p>Hoi</p>");
  const once = appendSignature("<p>Hoi</p>", "<p>Groet, Piet</p>");
  assert.equal(once, "<p>Hoi</p><br><br><p>Groet, Piet</p>");
  assert.equal(appendSignature(once, "<p>Groet, Piet</p>"), once);
});

test("formatAttachmentNames / isPdfName", () => {
  assert.equal(formatAttachmentNames(["a.pdf", " ", "b.docx"]), "a.pdf, b.docx");
  assert.equal(formatAttachmentNames([]), "");
  assert.equal(isPdfName("tekening.PDF"), true);
  assert.equal(isPdfName("tekening.pdf.zip"), false);
});

test("isValidFolderLabel: leeg en komma zijn de twee verboden vormen", () => {
  assert.equal(isValidFolderLabel("Klanten"), true);
  assert.equal(isValidFolderLabel("   "), false);
  assert.equal(isValidFolderLabel("Klanten, prospects"), false);
});

test("effectiveSignature: de schakelaar bepaalt wat preview én verzending zien", () => {
  assert.equal(effectiveSignature("<p>Groet, Piet</p>", true), "<p>Groet, Piet</p>");
  assert.equal(effectiveSignature("<p>Groet, Piet</p>", false), "");
  // Whitespace-only telt als geen handtekening — anders toont de preview een
  // leeg kadertje en gaat er een losse <br><br> mee de deur uit.
  assert.equal(effectiveSignature("   \n ", true), "");
  assert.equal(effectiveSignature("", true), "");
});

test("buildOutgoingHtml: nieuw bericht = getypte tekst plus handtekening", () => {
  assert.equal(
    buildOutgoingHtml({
      bodyHtml: "<p>Hoi</p>",
      signature: "<p>Groet, Piet</p>",
      includeSignature: true,
    }),
    "<p>Hoi</p><br><br><p>Groet, Piet</p>"
  );
});

test("buildOutgoingHtml: schakelaar uit laat de handtekening écht weg", () => {
  const html = buildOutgoingHtml({
    bodyHtml: "<p>Hoi</p>",
    signature: "<p>Groet, Piet</p>",
    includeSignature: false,
    quoteHtml: "<p>origineel</p>",
  });
  assert.ok(!html.includes("Groet, Piet"));
  assert.ok(html.startsWith("<p>Hoi</p><br><br><blockquote"));
});

test("buildOutgoingHtml: handtekening staat boven het citaat, niet eronder", () => {
  const html = buildOutgoingHtml({
    bodyHtml: "<p>Hoi</p>",
    signature: "<p>Groet, Piet</p>",
    includeSignature: true,
    quoteHtml: "<p>origineel</p>",
  });
  assert.ok(html.indexOf("Groet, Piet") < html.indexOf("<blockquote"));
  assert.ok(html.includes("<blockquote"));
  assert.ok(html.includes("<p>origineel</p>"));
});

test("buildOutgoingHtml: nooit twee handtekeningen, ook niet bij hersamenstellen", () => {
  const once = buildOutgoingHtml({
    bodyHtml: "<p>Hoi</p>",
    signature: "<p>Groet, Piet</p>",
    includeSignature: true,
  });
  const twice = buildOutgoingHtml({
    bodyHtml: once,
    signature: "<p>Groet, Piet</p>",
    includeSignature: true,
  });
  assert.equal(twice, once);
});

test("buildOutgoingHtml: leeg citaat levert geen leeg blockquote op", () => {
  const html = buildOutgoingHtml({
    bodyHtml: "<p>Hoi</p>",
    signature: "",
    includeSignature: true,
    quoteHtml: "   ",
  });
  assert.equal(html, "<p>Hoi</p>");
});
