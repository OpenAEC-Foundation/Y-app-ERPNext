/**
 * Werkplekken uit de agenda: wie in zijn eigen agenda (Stalwart) een
 * hele-dag-afspraak "Kantoor", "Thuis" of "Vrij" zet, staat die dag zo in het
 * overzicht (ook als tijdafspraak, bijvoorbeeld 0:00–23:59 of 9:00–17:00: de
 * titel beslist). De afspraken komen via het Server Script `agenda_ophalen`, dat
 * met één serviceaccount bij iedereen mag kijken (zie `agenda-mailserver.ts`).
 *
 * Volgorde van wat telt: een boeking in Werkplekken (met de hand) wint van de
 * agenda, en de agenda wint van het vaste weekpatroon.
 *
 * Pure module, zonder netwerk.
 */
import { kerenInPeriode, type ReeksBron } from "./agenda-herhaling.ts";
import type { BoekingStatus } from "./werkplekken-model.ts";

/** Het stukje van een agenda-afspraak dat we hier nodig hebben. */
export interface AgendaAfspraak extends ReeksBron {
  gebruiker: string;
  titel?: string;
  hele_dag?: boolean;
}

/** Eerste woord(en) van de titel → wat het voor die dag betekent. */
const TREFWOORDEN: [RegExp, BoekingStatus][] = [
  [/^(vrij|vrije dag|vakantie|verlof|ziek|afwezig)\b/, "Afwezig"],
  [/^(thuis|thuiswerken|thuiswerkdag|wfh)\b/, "Thuis"],
  [/^(kantoor|op kantoor)\b/, "Kantoor"],
];

/** Wat een titel betekent, of null als het een gewone afspraak is. */
export function statusUitTitel(titel: string | undefined): BoekingStatus | null {
  const t = (titel || "").trim().toLowerCase();
  for (const [patroon, status] of TREFWOORDEN) if (patroon.test(t)) return status;
  return null;
}

/** Een ISO-duur ("P3D", "PT23H59M", "P1W") in minuten; 0 als hij niet te lezen is. */
export function minutenVanDuur(duur: string | undefined): number {
  const m = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(duur || "");
  if (!m) return 0;
  return ((Number(m[1] || 0) * 7 + Number(m[2] || 0)) * 24 + Number(m[3] || 0)) * 60 + Number(m[4] || 0);
}

/**
 * De datums waarop een afspraak valt: van de begindag tot de dag waarop hij
 * eindigt. Eindigt hij precies om middernacht, dan telt die dag niet meer mee
 * (een hele dag "P1D" is één dag, niet twee).
 */
export function dagenVanAfspraak(start: string, duur: string | undefined): string[] {
  const begin = start.slice(0, 10);
  const minuten = minutenVanDuur(duur);
  if (minuten <= 0) return [begin];
  const tijd = /T(\d{2}):(\d{2})/.exec(start);
  const vanafMiddernacht = tijd ? Number(tijd[1]) * 60 + Number(tijd[2]) : 0;
  const laatsteDag = Math.floor((vanafMiddernacht + minuten - 1) / (24 * 60));
  return Array.from({ length: laatsteDag + 1 }, (_, i) => plusDagen(begin, i));
}

function plusDagen(datum: string, n: number): string {
  const d = new Date(`${datum}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Bij twee afspraken op één dag wint de zwaarste: afwezig, dan thuis, dan kantoor. */
const GEWICHT: Record<BoekingStatus, number> = { Afwezig: 3, Thuis: 2, Kantoor: 1 };

/**
 * Per gebruiker (e-mailadres, kleine letters) en per datum wat de agenda zegt,
 * voor de dagen in `dagen`. Alleen de titel telt (zie `statusUitTitel`); een
 * gewone afspraak als "Overleg op kantoor" zegt niets over waar je die dag bent.
 */
export function agendaPerDag(afspraken: AgendaAfspraak[], dagen: string[]): Map<string, Map<string, BoekingStatus>> {
  const uit = new Map<string, Map<string, BoekingStatus>>();
  if (!dagen.length) return uit;
  const van = dagen[0];
  const tot = dagen[dagen.length - 1];
  for (const a of afspraken) {
    const status = statusUitTitel(a.titel);
    if (!status) continue;
    const wie = a.gebruiker.toLowerCase();
    // Een reeks of een afspraak van meerdere dagen die vóór de week begint,
    // kan er nog in doorlopen: kijk zo ver terug als hij lang is.
    const lengte = Math.ceil(minutenVanDuur(a.duur) / (24 * 60)) || 1;
    for (const keer of kerenInPeriode(a, plusDagen(van, -lengte), tot)) {
      for (const dag of dagenVanAfspraak(keer.start, keer.duur)) {
        if (!dagen.includes(dag)) continue;
        const perDag = uit.get(wie) ?? new Map<string, BoekingStatus>();
        const al = perDag.get(dag);
        if (!al || GEWICHT[status] > GEWICHT[al]) perDag.set(dag, status);
        uit.set(wie, perDag);
      }
    }
  }
  return uit;
}
