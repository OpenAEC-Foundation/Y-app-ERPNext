/**
 * Welke factuurmails horen bij een factuur die al in ERPNext staat.
 *
 * Eén verzoek voor alle factuurnummers die de herkenning in de zichtbare
 * lijst vond, niet één per mail. De uitkomst wordt per nummer een paar
 * minuten onthouden en gedeeld tussen de maillijst en de losse mailweergave:
 * door de lijst bladeren of een mail openen vraagt dan niets opnieuw op.
 * Wat er als "hoort bij" telt, staat in `koppelGeboekteFacturen`.
 */

import { useEffect, useMemo, useState } from "react";
import { zoekFacturenOpNummer } from "./purchase-invoice.ts";
import {
  koppelGeboekteFacturen,
  normaliseerFactuurnummer,
  type BestaandeInkoopfactuur,
  type GeboekteKandidaat,
} from "./purchase-invoice-duplicates.ts";

const BEWAARTIJD_MS = 5 * 60_000;

const opgezocht = new Map<string, { at: number; facturen: BestaandeInkoopfactuur[] }>();

export function useGeboekteFacturen(
  kandidaten: GeboekteKandidaat[],
): Map<string, BestaandeInkoopfactuur> {
  const sleutel = useMemo(
    () => [...new Set(kandidaten.map((k) => k.billNo.trim()).filter(Boolean))].sort().join("\n"),
    [kandidaten],
  );
  const [versie, setVersie] = useState(0);

  useEffect(() => {
    const nu = Date.now();
    const ontbrekend = (sleutel ? sleutel.split("\n") : []).filter((n) => {
      const bekend = opgezocht.get(normaliseerFactuurnummer(n));
      return !bekend || nu - bekend.at > BEWAARTIJD_MS;
    });
    if (ontbrekend.length === 0) return;
    let cancelled = false;
    zoekFacturenOpNummer(ontbrekend).then((rijen) => {
      const at = Date.now();
      // Ook "niets gevonden" onthouden; anders vraagt elke render het opnieuw.
      for (const n of ontbrekend) opgezocht.set(normaliseerFactuurnummer(n), { at, facturen: [] });
      for (const rij of rijen) {
        const nummer = normaliseerFactuurnummer(rij.bill_no);
        const bekend = opgezocht.get(nummer);
        if (bekend) bekend.facturen.push(rij);
        else opgezocht.set(nummer, { at, facturen: [rij] });
      }
      if (!cancelled) setVersie((v) => v + 1);
    }).catch(() => { /* zonder uitkomst blijft het gewone inboekvoorstel staan */ });
    return () => { cancelled = true; };
  }, [sleutel]);

  return useMemo(() => {
    const facturen = kandidaten.flatMap(
      (k) => opgezocht.get(normaliseerFactuurnummer(k.billNo))?.facturen ?? [],
    );
    return koppelGeboekteFacturen(kandidaten, facturen);
    // `versie` telt mee: de cache zit buiten React en verandert niet van identiteit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kandidaten, versie]);
}
