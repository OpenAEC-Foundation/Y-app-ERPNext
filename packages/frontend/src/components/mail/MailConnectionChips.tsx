/**
 * Alle connecties van één mail als chips.
 *
 * Eerder toonde het leespaneel alleen `Communication.reference_*` — de
 * **laatst gemaakte** koppeling, want dat veld is enkelvoudig. Een mail die
 * eerst aan een project en daarna aan een inkoopfactuur werd gehangen, liet
 * het project dus stilletjes vallen. De `Communication Link`-child-tabel
 * (`timeline_links`) is wél meervoudig; `mail-connections.ts` voegt beide
 * bronnen samen en dít is de weergave daarvan.
 *
 * De chips zijn dezelfde bron als de connectiekolom, dus wat je hier ziet, is
 * ook waar je de mail onder terugvindt.
 */

import { ExternalLink } from "lucide-react";
import { CONNECTION_TONE, connectionIcon, erpDocPath } from "../../lib/connection-visuals";
import type { MailConnection } from "../../lib/mail-connections";

export default function MailConnectionChips({ connections, onOpen }: {
  connections: MailConnection[];
  /** Klik op een chip: filter de lijst op dit object (optioneel). */
  onOpen?: (conn: MailConnection) => void;
}) {
  if (connections.length === 0) return null;
  return (
    <>
      {connections.map((conn) => {
        const Icon = connectionIcon(conn.category);
        const tone = CONNECTION_TONE[conn.category] ?? CONNECTION_TONE.unlinked;
        const title = `${conn.doctype}: ${conn.name}`;
        // De chip doet twee dingen die niet in één control passen: filteren op
        // de connectie (in Y-next) en het document in ERPNext openen. De tekst
        // filtert, het pijltje opent — zo blijft de primaire klik binnen de app.
        return (
          <span key={`${conn.doctype}::${conn.name}`}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>
            <Icon size={11} className="flex-shrink-0" />
            {onOpen ? (
              <button type="button" onClick={() => onOpen(conn)} title={title}
                className="cursor-pointer max-w-[14rem] truncate">
                {conn.label}
              </button>
            ) : (
              <span title={title} className="max-w-[14rem] truncate">{conn.label}</span>
            )}
            <a href={erpDocPath(conn.doctype, conn.name)} target="_blank" rel="noopener noreferrer"
              title={title} className="opacity-60 hover:opacity-100">
              <ExternalLink size={9} />
            </a>
          </span>
        );
      })}
    </>
  );
}
