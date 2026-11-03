import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import type { DagInvulling, Persoon, Plaatsing } from "../../lib/werkplekken-model";
import { VAKJE } from "./werkplekken-ui";

export function Kader({ klasse, titel, onClick, label }: {
  klasse: string; titel: ReactNode; onClick?: () => void; label?: string;
}) {
  const basis = `block w-full rounded-lg border px-2 py-2 text-left text-xs leading-snug ${klasse}`;
  const inhoud = <span className="block truncate font-medium">{titel}</span>;
  return onClick
    ? <button type="button" onClick={onClick} aria-label={label} className={`${basis} cursor-pointer hover:ring-2 hover:ring-y-teal/30`}>{inhoud}</button>
    : <div className={basis}>{inhoud}</div>;
}

/**
 * Hoe iemand er op een dag voor staat. Op kantoor in de eigen kleur van die
 * persoon; thuis grijs, nog open gestippeld, geen plek rood.
 */
export function PersoonVakje({ persoon, kleur, stand, plaatsing, plekNaam, titel, onClick }: {
  persoon: Persoon;
  kleur: string;
  stand: DagInvulling;
  plaatsing: Plaatsing | undefined;
  plekNaam: (id: string) => string;
  /** Wat erin staat; standaard de plek (in de weergave per persoon). */
  titel?: string;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const label = t("werkplekken.dag_aanpassen", { naam: persoon.naam });

  if (stand.stand === "kantoor") {
    const plek = plaatsing?.werkplek ?? null;
    if (!plek || plaatsing?.reden === "dubbel") {
      return <Kader klasse={VAKJE.fout} titel={titel ?? t("werkplekken.geen_plek")} onClick={onClick} label={label} />;
    }
    return <Kader klasse={kleur} titel={titel ?? plekNaam(plek)} onClick={onClick} label={label} />;
  }
  if (stand.stand === "thuis") return <Kader klasse={VAKJE.thuis} titel={titel ?? t("werkplekken.thuis")} onClick={onClick} label={label} />;
  if (stand.stand === "afwezig") return <Kader klasse={VAKJE.vrij} titel={titel ?? t("werkplekken.afwezig")} onClick={onClick} label={label} />;
  if (stand.stand === "keuze" || stand.stand === "onbekend") return <Kader klasse={VAKJE.open} titel={titel ?? "?"} onClick={onClick} label={label} />;
  return <Kader klasse={VAKJE.vrij} titel={titel ?? "—"} onClick={onClick} label={label} />;
}
