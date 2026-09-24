/**
 * Notities bij een project.
 *
 * Links de lijst, rechts wat je aan het schrijven bent. Een notitie is vrije
 * tekst waar foto's en schermafdrukken in mogen (plakken werkt), hangt aan
 * één project, en heeft onderaan een actielijst. Zet je bij een actie een
 * naam, dan komt die actie als taak in ERPNext te staan — daar ziet de
 * betrokkene hem terug in zijn eigen takenlijst, ook als hij deze notitie
 * nooit opent.
 *
 * Bewaren gebeurt bewust met een knop en niet vanzelf: je typt in een
 * notitie vaak halve zinnen, en een tussenstand die zichzelf naar de server
 * schrijft levert alleen maar ruis op in de takenlijst van een ander. Wat je
 * wél zonder nadenken kunt doen is wisselen van notitie; wat openstaat gaat
 * dan eerst mee.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  NotebookPen, Plus, Search, Trash2, Save, X, CheckSquare, Square,
  FolderKanban, Calendar, AlertTriangle, RefreshCw, UserRound,
} from "lucide-react";
import RichTextEditor from "../components/mail/RichTextEditor";
import {
  createDocument, deleteDocument, fetchList, isDoctypeMissing, updateDocument, uploadFile,
} from "../lib/erpnext";
import { useEmployees, useProjects } from "../lib/DataContext";
import {
  NOTITIE_DOCTYPE, NOTITIE_MERK, actieOmschrijving, naarDoc, naarNotitie, nieuwId,
  openstaand, tekstUitHtml, todoPlan, vergelijkNotities, zoekNotities,
  type Actiepunt, type Notitie, type NotitieDoc,
} from "../lib/notities";

const VANDAAG = () => new Date().toISOString().slice(0, 10);

function legeNotitie(project: string): Notitie {
  return { naam: "", titel: "", datum: VANDAAG(), project, inhoud: "", acties: [], gewijzigd: "" };
}

export default function Notities() {
  const { t } = useTranslation();
  const projecten = useProjects();
  const medewerkers = useEmployees();
  const [params, setParams] = useSearchParams();

  const [notities, setNotities] = useState<Notitie[]>([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [ontbreekt, setOntbreekt] = useState(false);
  const [zoek, setZoek] = useState("");
  const [projectFilter, setProjectFilter] = useState(params.get("project") || "");
  const [gekozen, setGekozen] = useState<string>("");
  const [concept, setConcept] = useState<Notitie | null>(null);
  /** De laatst bewaarde versie; nodig om te zien welke taken weg mogen. */
  const bewaard = useRef<Notitie | null>(null);
  const [vuil, setVuil] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [wegVraag, setWegVraag] = useState(false);

  const actieveMedewerkers = useMemo(
    () => medewerkers
      .filter((m) => m.status === "Active" && (m.user_id || m.company_email))
      .sort((a, b) => a.employee_name.localeCompare(b.employee_name)),
    [medewerkers],
  );

  const projectLabel = useCallback((naam: string) => {
    if (!naam) return "";
    const p = projecten.find((x) => x.name === naam);
    return p ? `${p.name} · ${p.project_name}` : naam;
  }, [projecten]);

  const haalOp = useCallback(async (): Promise<Notitie[]> => {
    const rijen = await fetchList<NotitieDoc>(NOTITIE_DOCTYPE, {
      fields: ["name", "title", "meeting_date", "project", "notes", "action_points", "modified"],
      filters: [["linked_doctype", "=", NOTITIE_MERK]],
      order_by: "modified desc",
      limit_page_length: 0,
    });
    return rijen.map(naarNotitie).sort(vergelijkNotities);
  }, []);

  const laad = useCallback(async () => {
    setLaden(true);
    setFout(null);
    try {
      setNotities(await haalOp());
      setOntbreekt(isDoctypeMissing(NOTITIE_DOCTYPE));
    } catch (e) {
      if (isDoctypeMissing(NOTITIE_DOCTYPE)) setOntbreekt(true);
      else setFout(e instanceof Error ? e.message : String(e));
    } finally {
      setLaden(false);
    }
  }, [haalOp]);

  // De eerste ronde loopt buiten `laad` om: die zet meteen `laden` en dat mag
  // niet rechtstreeks in een effect. Het vlaggetje vangt het geval op dat het
  // scherm alweer weg is voordat de lijst binnen is.
  useEffect(() => {
    let levend = true;
    haalOp()
      .then((lijst) => {
        if (!levend) return;
        setNotities(lijst);
        setOntbreekt(isDoctypeMissing(NOTITIE_DOCTYPE));
      })
      .catch((e: unknown) => {
        if (!levend) return;
        if (isDoctypeMissing(NOTITIE_DOCTYPE)) setOntbreekt(true);
        else setFout(e instanceof Error ? e.message : String(e));
      })
      .finally(() => { if (levend) setLaden(false); });
    return () => { levend = false; };
  }, [haalOp]);

  /* ─── Bewaren ─── */

  /**
   * De taken bijtrekken bij wat er in de actielijst staat.
   *
   * Geeft de acties terug mét het taaknummer erbij, zodat de volgende keer
   * duidelijk is welke taak bij welke actie hoort. Loopt er één mis, dan
   * gaat de rest gewoon door: een notitie die niet te bewaren is omdat een
   * taak hapert, helpt niemand.
   */
  const stemTakenAf = useCallback(async (n: Notitie): Promise<{ acties: Actiepunt[]; mislukt: number }> => {
    const plan = todoPlan(n.acties, bewaard.current?.acties ?? []);
    const gekoppeld = new Map<string, string>();
    let mislukt = 0;

    for (const a of plan.maken) {
      try {
        const gemaakt = await createDocument<{ name: string }>("ToDo", {
          description: actieOmschrijving(a, n.titel),
          allocated_to: a.wie,
          date: a.datum || null,
          status: a.gedaan ? "Closed" : "Open",
          priority: "Medium",
          reference_type: n.project ? "Project" : null,
          reference_name: n.project || null,
        });
        if (gemaakt?.name) gekoppeld.set(a.id, gemaakt.name);
      } catch { mislukt += 1; }
    }
    for (const a of plan.bijwerken) {
      try {
        await updateDocument("ToDo", a.todo as string, {
          description: actieOmschrijving(a, n.titel),
          allocated_to: a.wie,
          date: a.datum || null,
          status: a.gedaan ? "Closed" : "Open",
        });
      } catch { mislukt += 1; }
    }
    for (const naam of plan.opruimen) {
      // Niet weggooien maar afmelden: wie de taak al in zijn lijst zag, ziet
      // zo wat ermee gebeurd is in plaats van een gat.
      try {
        await updateDocument("ToDo", naam, { status: "Cancelled" });
      } catch { mislukt += 1; }
    }

    return {
      acties: n.acties.map((a) => (gekoppeld.has(a.id) ? { ...a, todo: gekoppeld.get(a.id) } : a)),
      mislukt,
    };
  }, []);

  const bewaar = useCallback(async (n: Notitie): Promise<Notitie | null> => {
    setBezig(true);
    setFout(null);
    try {
      const { acties, mislukt } = await stemTakenAf(n);
      const volledig = { ...n, acties };
      const doc = n.naam
        ? await updateDocument<NotitieDoc>(NOTITIE_DOCTYPE, n.naam, naarDoc(volledig))
        : await createDocument<NotitieDoc>(NOTITIE_DOCTYPE, naarDoc(volledig));
      const opgeslagen = naarNotitie({ ...doc, action_points: naarDoc(volledig).action_points as string });
      bewaard.current = opgeslagen;
      setNotities((prev) => {
        const zonder = prev.filter((x) => x.naam !== opgeslagen.naam);
        return [...zonder, opgeslagen].sort(vergelijkNotities);
      });
      setGekozen(opgeslagen.naam);
      setConcept(opgeslagen);
      setVuil(false);
      if (mislukt > 0) setFout(t("notes.tasks_partly_failed", { count: mislukt }));
      return opgeslagen;
    } catch (e) {
      setFout(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setBezig(false);
    }
  }, [stemTakenAf, t]);

  /* ─── Kiezen en beginnen ─── */

  const kies = useCallback(async (n: Notitie) => {
    if (concept && vuil) await bewaar(concept);
    bewaard.current = n;
    setConcept(n);
    setGekozen(n.naam);
    setVuil(false);
    setWegVraag(false);
  }, [bewaar, concept, vuil]);

  const begin = useCallback(async () => {
    if (concept && vuil) await bewaar(concept);
    // De notitie wordt meteen aangemaakt: pas dan heeft een geplakte foto een
    // document om aan te hangen.
    const vers = legeNotitie(projectFilter);
    bewaard.current = null;
    const opgeslagen = await bewaar(vers);
    if (opgeslagen) setWegVraag(false);
  }, [bewaar, concept, projectFilter, vuil]);

  const gooiWeg = useCallback(async () => {
    if (!concept?.naam) { setConcept(null); setGekozen(""); return; }
    setBezig(true);
    try {
      // De taken die eraan hingen gaan mee: zonder notitie heeft de opdracht
      // geen aanleiding meer.
      for (const a of concept.acties) {
        if (a.todo) { try { await updateDocument("ToDo", a.todo, { status: "Cancelled" }); } catch { /* al weg */ } }
      }
      await deleteDocument(NOTITIE_DOCTYPE, concept.naam);
      setNotities((prev) => prev.filter((x) => x.naam !== concept.naam));
      setConcept(null);
      setGekozen("");
      bewaard.current = null;
      setVuil(false);
    } catch (e) {
      setFout(e instanceof Error ? e.message : String(e));
    } finally {
      setBezig(false);
      setWegVraag(false);
    }
  }, [concept]);

  /* ─── Bewerken ─── */

  function pas(velden: Partial<Notitie>) {
    setConcept((prev) => (prev ? { ...prev, ...velden } : prev));
    setVuil(true);
  }

  function pasActie(id: string, velden: Partial<Actiepunt>) {
    setConcept((prev) => prev
      ? { ...prev, acties: prev.acties.map((a) => (a.id === id ? { ...a, ...velden } : a)) }
      : prev);
    setVuil(true);
  }

  function nieuweActie() {
    setConcept((prev) => prev
      ? { ...prev, acties: [...prev.acties, { id: nieuwId(), tekst: "", wie: "", datum: "", gedaan: false }] }
      : prev);
    setVuil(true);
  }

  function wegActie(id: string) {
    setConcept((prev) => prev ? { ...prev, acties: prev.acties.filter((a) => a.id !== id) } : prev);
    setVuil(true);
  }

  const plakAfbeelding = useCallback(async (bestand: File): Promise<string> => {
    const doel = concept?.naam || "";
    const info = await uploadFile(bestand, NOTITIE_DOCTYPE, doel, false);
    return info.file_url;
  }, [concept?.naam]);

  /* ─── Lijst ─── */

  const zichtbaar = useMemo(() => {
    const opProject = projectFilter
      ? notities.filter((n) => n.project === projectFilter)
      : notities;
    return zoekNotities(opProject, zoek);
  }, [notities, projectFilter, zoek]);

  function zetProjectFilter(waarde: string) {
    setProjectFilter(waarde);
    const volgende = new URLSearchParams(params);
    if (waarde) volgende.set("project", waarde); else volgende.delete("project");
    setParams(volgende, { replace: true });
  }

  if (ontbreekt) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <AlertTriangle size={32} className="mx-auto text-amber-500 mb-3" />
          <h1 className="text-lg font-bold text-slate-800 mb-1">{t("notes.title")}</h1>
          <p className="text-sm text-slate-500">{t("notes.module_missing")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* ─── Links: de lijst ─── */}
      <div className="w-80 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <NotebookPen size={20} className="text-y-teal" />
              {t("notes.title")}
            </h1>
            <div className="flex items-center gap-1">
              <button
                onClick={() => void laad()}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                title={t("notes.refresh")}
              >
                <RefreshCw size={16} className={laden ? "animate-spin" : ""} />
              </button>
              <button
                onClick={() => void begin()}
                disabled={bezig}
                className="p-2 rounded-lg bg-y-teal text-white hover:bg-y-teal-dark transition-colors cursor-pointer disabled:opacity-40"
                title={t("notes.new")}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className="relative mb-2">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              placeholder={t("notes.search")}
              aria-label={t("notes.search")}
              className="w-full pl-8 pr-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-y-teal/30"
            />
          </div>

          <select
            value={projectFilter}
            onChange={(e) => zetProjectFilter(e.target.value)}
            aria-label={t("notes.filter_project")}
            className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-y-teal/30"
          >
            <option value="">{t("notes.all_projects")}</option>
            {projecten.map((p) => (
              <option key={p.name} value={p.name}>{p.name} · {p.project_name}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {zichtbaar.length === 0 && !laden && (
            <p className="p-4 text-sm text-slate-400">{t("notes.empty_list")}</p>
          )}
          {zichtbaar.map((n) => {
            const open = openstaand(n.acties);
            return (
              <button
                key={n.naam}
                onClick={() => void kies(n)}
                className={`w-full text-left px-4 py-3 border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${
                  n.naam === gekozen ? "bg-y-teal/5 border-l-2 border-l-y-teal" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800 truncate">
                    {n.titel || t("notes.untitled")}
                  </span>
                  {open > 0 && (
                    <span className="flex-shrink-0 text-[11px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      {t("notes.open_actions", { count: open })}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                  {n.project && <span className="truncate">{projectLabel(n.project)}</span>}
                  {n.datum && <span className="flex-shrink-0">{n.datum}</span>}
                </div>
                {tekstUitHtml(n.inhoud, 70) && (
                  <p className="mt-1 text-xs text-slate-400 line-clamp-2">{tekstUitHtml(n.inhoud, 70)}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Rechts: de notitie ─── */}
      <div className="flex-1 min-w-0 flex flex-col bg-slate-50">
        {!concept ? (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <NotebookPen size={32} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">{t("notes.pick_or_new")}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="px-5 py-3 bg-white border-b border-slate-200">
              <div className="flex items-center gap-2">
                <input
                  value={concept.titel}
                  onChange={(e) => pas({ titel: e.target.value })}
                  placeholder={t("notes.title_placeholder")}
                  aria-label={t("notes.title_placeholder")}
                  className="flex-1 min-w-0 text-base font-semibold text-slate-800 px-2 py-1 border border-transparent hover:border-slate-200 focus:border-slate-300 rounded focus:outline-none"
                />
                <button
                  onClick={() => void bewaar(concept)}
                  disabled={bezig || !vuil}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-y-teal text-white hover:bg-y-teal-dark cursor-pointer disabled:opacity-40 disabled:cursor-default"
                >
                  <Save size={14} />
                  {vuil ? t("notes.save") : t("notes.saved")}
                </button>
                {wegVraag ? (
                  <span className="flex items-center gap-1">
                    <button
                      onClick={() => void gooiWeg()}
                      className="px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 cursor-pointer"
                    >
                      {t("notes.delete_confirm")}
                    </button>
                    <button
                      onClick={() => setWegVraag(false)}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                      title={t("notes.cancel")}
                    >
                      <X size={16} />
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setWegVraag(true)}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                    title={t("notes.delete")}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                  <FolderKanban size={13} />
                  <select
                    value={concept.project}
                    onChange={(e) => pas({ project: e.target.value })}
                    aria-label={t("notes.project")}
                    className="px-2 py-1 text-xs border border-slate-200 rounded bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-y-teal/30"
                  >
                    <option value="">{t("notes.no_project")}</option>
                    {projecten.map((p) => (
                      <option key={p.name} value={p.name}>{p.name} · {p.project_name}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Calendar size={13} />
                  <input
                    type="date"
                    value={concept.datum}
                    onChange={(e) => pas({ datum: e.target.value })}
                    aria-label={t("notes.date")}
                    className="px-2 py-1 text-xs border border-slate-200 rounded bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-y-teal/30"
                  />
                </label>
              </div>

              {fout && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
                  <AlertTriangle size={13} /> {fout}
                </p>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
              <div className="bg-white border border-slate-200 rounded-lg p-3 min-h-[280px] flex flex-col">
                <RichTextEditor
                  value={concept.inhoud}
                  onChange={(html) => pas({ inhoud: html })}
                  onAfbeelding={plakAfbeelding}
                  placeholder={t("notes.content_placeholder")}
                  ariaLabel={t("notes.content_placeholder")}
                  className="flex-1"
                />
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <CheckSquare size={15} className="text-slate-400" />
                    {t("notes.actions")}
                  </h2>
                  <button
                    onClick={nieuweActie}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    <Plus size={12} /> {t("notes.add_action")}
                  </button>
                </div>

                {concept.acties.length === 0 && (
                  <p className="text-xs text-slate-400">{t("notes.no_actions")}</p>
                )}

                <ul className="space-y-1.5">
                  {concept.acties.map((a) => (
                    <li key={a.id} className="flex items-center gap-2">
                      <button
                        onClick={() => pasActie(a.id, { gedaan: !a.gedaan })}
                        className="p-1 text-slate-400 hover:text-y-teal cursor-pointer flex-shrink-0"
                        title={a.gedaan ? t("notes.mark_open") : t("notes.mark_done")}
                      >
                        {a.gedaan ? <CheckSquare size={15} className="text-y-teal" /> : <Square size={15} />}
                      </button>
                      <input
                        value={a.tekst}
                        onChange={(e) => pasActie(a.id, { tekst: e.target.value })}
                        placeholder={t("notes.action_placeholder")}
                        aria-label={t("notes.action_placeholder")}
                        className={`flex-1 min-w-0 px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-y-teal/30 ${
                          a.gedaan ? "line-through text-slate-400" : "text-slate-700"
                        }`}
                      />
                      <label className="flex items-center gap-1 flex-shrink-0" title={t("notes.assigned_to")}>
                        <UserRound size={13} className="text-slate-400" />
                        <select
                          value={a.wie}
                          onChange={(e) => pasActie(a.id, { wie: e.target.value })}
                          aria-label={t("notes.assigned_to")}
                          className="px-1.5 py-1 text-xs border border-slate-200 rounded bg-white cursor-pointer max-w-[150px] focus:outline-none focus:ring-2 focus:ring-y-teal/30"
                        >
                          <option value="">{t("notes.nobody")}</option>
                          {actieveMedewerkers.map((m) => {
                            const adres = m.user_id || m.company_email;
                            return <option key={m.name} value={adres}>{m.employee_name}</option>;
                          })}
                          {a.wie && !actieveMedewerkers.some((m) => (m.user_id || m.company_email) === a.wie) && (
                            <option value={a.wie}>{a.wie}</option>
                          )}
                        </select>
                      </label>
                      <input
                        type="date"
                        value={a.datum}
                        onChange={(e) => pasActie(a.id, { datum: e.target.value })}
                        aria-label={t("notes.action_date")}
                        className="px-1.5 py-1 text-xs border border-slate-200 rounded bg-white cursor-pointer flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-y-teal/30"
                      />
                      <button
                        onClick={() => wegActie(a.id)}
                        className="p-1 text-slate-300 hover:text-red-600 cursor-pointer flex-shrink-0"
                        title={t("notes.remove_action")}
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>

                <p className="mt-2 text-[11px] text-slate-400">{t("notes.actions_hint")}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
