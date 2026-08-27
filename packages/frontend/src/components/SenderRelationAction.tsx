/**
 * Eén plek in de actiebalk voor "wie is deze afzender eigenlijk?".
 *
 * De component heeft precies twee gedaantes en kiest zelf welke:
 *
 *   - **Onbekend** → een *secundaire* knop die de `AddRelationDialog` opent.
 *     Secundair is geen detail: in de balk staat al een primaire actie (de
 *     factuur boeken, de lead aanmaken) en die blijft de hoofdweg. Zie de
 *     toelichting bij de leadbalk in `Webmail.tsx` voor waarom die twee niet
 *     als twee gelijkwaardige knoppen naast elkaar staan.
 *   - **Bekend** → een subtiel, doorklikbaar chipje ("bekend als klant:
 *     Van Dorp Infra B.V."). Geen knop meer: er valt niets meer vast te
 *     leggen, alleen nog te kijken.
 *
 * Zolang de dubbelcheck loopt rendert hij **niets**. Een spinner die na 200 ms
 * in een knop verandert laat de balk springen precies wanneer de gebruiker
 * ernaartoe beweegt; een halve seconde niets is rustiger.
 *
 * De kleurtoon komt van buiten mee, zodat hetzelfde chipje in de amberkleurige
 * factuurbalk, de violette leadbalk en de neutrale kopregel past zonder dat er
 * drie varianten van deze component hoeven te bestaan.
 */

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Building2, ExternalLink, UserPlus } from "lucide-react";
import { relationDocUrl, type ExistingRelation } from "../lib/erp-relation";
import { getErpNextLinkUrl } from "../lib/erpnext";

export type RelationSlotTone = "violet" | "amber" | "slate";

/** Knop- en chipklassen per balkkleur. */
const TONES: Record<RelationSlotTone, { button: string; chip: string }> = {
  violet: {
    button: "text-violet-800 hover:bg-violet-100",
    chip: "bg-violet-100 text-violet-800 hover:bg-violet-200",
  },
  amber: {
    button: "text-amber-800 hover:bg-amber-100",
    chip: "bg-amber-100 text-amber-800 hover:bg-amber-200",
  },
  slate: {
    button: "border border-slate-200 text-slate-500 hover:bg-slate-50",
    chip: "bg-slate-100 text-slate-600 hover:bg-slate-200",
  },
};

export interface SenderRelationActionProps {
  /** Uitkomst van de dubbelcheck. `null` = die loopt nog. */
  existing: ExistingRelation | null;
  tone: RelationSlotTone;
  /** Tekst op de knop; in de leadbalk de smallere "Alleen als relatie vastleggen". */
  label: string;
  onAdd: () => void;
}

export default function SenderRelationAction({ existing, tone, label, onAdd }: SenderRelationActionProps) {
  const { t } = useTranslation();
  if (!existing) return null;

  const classes = TONES[tone];

  /* Bekend: het meest zeggende record wint. Een klant zegt meer dan een los
     contactpersoon, en een contactpersoon meer dan een lopende lead. */
  if (existing.customer) {
    return (
      <RelationChip
        className={classes.chip}
        href={relationDocUrl("Customer", existing.customer)}
        text={t("y_next.rel_known_customer", { name: existing.customer })}
        icon={<Building2 size={10} />}
      />
    );
  }
  if (existing.contact) {
    return (
      <RelationChip
        className={classes.chip}
        href={relationDocUrl("Contact", existing.contact)}
        text={t("y_next.rel_known_contact", { name: existing.contact })}
        icon={<UserPlus size={10} />}
      />
    );
  }
  if (existing.lead) {
    return (
      <RelationChip
        className={classes.chip}
        href={`${getErpNextLinkUrl()}/lead/${encodeURIComponent(existing.lead)}`}
        text={t("y_next.rel_known_lead", { name: existing.lead })}
        icon={<UserPlus size={10} />}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={onAdd}
      title={t("y_next.rel_add_hint")}
      className={`flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-[11px] ${classes.button}`}
    >
      <UserPlus size={11} /> {label}
    </button>
  );
}

function RelationChip({ className, href, text, icon }: {
  className: string;
  href: string;
  text: string;
  icon: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={t("y_next.rel_known_hint")}
      className={`inline-flex max-w-[16rem] items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${className}`}
    >
      {icon}
      <span className="truncate">{text}</span>
      <ExternalLink size={9} className="flex-shrink-0" />
    </a>
  );
}
