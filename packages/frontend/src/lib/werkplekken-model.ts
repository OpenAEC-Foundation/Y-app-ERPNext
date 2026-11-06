/**
 * Werkplekken — het model achter de pagina, zonder netwerk.
 *
 * Drie eigen doctypes van de app (definities in
 * `frappe-app/y_next/y_next/doctype/`):
 * - `Y Werkplek Persoon`: iedereen die op kantoor kan zitten, ook mensen
 *   zonder ERP-account. Per weekdag een standaard (Kantoor, Thuis, Keuze of
 *   leeg = werkt niet).
 * - `Y Werkplek`: een bureau in een ruimte, eventueel met een vaste persoon
 *   of een persoon die er bij voorkeur zit.
 * - `Y Werkplek Boeking`: een afwijking op één dag. Die wint van het patroon.
 *
 * Welke plek iemand krijgt, rekent `deelInWeek` uit. De regels van het
 * kantoor: een vaste plek is van de eigenaar, flexers zitten op de
 * flexplekken en zoveel mogelijk steeds op dezelfde, en alleen als het echt
 * niet anders kan op de vaste plek van iemand die er niet is.
 *
 * Taken komen uit de gewone ERPNext-takenplanning (Task, toegewezen via
 * `_assign`). Deze module leest alleen hun datums; wat een taak "op een dag"
 * maakt, staat in `takenOpDag`.
 */

export const DT_PERSOON = "Y Werkplek Persoon";
export const DT_WERKPLEK = "Y Werkplek";
export const DT_BOEKING = "Y Werkplek Boeking";

export const DAGEN = ["ma", "di", "wo", "do", "vr"] as const;
export type Dag = (typeof DAGEN)[number];

/** Wat er in het patroon per weekdag staat. Leeg betekent: werkt die dag niet. */
export type PatroonWaarde = "" | "Kantoor" | "Thuis" | "Keuze";
export const PATROON_WAARDEN: PatroonWaarde[] = ["", "Kantoor", "Thuis", "Keuze"];

export type BoekingStatus = "Kantoor" | "Thuis" | "Afwezig";
export const BOEKING_STATUSSEN: BoekingStatus[] = ["Kantoor", "Thuis", "Afwezig"];

export interface Persoon {
  name: string;
  naam: string;
  gebruiker: string | null;
  dag_ma: PatroonWaarde | null;
  dag_di: PatroonWaarde | null;
  dag_wo: PatroonWaarde | null;
  dag_do: PatroonWaarde | null;
  dag_vr: PatroonWaarde | null;
  wisselend: 0 | 1;
  af_en_toe: 0 | 1;
  /** Staat in de lijst met mensen (bijvoorbeeld bij de apps), maar krijgt geen bureau. */
  geen_werkplek: 0 | 1;
  actief: 0 | 1;
  volgorde: number;
  notitie: string | null;
}

export interface Werkplek {
  name: string;
  plek: string;
  ruimte: string;
  omschrijving: string | null;
  vaste_persoon: string | null;
  voorkeur_persoon: string | null;
  volgorde: number;
  actief: 0 | 1;
}

export interface Boeking {
  name: string;
  persoon: string;
  datum: string;
  status: BoekingStatus;
  werkplek: string | null;
  notitie: string | null;
}

/**
 * Hoe iemand er op een dag voor staat:
 * - kantoor / thuis / afwezig: bekend;
 * - keuze: één van een paar dagen, nog niet doorgegeven welke;
 * - onbekend: wisselend rooster, deze dag nog niet doorgegeven;
 * - vrij: werkt deze dag niet.
 */
export type DagStand = "kantoor" | "thuis" | "afwezig" | "keuze" | "onbekend" | "vrij";

export interface DagInvulling {
  stand: DagStand;
  /** Komt deze stand uit een boeking (en niet uit het patroon)? */
  geboekt: boolean;
  /** De plek uit de boeking, als die er een noemt. */
  gevraagdePlek: string | null;
  /** Komt deze stand uit de eigen agenda (zie `werkplekken-agenda.ts`)? */
  uitAgenda?: boolean;
}

/** Een datum als "2026-11-03", in lokale tijd. */
export function isoDatum(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** De maandag van de week waar `d` in valt. */
export function maandagVan(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

/** Maandag tot en met vrijdag als ISO-datums. */
export function werkdagen(maandag: Date): string[] {
  return DAGEN.map((_, i) => isoDatum(new Date(maandag.getFullYear(), maandag.getMonth(), maandag.getDate() + i)));
}

/** ISO-weeknummer. */
export function weekNummer(d: Date): number {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const w1 = new Date(t.getFullYear(), 0, 4);
  return 1 + Math.round(((t.getTime() - w1.getTime()) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
}

export function patroonVan(p: Persoon, dag: Dag): PatroonWaarde {
  return (p[`dag_${dag}`] || "") as PatroonWaarde;
}

const STAND_VAN: Record<BoekingStatus, DagStand> = { Kantoor: "kantoor", Thuis: "thuis", Afwezig: "afwezig" };

/**
 * De dag van een persoon: een boeking (met de hand in Werkplekken) wint, dan
 * wat de eigen agenda zegt, en anders het vaste patroon.
 */
export function invulling(p: Persoon, dag: Dag, boeking: Boeking | undefined, agenda?: BoekingStatus): DagInvulling {
  if (boeking) {
    return { stand: STAND_VAN[boeking.status], geboekt: true, gevraagdePlek: boeking.status === "Kantoor" ? boeking.werkplek || null : null };
  }
  if (agenda) return { stand: STAND_VAN[agenda], geboekt: false, gevraagdePlek: null, uitAgenda: true };
  const waarde = patroonVan(p, dag);
  if (waarde === "Kantoor") return { stand: "kantoor", geboekt: false, gevraagdePlek: null };
  if (waarde === "Thuis") return { stand: "thuis", geboekt: false, gevraagdePlek: null };
  if (waarde === "Keuze") return { stand: "keuze", geboekt: false, gevraagdePlek: null };
  if (p.wisselend) return { stand: "onbekend", geboekt: false, gevraagdePlek: null };
  return { stand: "vrij", geboekt: false, gevraagdePlek: null };
}

/** Hoe iemand aan een plek komt; bepaalt hoe het vakje eruitziet. */
export type PlekReden =
  | "eigen"       // zijn of haar vaste plek
  | "gekozen"     // de plek uit de boeking
  | "voorkeur"    // flexplek waar hij of zij meestal zit
  | "flex"        // een vrije flexplek
  | "leen"        // vaste plek van iemand die er die dag niet is
  | "dubbel";     // geboekt op een plek die al bezet is

export interface Plaatsing {
  persoon: string;
  werkplek: string | null;
  reden: PlekReden | null;
}

/**
 * Deelt een hele week in. Per dag krijgt iedereen die op kantoor is een plek,
 * en over de week heen zit iemand zoveel mogelijk steeds op dezelfde plek.
 *
 * De regels van het kantoor, in deze volgorde:
 * 1. wie een vaste plek heeft, zit daar;
 * 2. wie op een dag met de hand op een plek is gezet, zit daar (staat er al
 *    iemand, dan "dubbel");
 * 3. de flexers krijgen per week één eigen flexplek: eerst wie een plek als
 *    "meestal voor" heeft, daarna wie het vaakst komt. Met de hand
 *    neerzetten geldt alleen voor die ene dag en verandert de andere dagen
 *    niet. Gekozen wordt de
 *    flexplek die op de meeste van zijn of haar dagen vrij is; een flexplek
 *    die meestal van een ander is, het laatst. Omdat de volgorde vastligt,
 *    komt iemand ook week na week op dezelfde plek uit;
 * 4. lukt dat op een dag niet, dan een andere vrije flexplek;
 * 5. pas als er echt geen flexplek meer is, de vaste plek van iemand die er
 *    die dag zeker niet is (vrij, thuis of afwezig), en daarna van iemand van
 *    wie het nog niet bekend is. Een vaste plek is van de eigenaar;
 * 6. lukt ook dat niet, dan geen plek (`werkplek: null`).
 *
 * `standenPerDag` heeft één kaart per dag (persoon → invulling); het
 * resultaat ook (persoon → plaatsing, alleen voor wie op kantoor is).
 */
export function deelInWeek(
  personen: Persoon[],
  werkplekken: Werkplek[],
  standenPerDag: Map<string, DagInvulling>[],
): Map<string, Plaatsing>[] {
  const plekken = werkplekken.filter((w) => w.actief).sort(opVolgorde);
  const flex = plekken.filter((w) => !w.vaste_persoon);
  const eigenPlek = new Map(plekken.filter((w) => w.vaste_persoon).map((w) => [w.vaste_persoon as string, w.name]));
  const opKantoor = (dag: number) => personen
    .filter((p) => standenPerDag[dag].get(p.name)?.stand === "kantoor")
    .sort(opVolgorde);

  const bezet = standenPerDag.map(() => new Map<string, string>());
  const uit = standenPerDag.map(() => new Map<string, Plaatsing>());
  const zet = (dag: number, persoon: string, werkplek: string | null, reden: PlekReden | null) => {
    if (werkplek) bezet[dag].set(werkplek, persoon);
    uit[dag].set(persoon, { persoon, werkplek, reden });
  };

  // 1–2. Per dag: vaste plekken, dan wat met de hand is gezet.
  standenPerDag.forEach((standen, dag) => {
    for (const p of opKantoor(dag)) {
      const eigen = eigenPlek.get(p.name);
      const gevraagd = standen.get(p.name)?.gevraagdePlek;
      if (eigen && (!gevraagd || gevraagd === eigen)) zet(dag, p.name, eigen, "eigen");
    }
    for (const p of opKantoor(dag)) {
      if (uit[dag].has(p.name)) continue;
      const gevraagd = standen.get(p.name)?.gevraagdePlek;
      if (!gevraagd || !plekken.some((w) => w.name === gevraagd)) continue;
      if (bezet[dag].has(gevraagd)) uit[dag].set(p.name, { persoon: p.name, werkplek: gevraagd, reden: "dubbel" });
      else zet(dag, p.name, gevraagd, "gekozen");
    }
  });

  // 3. Eén flexplek per persoon voor de hele week.
  const openDagen = (naam: string) => standenPerDag
    .map((_, dag) => dag)
    .filter((dag) => standenPerDag[dag].get(naam)?.stand === "kantoor" && !uit[dag].has(naam));
  const flexers = personen
    .filter((p) => openDagen(p.name).length > 0)
    .map((p) => ({ p, voorkeur: flex.find((w) => w.voorkeur_persoon === p.name), dagen: openDagen(p.name) }))
    .sort((a, b) => Number(!!b.voorkeur) - Number(!!a.voorkeur) || b.dagen.length - a.dagen.length || opVolgorde(a.p, b.p));
  for (const { p, voorkeur, dagen } of flexers) {
    const vrijOp = (w: Werkplek) => dagen.filter((dag) => !bezet[dag].has(w.name)).length;
    const vanEenAnder = (w: Werkplek) => (w.voorkeur_persoon && w.voorkeur_persoon !== p.name ? 1 : 0);
    const kandidaten = flex
      .filter((w) => vrijOp(w) > 0)
      .sort((a, b) => Number(b === voorkeur) - Number(a === voorkeur) || vrijOp(b) - vrijOp(a) || vanEenAnder(a) - vanEenAnder(b) || opVolgorde(a, b));
    const thuisPlek = kandidaten[0];
    if (!thuisPlek) continue;
    for (const dag of dagen) {
      if (!bezet[dag].has(thuisPlek.name)) zet(dag, p.name, thuisPlek.name, thuisPlek === voorkeur ? "voorkeur" : "flex");
    }
  }

  // 4–6. Wat overblijft, per dag.
  standenPerDag.forEach((standen, dag) => {
    const zekerWeg = (w: Werkplek) => {
      const s = standen.get(w.vaste_persoon as string)?.stand;
      return s === undefined || s === "vrij" || s === "thuis" || s === "afwezig";
    };
    const eigenaarMisschien = (w: Werkplek) => standen.get(w.vaste_persoon as string)?.stand !== "kantoor";
    for (const p of opKantoor(dag)) {
      if (uit[dag].has(p.name)) continue;
      const vrijeFlex = flex.filter((w) => !bezet[dag].has(w.name));
      const plek = vrijeFlex.find((w) => !w.voorkeur_persoon) || vrijeFlex[0];
      if (plek) { zet(dag, p.name, plek.name, "flex"); continue; }
      const leen = plekken.find((w) => w.vaste_persoon && !bezet[dag].has(w.name) && zekerWeg(w))
        || plekken.find((w) => w.vaste_persoon && !bezet[dag].has(w.name) && eigenaarMisschien(w));
      zet(dag, p.name, leen ? leen.name : null, leen ? "leen" : null);
    }
  });
  return uit;
}

export interface DagOverzicht {
  datum: string;
  dag: Dag;
  standen: Map<string, DagInvulling>;
  plaatsing: Map<string, Plaatsing>;
}

/**
 * De hele week van maandag tot en met vrijdag: per dag hoe iedereen ervoor
 * staat en waar wie zit. Dezelfde berekening voor de pagina en de widget op
 * het dashboard, zodat ze nooit iets anders laten zien.
 */
export function berekenWeek(
  personen: Persoon[], werkplekken: Werkplek[], boekingen: Boeking[], maandag: Date,
  /** Per e-mailadres (kleine letters) en datum wat de agenda zegt; zie `agendaPerDag`. */
  agenda?: Map<string, Map<string, BoekingStatus>>,
): DagOverzicht[] {
  const actief = opKantoorTePlaatsen(personen);
  const dagen = werkdagen(maandag);
  const standen = dagen.map((datum, i) => new Map(actief.map((p) =>
    [p.name, invulling(p, DAGEN[i], boekingen.find((b) => b.persoon === p.name && b.datum === datum),
      p.gebruiker ? agenda?.get(p.gebruiker.toLowerCase())?.get(datum) : undefined)])));
  const plaatsing = deelInWeek(actief, werkplekken, standen);
  return dagen.map((datum, i) => ({ datum, dag: DAGEN[i], standen: standen[i], plaatsing: plaatsing[i] }));
}

/** Wie bij Werkplekken meetelt: actief en niet met "geen werkplek". */
export function opKantoorTePlaatsen(personen: Persoon[]): Persoon[] {
  return sorteerPersonen(personen.filter((p) => p.actief && !p.geen_werkplek));
}

/** De persoon die bij een ERP-gebruiker hoort, of undefined. */
export function persoonVanGebruiker(personen: Persoon[], gebruiker: string | null | undefined): Persoon | undefined {
  if (!gebruiker) return undefined;
  const wie = gebruiker.toLowerCase();
  return personen.find((p) => p.actief && (p.gebruiker || "").toLowerCase() === wie);
}

/** Eén dag indelen; dezelfde regels als `deelInWeek`. */
export function deelIn(
  personen: Persoon[],
  werkplekken: Werkplek[],
  standen: Map<string, DagInvulling>,
): Map<string, Plaatsing> {
  return deelInWeek(personen, werkplekken, [standen])[0];
}

function opVolgorde<T extends { volgorde: number; name: string }>(a: T, b: T): number {
  return (a.volgorde || 0) - (b.volgorde || 0) || a.name.localeCompare(b.name);
}

export function sorteerPersonen(personen: Persoon[]): Persoon[] {
  return [...personen].sort(opVolgorde);
}

export function sorteerWerkplekken(werkplekken: Werkplek[]): Werkplek[] {
  return [...werkplekken].sort(opVolgorde);
}

/** Werkplekken per ruimte, in de volgorde waarin de ruimtes voor het eerst voorkomen. */
export function perRuimte(werkplekken: Werkplek[]): { ruimte: string; plekken: Werkplek[] }[] {
  const groepen: { ruimte: string; plekken: Werkplek[] }[] = [];
  for (const w of sorteerWerkplekken(werkplekken)) {
    const g = groepen.find((x) => x.ruimte === w.ruimte);
    if (g) g.plekken.push(w);
    else groepen.push({ ruimte: w.ruimte, plekken: [w] });
  }
  return groepen;
}

export type PersoonGroep = "vast" | "flex";

/** Vast = heeft een vaste plek; de rest is flex. */
export function groepVan(p: Persoon, werkplekken: Werkplek[]): PersoonGroep {
  return werkplekken.some((w) => w.actief && w.vaste_persoon === p.name) ? "vast" : "flex";
}

/** Korte omschrijving van iemands patroon, zoals "ma di do vr" of "di + do/vr". */
export function patroonTekst(p: Persoon): string {
  const vast = DAGEN.filter((d) => patroonVan(p, d) === "Kantoor");
  const keuze = DAGEN.filter((d) => patroonVan(p, d) === "Keuze");
  const delen: string[] = [];
  if (vast.length === 5) delen.push("elke dag");
  else if (vast.length) delen.push(vast.join(" "));
  if (keuze.length) delen.push(keuze.join("/"));
  return delen.join(" + ");
}

// ── Taken ──────────────────────────────────────────────────────────────────

export interface TaakRegel {
  name: string;
  subject: string;
  project: string | null;
  status: string;
  exp_start_date: string | null;
  exp_end_date: string | null;
  _assign: string | null;
}

/** Statussen van een taak waar niets meer aan gebeurt. */
export const AFGERONDE_TAAKSTATUSSEN = ["Completed", "Cancelled", "Template"];

/**
 * Alleen het datumdeel. De datums van een taak komen soms als datum-tijd
 * ("2026-11-02 00:00:00"); als tekst vergeleken valt de startdag dan buiten
 * de taak, en `new Date()` maakt er "Invalid Date" van.
 */
export function alleenDatum(waarde: string | null | undefined): string | null {
  return waarde ? waarde.slice(0, 10) : null;
}

/** De e-mailadressen uit `_assign` (een JSON-lijst). */
export function toegewezenAan(t: Pick<TaakRegel, "_assign">): string[] {
  if (!t._assign) return [];
  try {
    const lijst = JSON.parse(t._assign);
    return Array.isArray(lijst) ? lijst.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Loopt een taak op deze dag? Alleen taken met een datum tellen: zonder start
 * en zonder deadline staat een taak nergens ingepland, en juist dat moet in
 * beeld komen. Met alleen een deadline loopt hij tot die deadline; met alleen
 * een start vanaf die start.
 */
export function loopOp(t: Pick<TaakRegel, "exp_start_date" | "exp_end_date">, datum: string): boolean {
  const start = alleenDatum(t.exp_start_date);
  const eind = alleenDatum(t.exp_end_date);
  if (!start && !eind) return false;
  if (start && datum < start) return false;
  if (eind && datum > eind) return false;
  return true;
}

/** De open taken van één gebruiker op één dag, met de vroegste deadline eerst. */
export function takenOpDag(taken: TaakRegel[], gebruiker: string | null, datum: string): TaakRegel[] {
  if (!gebruiker) return [];
  const wie = gebruiker.toLowerCase();
  return taken
    .filter((t) => !AFGERONDE_TAAKSTATUSSEN.includes(t.status))
    .filter((t) => toegewezenAan(t).some((e) => e.toLowerCase() === wie))
    .filter((t) => loopOp(t, datum))
    .sort((a, b) => (alleenDatum(a.exp_end_date) || "9999").localeCompare(alleenDatum(b.exp_end_date) || "9999") || a.subject.localeCompare(b.subject));
}

/** Open taken van iemand waarvan de deadline al voor `datum` lag. */
export function teLaat(taken: TaakRegel[], gebruiker: string | null, datum: string): TaakRegel[] {
  if (!gebruiker) return [];
  const wie = gebruiker.toLowerCase();
  return taken.filter((t) => !AFGERONDE_TAAKSTATUSSEN.includes(t.status)
    && !!t.exp_end_date && (alleenDatum(t.exp_end_date) as string) < datum
    && toegewezenAan(t).some((e) => e.toLowerCase() === wie));
}
