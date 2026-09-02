import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestProject, type ProjectHint, type ProjectSuggestSignals } from "./project-suggest.ts";

/**
 * Uittreksel uit de projectlijst van de doelinstance, met precies de twee
 * eigenschappen die de valkuilen zijn:
 *
 * - **Twee projecten van dezelfde klant** (PROJ-0087 en PROJ-0088, allebei Van
 *   Dorp Infra B.V.). De klant alleen mag dus nooit een voorstel opleveren.
 * - **Een woord dat overal in zit** ("Open" staat op deze instance in twintig
 *   projectnamen). Zo'n token moet voor nul meetellen.
 */
const PROJECTS: ProjectHint[] = [
  { name: "PROJ-0001", projectName: "Implementatie 3BM Zwijndrecht", customer: "3BM Bouwtechniek V.O.F." },
  { name: "PROJ-0004", projectName: "Implementatie Domera Gouda", customer: "Domera" },
  { name: "PROJ-0030", projectName: "3BM-PyRevit-WayOfWork", customer: "OpenAEC Foundation" },
  { name: "PROJ-0043", projectName: "OpenAEC-Website", customer: "OpenAEC Foundation" },
  { name: "PROJ-0057", projectName: "Open Energy Studio" },
  { name: "PROJ-0059", projectName: "Open 3D Viewer" },
  { name: "PROJ-0060", projectName: "Open Feedback Studio" },
  { name: "PROJ-0061", projectName: "Open MPG Studio" },
  { name: "PROJ-0071", projectName: "Open Orchestrator Studio" },
  { name: "PROJ-0072", projectName: "Open Field Studio" },
  { name: "PROJ-0087", projectName: "Van Dorp Infra uren", customer: "Van Dorp Infra B.V." },
  { name: "PROJ-0088", projectName: "Van Dorp Infra Open Baken Studio", customer: "Van Dorp Infra B.V." },
];

function mail(over: Partial<ProjectSuggestSignals>): ProjectSuggestSignals {
  return { subject: "", sender: "", direction: "received", intentKind: "none", ...over };
}

test("projectnummer in het onderwerp levert dat project op", () => {
  const hit = suggestProject(mail({
    subject: "Voortgang PROJ-0087 week 34",
    sender: "hulsing@vandorp.eu",
  }), PROJECTS);
  assert.equal(hit?.project, "PROJ-0087");
  assert.ok(hit?.reasons.includes("project:number"));
});

test("eerdere koppeling in dezelfde conversatie is beslissend", () => {
  const hit = suggestProject(mail({
    subject: "Re: sleuven en boringen",
    sender: "hulsing@vandorp.eu",
    threadProjects: ["PROJ-0088"],
  }), PROJECTS);
  assert.equal(hit?.project, "PROJ-0088");
  assert.equal(hit?.confidence, "high");
  assert.ok(hit?.reasons.includes("project:thread"));
});

test("klant alleen is nooit genoeg — twee projecten, geen voorstel", () => {
  const hit = suggestProject(mail({
    subject: "Even bellen deze week?",
    sender: "hulsing@vandorp.eu",
    senderCustomer: "Van Dorp Infra B.V.",
  }), PROJECTS);
  assert.equal(hit, null);
});

test("historie plus klant halen samen wel de drempel", () => {
  const hit = suggestProject(mail({
    subject: "Even bellen deze week?",
    sender: "hulsing@vandorp.eu",
    senderCustomer: "Van Dorp Infra B.V.",
    senderProjects: ["PROJ-0087"],
  }), PROJECTS);
  assert.equal(hit?.project, "PROJ-0087");
  assert.ok(hit?.reasons.includes("project:history"));
  assert.ok(hit?.reasons.includes("project:customer"));
});

test("een alledaags woord uit de projectnaam levert niets op", () => {
  // "Open" en "Studio" staan in een groot deel van de projectnamen; een mail
  // met die woorden mag geen willekeurig project aanwijzen.
  const hit = suggestProject(mail({
    subject: "Open PDF Studio",
    sender: "bswk@ramboll.com",
  }), PROJECTS);
  assert.equal(hit, null);
});

test("factuurmail van 3BM wordt niet aan een 3BM-project gehangen", () => {
  // Twee remmen tegelijk: de intent is al "inkoopfactuur" (één voorstel per
  // mail), én "3bm" alleen haalt de drempel niet.
  const asInvoice = suggestProject(mail({
    subject: "Factuur 3BM Bouwtechniek V.O.F. 263-05192",
    sender: "maarten@3bm.co.nl",
    attachmentNames: ["263-05192.pdf"],
    intentKind: "purchase-invoice",
  }), PROJECTS);
  assert.equal(asInvoice, null);

  const withoutIntent = suggestProject(mail({
    subject: "Factuur 3BM Bouwtechniek V.O.F. 263-05192",
    sender: "maarten@3bm.co.nl",
    attachmentNames: ["263-05192.pdf"],
    senderCustomer: "3BM Bouwtechniek V.O.F.",
  }), PROJECTS);
  assert.equal(withoutIntent, null);
});

test("een lead krijgt geen projectvoorstel eronder", () => {
  const hit = suggestProject(mail({
    subject: "Kennismaking PROJ-0087",
    sender: "iemand@nieuw.nl",
    intentKind: "lead",
  }), PROJECTS);
  assert.equal(hit, null);
});

test("verzonden mail en al gekoppelde mail leveren niets op", () => {
  assert.equal(suggestProject(mail({
    subject: "PROJ-0087 planning", sender: "maarten@open-aec.com", direction: "sent",
  }), PROJECTS), null);
  assert.equal(suggestProject(mail({
    subject: "PROJ-0087 planning", sender: "hulsing@vandorp.eu", linkedDoctype: "Project",
  }), PROJECTS), null);
});

test("gelijkspel levert geen gok op", () => {
  const hit = suggestProject(mail({
    subject: "Overleg",
    sender: "hulsing@vandorp.eu",
    senderCustomer: "Van Dorp Infra B.V.",
    senderProjects: ["PROJ-0087", "PROJ-0088"],
  }), PROJECTS);
  assert.equal(hit, null);
});

test("geciteerde staart van de mail telt niet mee", () => {
  // Het projectnummer staat pas ná 2000 tekens, in een doorgestuurde eerdere
  // mail. Dat is geen uitspraak over déze mail.
  const filler = "x".repeat(2400);
  const hit = suggestProject(mail({
    subject: "Vraagje",
    sender: "hulsing@vandorp.eu",
    bodyText: `${filler}\nVan: iemand\nOnderwerp: PROJ-0087 planning`,
  }), PROJECTS);
  assert.equal(hit, null);
});
