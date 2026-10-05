import { useEffect, useState, useMemo, useCallback } from "react";
import type { MouseEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { fetchList, createDocument, updateDocument, isDoctypeMissing, uploadFile, getErpNextAppUrl } from "../lib/erpnext";
import { sanitizeEditorHtml } from "../lib/mail-html";
import { isDesktopApp } from "../lib/desktop";
import RichTextEditor from "../components/mail/RichTextEditor";
import {
  BookOpen, Plus, Search, Edit3, Save, X, ChevronRight, ChevronLeft,
  Eye, RefreshCw,
  FileText, Clock, Check, AlertTriangle, Link2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import KennisbankHome from "../components/wiki/KennisbankHome";
import { leesTellingen, telGeopend, type Tellingen } from "../lib/wiki-overzicht";
import { markdownToHtml } from "../lib/wiki-markdown";
import {
  deelbareLink, herschrijfWikiLinks, interneWikiLink, urlVoorArtikel, urlVoorPad, zoekArtikelOpPad,
} from "../lib/wiki-link";

/* ─── Types ─── */

interface WikiPage {
  name: string;
  title: string;
  route: string;
  published: number;
  content: string;
  modified?: string;
}

type Mode = "view" | "edit";

type SaveStatus = "idle" | "saving" | "saved" | "error";

/* ─── Helpers ─── */

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ─── Toolbar Config ─── */


/* ─── Component ─── */

export default function Wiki() {
  const { t } = useTranslation();
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [loading, setLoading] = useState(true);
  // fetchList degradeert een 404 op de doctype zelf (geen "Wiki Page" op deze
  // instance) stilzwijgend naar [] — zonder deze check zag de gebruiker
  // gewoon "Geen wiki pagina's gevonden", niet te onderscheiden van een
  // instance die de module wél heeft maar simpelweg nog geen pagina's.
  const [moduleUnavailable, setModuleUnavailable] = useState(false);
  /** Hoe vaak jij elk artikel opende; staat in deze browser. */
  const [tellingen, setTellingen] = useState<Tellingen>(() => leesTellingen());

  // Elk artikel heeft een eigen adres: #/wiki/<route zonder "wiki/">. Het
  // adres bepaalt welk artikel open staat; zo werkt een doorgestuurde link,
  // terugbladeren en een verwijzing van het ene artikel naar het andere.
  const navigate = useNavigate();
  const location = useLocation();
  const padUitAdres = useParams()["*"] ?? "";
  const selectedPage: WikiPage | null = useMemo(
    () => (padUitAdres ? zoekArtikelOpPad(pages, padUitAdres) ?? null : null),
    [pages, padUitAdres],
  );
  /** Het pad uit een link waarbij geen artikel hoort (verplaatst of hernoemd). */
  /** Het laden van de artikelen mislukte (geen verbinding, geen leesrecht). */
  const [laadFout, setLaadFout] = useState(false);
  const nietGevonden = padUitAdres && !loading && !laadFout && !selectedPage ? padUitAdres : "";

  // Het adres van de Y-app, voor een link die je doorstuurt. In de browser is
  // dat de huidige pagina; in de desktop-app de site zelf, want het eigen
  // adres daar (tauri.localhost) opent bij een collega niets.
  const appAdres = useMemo(() => {
    if (!isDesktopApp()) return window.location.origin + window.location.pathname;
    try {
      return new URL(getErpNextAppUrl()).origin + "/y-next";
    } catch {
      return "";
    }
  }, []);
  const eigenOrigin = useMemo(() => {
    try {
      return new URL(appAdres).origin;
    } catch {
      return window.location.origin;
    }
  }, [appAdres]);
  const [linkGekopieerd, setLinkGekopieerd] = useState(false);

  // Bewerken hoort bij één artikel: open je een ander, dan lees je dat.
  const [bewerkt, setBewerkt] = useState<string | null>(null);
  const mode: Mode = selectedPage && bewerkt === selectedPage.name ? "edit" : "view";

  /** Een artikel tonen: het adres gaat erheen, zodat de link in de adresbalk altijd klopt. */
  const toonArtikel = useCallback((page: WikiPage) => {
    setBewerkt(null);
    const doel = urlVoorArtikel(page);
    if (location.pathname !== doel) navigate(doel);
  }, [location.pathname, navigate]);

  /** Terug naar de hoofdpagina van de kennisbank. */
  const toonOverzicht = useCallback(() => {
    setBewerkt(null);
    if (location.pathname !== "/wiki") navigate("/wiki");
  }, [location.pathname, navigate]);

  /** Een artikel openen vanaf de hoofdpagina, en meteen meetellen. */
  const openArtikel = useCallback((artikelNaam: string) => {
    const gevonden = pages.find((x) => x.name === artikelNaam);
    if (!gevonden) return;
    setTellingen((vorige) => telGeopend(artikelNaam, vorige));
    toonArtikel(gevonden);
  }, [pages, toonArtikel]);
  const [searchQuery, setSearchQuery] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Edit state
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  // New page modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  /* ─── Fetch pages ─── */
  const loadPages = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchList<WikiPage>("Wiki Page", {
        fields: ["name", "title", "route", "published", "content", "modified"],
        limit_page_length: 0,
        order_by: "modified desc",
      });
      setPages(data);
      setModuleUnavailable(isDoctypeMissing("Wiki Page"));
      setLaadFout(false);
    } catch (err) {
      console.error("Failed to load wiki pages:", err);
      setLaadFout(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  /** Een verwijzing naar een ander artikel opent in de kennisbank zelf. */
  function volgArtikelLink(e: MouseEvent<HTMLDivElement>) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const href = (e.target as HTMLElement).closest("a")?.getAttribute("href");
    if (!href) return;
    const pad = interneWikiLink(href, eigenOrigin);
    if (pad === null) return;
    e.preventDefault();
    navigate(urlVoorPad(pad));
  }

  /** De link naar dit artikel kopiëren, om door te sturen. */
  async function kopieerLink() {
    if (!selectedPage || !appAdres) return;
    const link = deelbareLink(selectedPage, appAdres);
    try {
      await navigator.clipboard.writeText(link);
      setLinkGekopieerd(true);
      window.setTimeout(() => setLinkGekopieerd(false), 2000);
    } catch {
      // Geen toegang tot het klembord: laat de link zien om zelf te kopiëren.
      prompt(t("wiki.copy_link_prompt"), link);
    }
  }

  /* ─── Filtered list ─── */
  /* ─── Het artikel zoals het getoond wordt ─── */
  // Eerst door hetzelfde filter als de editor (geen script, geen
  // event-attributen, ook niet in artikelen die buiten de Y-app om zijn
  // opgeslagen), daarna de verwijzingen naar andere artikelen naar de Y-app.
  const artikelHtml = useMemo(
    () => (selectedPage?.content
      ? herschrijfWikiLinks(sanitizeEditorHtml(markdownToHtml(selectedPage.content)), eigenOrigin)
      : ""),
    [selectedPage, eigenOrigin],
  );

  const filteredPages = useMemo(() => {
    if (!searchQuery.trim()) return pages;
    const q = searchQuery.toLowerCase();
    return pages.filter(
      (p) =>
        p.title?.toLowerCase().includes(q) ||
        p.route?.toLowerCase().includes(q)
    );
  }, [pages, searchQuery]);

  /* ─── Select page ─── */
  function handleSelectPage(page: WikiPage) {
    toonArtikel(page);
  }

  /* ─── Edit mode ─── */
  function startEditing() {
    if (!selectedPage) return;
    setEditTitle(selectedPage.title || "");
    // Oudere artikelen staan als markdown in ERPNext. Ze gaan hier één keer
    // door dezelfde omzetting als de weergave, zodat je in het bewerkvak de
    // opgemaakte tekst ziet en niet de tekens eromheen. Opslaan gebeurt
    // daarna als HTML.
    setEditContent(markdownToHtml(selectedPage.content || ""));
    setBewerkt(selectedPage.name);
    setSaveStatus("idle");
  }

  /* ─── Save ─── */
  /**
   * Een geplakte of gesleepte afbeelding wegzetten in ERPNext en het adres
   * teruggeven. Publiek, want een artikel in de kennisbank wordt door het hele
   * bureau gelezen; een privébestand zou bij iedereen als kapot plaatje staan.
   */
  async function plakAfbeelding(bestand: File): Promise<string> {
    const info = await uploadFile(bestand, "Wiki Page", selectedPage?.name ?? "", false);
    if (!info?.file_url) throw new Error("geen bestandsadres teruggekregen");
    return info.file_url;
  }

  async function handleSave() {
    if (!selectedPage) return;
    setSaveStatus("saving");
    try {
      const updated = await updateDocument<WikiPage>("Wiki Page", selectedPage.name, {
        title: editTitle,
        content: editContent,
      });
      setSaveStatus("saved");
      // De lijst bijwerken; het open artikel komt daaruit.
      setPages((prev) =>
        prev.map((p) =>
          p.name === selectedPage.name
            ? { ...p, ...updated, title: editTitle, content: editContent, modified: updated?.modified ?? new Date().toISOString() }
            : p
        )
      );
      setTimeout(() => {
        setBewerkt(null);
        setSaveStatus("idle");
      }, 800);
    } catch (err) {
      console.error("Failed to save wiki page:", err);
      setSaveStatus("error");
    }
  }

  /* ─── Create new page ─── */
  async function handleCreatePage() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const route = `wiki/${slugify(newTitle)}`;
      const created = await createDocument<WikiPage>("Wiki Page", {
        title: newTitle,
        route,
        published: 1,
        content: "",
      });
      setShowNewModal(false);
      setNewTitle("");
      await loadPages();
      // Ook als het herladen mislukte: het nieuwe artikel staat in de lijst.
      setPages((prev) => (prev.some((p) => p.name === created.name) ? prev : [created, ...prev]));
      navigate(urlVoorArtikel(created));
      // Go straight to edit mode for the new page
      setEditTitle(created.title || newTitle);
      setEditContent(created.content || "");
      setBewerkt(created.name);
    } catch (err) {
      console.error("Failed to create wiki page:", err);
    } finally {
      setCreating(false);
    }
  }

  /* ─── Render ─── */
  return (
    <div className="flex h-full">
      {/* ─── Left Sidebar — on mobile, hide when a page is open so the content
           gets full width; on md+ always visible side-by-side ─── */}
      <div className={`${selectedPage ? "hidden md:flex" : "flex"} w-full md:w-72 md:flex-shrink-0 bg-white border-r border-slate-200 flex-col h-full`}>
        {/* Header */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BookOpen size={20} className="text-blue-600" />
              <h2 className="text-lg font-bold text-slate-800">{t("wiki.title")}</h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={loadPages}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title={t("common.refresh")}
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              </button>
              <button
                onClick={() => setShowNewModal(true)}
                disabled={moduleUnavailable}
                className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title={t("wiki.new_page_title")}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          {moduleUnavailable && (
            <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex items-start gap-2">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{t("y_next.module_unavailable")}</span>
            </div>
          )}
          {laadFout && (
            <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs flex items-start gap-2">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <span className="flex-1">{t("wiki.load_error")}</span>
              <button onClick={loadPages} className="shrink-0 font-medium underline cursor-pointer">{t("extensions.retry")}</button>
            </div>
          )}
          {/* Op een telefoon staat hier de lijst, niet het overzicht: de
              melding over een onbekende link moet dan hier. */}
          {nietGevonden && (
            <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex items-start gap-2 md:hidden">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{t("wiki.link_not_found", { pad: nietGevonden })}</span>
            </div>
          )}
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={t("sidebar.global_search") + "..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Page list */}
        <div className="flex-1 overflow-y-auto">
          {loading && pages.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <RefreshCw size={20} className="animate-spin" />
            </div>
          ) : filteredPages.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm px-4">
              {searchQuery ? t("wiki.no_results") : moduleUnavailable ? t("y_next.module_unavailable") : t("wiki.no_pages")}
            </div>
          ) : (
            <div className="py-1">
              {filteredPages.map((page) => {
                const isActive = selectedPage?.name === page.name;
                return (
                  <button
                    key={page.name}
                    onClick={() => handleSelectPage(page)}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer border-l-2 ${
                      isActive
                        ? "bg-blue-50 border-blue-600 text-blue-700"
                        : "border-transparent hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <FileText size={16} className={isActive ? "text-blue-600" : "text-slate-400"} />
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-medium truncate ${isActive ? "text-blue-700" : "text-slate-700"}`}>
                        {page.title || page.name}
                      </div>
                      {page.modified && (
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {formatDate(page.modified)}
                        </div>
                      )}
                    </div>
                    {!page.published && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                        {t("wiki.draft")}
                      </span>
                    )}
                    <ChevronRight size={14} className={isActive ? "text-blue-400" : "text-slate-300"} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Page count */}
        <div className="px-4 py-2 border-t border-slate-200 text-[11px] text-slate-400">
          {t("wiki.page_count", { count: pages.length })}
        </div>
      </div>

      {/* ─── Main Content — hidden on mobile when no page selected (sidebar
           takes the full screen); always visible on md+ ─── */}
      <div className={`${!selectedPage ? "hidden md:flex" : "flex"} flex-1 flex-col min-w-0 bg-slate-50`}>
        {!selectedPage ? (
          /* De hoofdpagina van de kennisbank: wat staat er allemaal? */
          <>
            {nietGevonden && (
              <div className="mx-4 mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 sm:mx-8">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{t("wiki.link_not_found", { pad: nietGevonden })}</span>
              </div>
            )}
            <KennisbankHome
              artikelen={pages.map((p) => ({ name: p.name, title: p.title, route: p.route, modified: p.modified }))}
              tellingen={tellingen}
              onOpen={openArtikel}
              onNieuw={() => setShowNewModal(true)}
            />
          </>
        ) : mode === "view" ? (
          /* ─── VIEW MODE ─── */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top bar */}
            <div className="flex items-center justify-between gap-2 px-3 sm:px-8 py-3 sm:py-4 border-b border-slate-200 bg-white">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {/* Mobile-only back-to-list button */}
                {/* Terug naar de hoofdpagina van de kennisbank. Ook op een
                    groot scherm: daar staat links wel de lijst, maar niet het
                    overzicht met onderwerpen waar je vandaan kwam. */}
                <button
                  onClick={toonOverzicht}
                  className="flex shrink-0 cursor-pointer items-center gap-1 -ml-2 rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                  title={t("wiki.back_to_overview")}
                >
                  <ChevronLeft size={20} />
                  <span className="hidden text-sm md:inline">{t("wiki.back_to_overview")}</span>
                </button>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-2xl font-bold text-slate-900 truncate">
                    {selectedPage.title || selectedPage.name}
                  </h1>
                  {selectedPage.modified && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                      <Clock size={12} />
                      <span className="truncate">{t("wiki.last_modified", { date: formatDate(selectedPage.modified) })}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {appAdres && (
                  <button
                    onClick={kopieerLink}
                    className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors text-sm font-medium cursor-pointer"
                    title={t("wiki.copy_link_title")}
                  >
                    {linkGekopieerd ? <Check size={16} className="text-green-600" /> : <Link2 size={16} />}
                    <span className="hidden sm:inline">{linkGekopieerd ? t("wiki.link_copied") : t("wiki.copy_link")}</span>
                  </button>
                )}
                <button
                  onClick={startEditing}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-medium cursor-pointer"
                >
                  <Edit3 size={16} />
                  <span className="hidden sm:inline">{t("wiki.edit")}</span>
                </button>
              </div>
            </div>

            {/* Content — per artikel een eigen scrollvak, zodat een ander
                artikel bovenaan opent en niet op de plek van het vorige. */}
            <div key={selectedPage.name} className="flex-1 overflow-y-auto">
              <div className="max-w-4xl mx-auto px-3 sm:px-8 py-4 sm:py-8">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-8 md:p-12">
                  {selectedPage.content ? (
                    /* De opmaak van het artikel staat hier, en geldt voor
                       markdown- en HTML-artikelen gelijk. (De typografie-
                       plugin achter "prose" zit niet in de app; zonder deze
                       regels waren koppen en opsommingen platte tekst.) */
                    <div
                      className="max-w-none text-slate-700 leading-relaxed
                        [&_h1]:mb-4 [&_h1]:mt-2 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-slate-900
                        [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-800
                        [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-800
                        [&_p]:my-2
                        [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1
                        [&_a]:text-blue-600 [&_a:hover]:underline
                        [&_strong]:font-semibold [&_strong]:text-slate-800
                        [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-blue-200 [&_blockquote]:pl-4 [&_blockquote]:text-slate-600
                        [&_table]:my-3 [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-sm
                        [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold
                        [&_td]:border [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-1.5 [&_td]:align-top
                        [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-lg
                        [&_hr]:my-6 [&_hr]:border-slate-200
                        [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-100 [&_pre]:p-4 [&_pre]:text-sm
                        [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm [&_code]:text-rose-600"
                      onClick={volgArtikelLink}
                      dangerouslySetInnerHTML={{
                        __html: artikelHtml,
                      }}
                    />
                  ) : (
                    <div className="text-center py-16 text-slate-400">
                      <Eye size={32} className="mx-auto mb-3 text-slate-300" />
                      <p className="text-sm">{t("wiki.no_content")}</p>
                      <button
                        onClick={startEditing}
                        className="mt-3 text-sm text-blue-600 hover:underline cursor-pointer"
                      >
                        {t("wiki.start_writing")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ─── EDIT MODE ─── */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Edit top bar */}
            <div className="flex items-center justify-between gap-2 px-3 sm:px-8 py-3 sm:py-4 border-b border-slate-200 bg-white flex-wrap">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <Edit3 size={20} className="text-blue-600 shrink-0" />
                <span className="text-sm font-medium text-slate-500">{t("common.edit")}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Save status */}
                {saveStatus === "saving" && (
                  <span className="flex items-center gap-1.5 text-sm text-slate-400">
                    <RefreshCw size={14} className="animate-spin" />
                    {t("wiki.saving")}
                  </span>
                )}
                {saveStatus === "saved" && (
                  <span className="flex items-center gap-1.5 text-sm text-green-600">
                    <Check size={14} />
                    {t("wiki.saved")}
                  </span>
                )}
                {saveStatus === "error" && (
                  <span className="text-sm text-red-500">{t("dashboard.todo_save_error")}</span>
                )}

                <button
                  onClick={() => { setBewerkt(null); setSaveStatus("idle"); }}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors text-sm font-medium cursor-pointer"
                >
                  <X size={16} />
                  <span className="hidden sm:inline">{t("common.cancel")}</span>
                </button>
                <button
                  onClick={handleSave}
                  disabled={saveStatus === "saving"}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 cursor-pointer"
                >
                  <Save size={16} />
                  <span className="hidden sm:inline">{t("common.save")}</span>
                </button>
              </div>
            </div>

            {/* Edit area */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-4xl mx-auto px-3 sm:px-8 py-4 sm:py-8">
                {/* Title input */}
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder={t("wiki.page_title_placeholder")}
                  className="w-full text-2xl font-bold text-slate-900 bg-transparent border-none outline-none placeholder:text-slate-300 mb-6"
                />

                {/* Schrijven met opmaak: dezelfde editor als bij een mail, dus
                    vet, koppen, lijsten, links en tabellen — en een afbeelding
                    die je erin plakt wordt meteen geüpload. */}
                <div className="min-h-[520px] overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <RichTextEditor
                    value={editContent}
                    onChange={setEditContent}
                    onAfbeelding={plakAfbeelding}
                    placeholder={t("wiki.content_placeholder")}
                    ariaLabel={t("wiki.content_placeholder")}
                    className="h-full"
                  />
                </div>
                <p className="mt-2 text-[11px] text-slate-400">{t("wiki.editor_hint")}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── New Page Modal ─── */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">{t("wiki.new_wiki_page")}</h3>
              <button
                onClick={() => { setShowNewModal(false); setNewTitle(""); }}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">{t("wiki.title_label")}</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreatePage()}
                placeholder={t("wiki.title_example")}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
              {newTitle && (
                <p className="text-xs text-slate-400 mt-2">
                  {t("wiki.route_label")}: <span className="font-mono">wiki/{slugify(newTitle)}</span>
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-xl">
              <button
                onClick={() => { setShowNewModal(false); setNewTitle(""); }}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleCreatePage}
                disabled={!newTitle.trim() || creating}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {creating ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                {t("wiki.create")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
