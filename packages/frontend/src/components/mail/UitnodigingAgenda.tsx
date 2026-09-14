import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CalendarCheck2, Loader2 } from "lucide-react";
import {
  zoekConflicten, naarMinuten, type Bezetting,
} from "../../lib/agenda-conflicten";
import { eindTijd, haalAgendas } from "../../lib/agenda-mailserver";
import type { Uitnodiging } from "../../lib/useUitnodiging";
import { fetchList } from "../../lib/erpnext";
import { resolveSessionUser } from "../../lib/session";

/**
 * Je eigen agenda naast een uitnodiging in de mail.
 *
 * De vraag bij een uitnodiging is bijna altijd dezelfde: kán ik dan? Die
 * beantwoord je nu zonder de mail te verlaten — de voorgestelde tijd staat als
 * gestreept blok in je dag, en wat ermee botst springt eruit.
 *
 * Bewust alleen de dag van de uitnodiging: een hele week erbij maakt de kolom
 * onleesbaar, en de vraag gaat over dat ene moment.
 */

/** Uit hoeveel dagen terug meerdaagse afspraken nog kunnen doorlopen. */
const DAGEN_TERUG = 7;

export default function UitnodigingAgenda({ uitnodiging, className = "" }: {
  uitnodiging: Uitnodiging;
  className?: string;
}) {
  const { t } = useTranslation();
  const { afspraak, fout } = uitnodiging;
  const [agenda, setAgenda] = useState<Bezetting[] | null>(null);

  const dag = afspraak?.start?.slice(0, 10) || "";

  // De eigen dag ophalen: de agenda van de mailserver plus de afspraken die in
  // ERPNext staan. Samen is dat wat de agendapagina ook als "van jou" toont.
  useEffect(() => {
    let afgebroken = false;
    if (!dag) { setAgenda(null); return; }
    (async () => {
      const bezet: Bezetting[] = [];
      const ik = (await resolveSessionUser()) || "";
      if (ik.includes("@")) {
        const { afspraken } = await haalAgendas(dag, dag, [ik]);
        for (const a of afspraken) {
          if (!a.start) continue;
          bezet.push({
            id: `mb-${a.id}`,
            titel: a.titel || t("agenda.no_title"),
            start: a.start,
            eind: eindTijd(a.start, a.duur),
            heleDag: !!a.hele_dag,
            // "free" betekent op de mailserver: deze afspraak houdt me niet
            // bezig. Als conflict tonen zou de melding ongeloofwaardig maken.
            vrij: String(a.status || "").toLowerCase() === "free",
          });
        }
      }
      try {
        const vanaf = nieuweDag(dag, -DAGEN_TERUG);
        const rijen = await fetchList<{
          name: string; subject?: string; starts_on?: string; ends_on?: string; all_day?: number;
        }>("Event", {
          fields: ["name", "subject", "starts_on", "ends_on", "all_day"],
          filters: [
            ["starts_on", ">=", `${vanaf} 00:00:00`],
            ["starts_on", "<=", `${dag} 23:59:59`],
            ["status", "=", "Open"],
          ],
          limit_page_length: 200,
        });
        for (const r of rijen) {
          if (!r.starts_on) continue;
          bezet.push({
            id: `ev-${r.name}`,
            titel: r.subject || t("agenda.no_title"),
            start: r.starts_on,
            eind: r.ends_on,
            heleDag: !!r.all_day,
          });
        }
      } catch {
        // Geen leesrecht op Event of ERPNext even niet bereikbaar: dan toont
        // het paneel wat het wél weet. Een half gevulde agenda is beter dan
        // een lege kolom met een foutmelding.
      }
      if (!afgebroken) setAgenda(bezet);
    })();
    return () => { afgebroken = true; };
  }, [dag, t]);

  const voorstel = useMemo(() => afspraak && afspraak.start
    ? { start: afspraak.start, eind: afspraak.eind, heleDag: afspraak.heleDag }
    : null, [afspraak]);

  const conflicten = useMemo(
    () => (voorstel && agenda ? zoekConflicten(voorstel, agenda) : []),
    [voorstel, agenda],
  );

  // Geen uitnodiging: geen kolom.
  if (!afspraak?.start) return null;

  return (
    <aside className={`w-72 flex-shrink-0 border-l border-slate-200 bg-slate-50 overflow-y-auto ${className}`}>
      <div className="px-3 py-2 border-b border-slate-200 bg-white">
        <p className="text-[10px] uppercase tracking-wide text-slate-400">
          {t("agenda.invite_panel_title")}
        </p>
        {afspraak?.start ? (
          <p className="text-xs font-medium text-slate-700 mt-0.5">
            {langeDatum(dag)}
            {!afspraak.heleDag && afspraak.eind
              ? ` · ${klok(afspraak.start)} – ${klok(afspraak.eind)}`
              : ` · ${t("agenda.all_day")}`}
          </p>
        ) : (
          <p className="text-xs text-slate-500 mt-0.5">
            {fout || t("agenda.invite_panel_unreadable")}
          </p>
        )}
      </div>

      {afspraak?.start && (agenda === null ? (
        <p className="flex items-center gap-2 px-3 py-4 text-xs text-slate-400">
          <Loader2 size={13} className="animate-spin" /> {t("agenda.invite_panel_loading")}
        </p>
      ) : (
        <>
          {conflicten.length === 0 ? (
            <p className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 border-b border-emerald-100">
              <CalendarCheck2 size={13} /> {t("agenda.invite_panel_free")}
            </p>
          ) : (
            <div className="px-3 py-2 bg-amber-50 border-b border-amber-100">
              <p className="flex items-center gap-2 text-xs font-medium text-amber-800">
                <AlertTriangle size={13} />
                {t("agenda.invite_panel_conflict", { count: conflicten.length })}
              </p>
              <ul className="mt-1 space-y-0.5">
                {conflicten.map((c) => (
                  <li key={c.id} className="text-[11px] text-amber-900/80 truncate">
                    {c.heleDag ? t("agenda.all_day") : klok(c.start)} · {c.titel}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Dagstrook dag={dag} voorstel={voorstel!} bezet={agenda} conflicten={conflicten} />
        </>
      ))}
    </aside>
  );
}

/**
 * De dag als smalle strook met uren.
 *
 * De hoogte per uur is klein maar vast: dan blijft de verhouding tussen een
 * half uur en een hele middag zichtbaar, wat juist het punt is van naast
 * elkaar zetten.
 */
function Dagstrook({ dag, voorstel, bezet, conflicten }: {
  dag: string;
  voorstel: { start: string; eind?: string; heleDag?: boolean };
  bezet: Bezetting[];
  conflicten: Bezetting[];
}) {
  const { t } = useTranslation();
  const PER_UUR = 22;
  const dagBegin = naarMinuten(`${dag}T00:00:00`);

  const opDeDag = bezet.filter((b) => !b.heleDag && binnenDag(b.start, dag));
  const heleDagen = bezet.filter((b) => b.heleDag);

  const minuten = (waarde?: string) => (waarde ? naarMinuten(waarde) - dagBegin : 0);

  // Het venster loopt van 7 tot 20 uur, en rekt op zodra er buiten die uren
  // iets staat — anders valt een vroege afspraak stilzwijgend van de strook.
  let vanUur = 7;
  let totUur = 20;
  const randen = [...opDeDag.map((b) => b.start), ...opDeDag.map((b) => b.eind || b.start)];
  if (!voorstel.heleDag) randen.push(voorstel.start, voorstel.eind || voorstel.start);
  for (const r of randen) {
    const m = minuten(r);
    if (m < 0 || m > 24 * 60) continue;
    vanUur = Math.min(vanUur, Math.floor(m / 60));
    totUur = Math.max(totUur, Math.ceil(m / 60));
  }
  const hoogte = (totUur - vanUur) * PER_UUR;
  const top = (waarde?: string) => ((minuten(waarde) - vanUur * 60) / 60) * PER_UUR;
  const blokHoogte = (b: { start: string; eind?: string }) =>
    Math.max(((minuten(b.eind || b.start) - minuten(b.start)) / 60) * PER_UUR, 11);

  const botst = new Set(conflicten.map((c) => c.id));

  return (
    <div className="p-3">
      {heleDagen.length > 0 && (
        <div className="mb-2 space-y-1">
          {heleDagen.map((b) => (
            <p key={b.id}
              className={`rounded px-1.5 py-0.5 text-[10px] truncate ${
                botst.has(b.id) ? "bg-amber-200 text-amber-900" : "bg-slate-200 text-slate-600"
              }`}>
              {b.titel}
            </p>
          ))}
        </div>
      )}
      <div className="relative" style={{ height: hoogte }}>
        {Array.from({ length: totUur - vanUur }, (_, i) => (
          <div key={i} className="absolute left-0 right-0 border-t border-slate-200"
            style={{ top: i * PER_UUR }}>
            <span className="absolute -top-1.5 left-0 bg-slate-50 pr-1 text-[9px] text-slate-400">
              {String(vanUur + i).padStart(2, "0")}
            </span>
          </div>
        ))}
        {opDeDag.map((b) => (
          <div key={b.id}
            title={b.titel}
            className={`absolute left-6 right-0 overflow-hidden rounded px-1 text-[10px] leading-[11px] ${
              botst.has(b.id)
                ? "bg-amber-200/90 text-amber-900 border border-amber-400"
                : "bg-slate-200/80 text-slate-600 border border-slate-300"
            }`}
            style={{ top: top(b.start), height: blokHoogte(b) }}>
            {b.titel}
          </div>
        ))}
        {!voorstel.heleDag && (
          <div
            className="absolute left-6 right-0 overflow-hidden rounded border-2 border-dashed border-violet-500 bg-violet-100/70 px-1 text-[10px] font-medium leading-[11px] text-violet-800"
            style={{ top: top(voorstel.start), height: blokHoogte(voorstel) }}>
            {t("agenda.invite_panel_proposal")}
          </div>
        )}
      </div>
    </div>
  );
}

function binnenDag(waarde: string, dag: string): boolean {
  return String(waarde).slice(0, 10) === dag;
}

function klok(waarde?: string): string {
  const m = /[T ](\d{2}:\d{2})/.exec(String(waarde || ""));
  return m ? m[1] : "";
}

function langeDatum(dag: string): string {
  const [j, m, d] = dag.split("-").map(Number);
  if (!j || !m || !d) return dag;
  return new Date(j, m - 1, d).toLocaleDateString("nl-NL", {
    weekday: "long", day: "numeric", month: "long",
  });
}

function nieuweDag(dag: string, dagen: number): string {
  const [j, m, d] = dag.split("-").map(Number);
  const dt = new Date(j, m - 1, d, 12, 0, 0);
  dt.setDate(dt.getDate() + dagen);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}
