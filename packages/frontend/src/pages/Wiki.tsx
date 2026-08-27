import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { fetchList, createDocument, updateDocument, isDoctypeMissing } from "../lib/erpnext";
import {
  BookOpen, Plus, Search, Edit3, Save, X, ChevronRight, ChevronLeft,
  Bold, Italic, Heading, List, Link, Code, Eye, RefreshCw,
  FileText, Clock, Check, AlertTriangle,
} from "lucide-react";
import { useTranslation } from "react-i18next";

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

/**
 * Very basic markdown-to-HTML converter for view mode.
 * Handles headings, bold, italic, code blocks, inline code, links, lists, paragraphs.
 */
function markdownToHtml(md: string): string {
  if (!md) return "";

  // If content already looks like HTML (contains common tags), return as-is
  if (/<(div|p|h[1-6]|ul|ol|li|table|br|img|a|span|section)\b/i.test(md)) {
    return md;
  }

  let html = md;

  // Code blocks (fenced)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
    return `<pre class="bg-slate-100 rounded-lg p-4 overflow-x-auto text-sm font-mono my-4"><code>${code
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-1.5 py-0.5 rounded text-sm font-mono text-rose-600">$1</code>');

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-slate-800 mt-6 mb-2">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-slate-800 mt-8 mb-3">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-slate-900 mt-8 mb-4">$1</h1>');

  // Bold & italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">$1</a>');

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full rounded-lg my-4" />');

  // Unordered lists
  html = html.replace(/^[\t ]*[-*] (.+)$/gm, '<li class="ml-4">$1</li>');
  html = html.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul class="list-disc pl-4 my-2 space-y-1">$1</ul>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4">$1</li>');

  // Horizontal rule
  html = html.replace(/^---+$/gm, '<hr class="my-6 border-slate-200" />');

  // Paragraphs: wrap standalone lines
  html = html.replace(/^(?!<[a-z])((?!<).+)$/gm, '<p class="my-2 leading-relaxed">$1</p>');

  return html;
}

/* ─── Toolbar Config ─── */

interface ToolbarAction {
  icon: typeof Bold;
  label: string;
  prefix: string;
  suffix: string;
  block?: boolean;
}

const toolbarActions: ToolbarAction[] = [
  { icon: Bold, label: "wiki.toolbar_bold", prefix: "**", suffix: "**" },
  { icon: Italic, label: "wiki.toolbar_italic", prefix: "*", suffix: "*" },
  { icon: Heading, label: "wiki.toolbar_heading", prefix: "## ", suffix: "", block: true },
  { icon: List, label: "wiki.toolbar_list", prefix: "- ", suffix: "", block: true },
  { icon: Link, label: "wiki.toolbar_link", prefix: "[", suffix: "](url)" },
  { icon: Code, label: "wiki.toolbar_code", prefix: "`", suffix: "`" },
];

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
  const [selectedPage, setSelectedPage] = useState<WikiPage | null>(null);
  const [mode, setMode] = useState<Mode>("view");
  const [searchQuery, setSearchQuery] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Edit state
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      // If we had a selected page, refresh it
      if (selectedPage) {
        const updated = data.find((p) => p.name === selectedPage.name);
        if (updated) setSelectedPage(updated);
      }
    } catch (err) {
      console.error("Failed to load wiki pages:", err);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  /* ─── Filtered list ─── */
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
    setSelectedPage(page);
    setMode("view");
    setSaveStatus("idle");
  }

  /* ─── Edit mode ─── */
  function startEditing() {
    if (!selectedPage) return;
    setEditTitle(selectedPage.title || "");
    setEditContent(selectedPage.content || "");
    setMode("edit");
    setSaveStatus("idle");
  }

  /* ─── Save ─── */
  async function handleSave() {
    if (!selectedPage) return;
    setSaveStatus("saving");
    try {
      const updated = await updateDocument<WikiPage>("Wiki Page", selectedPage.name, {
        title: editTitle,
        content: editContent,
      });
      setSaveStatus("saved");
      setSelectedPage({ ...selectedPage, ...updated, title: editTitle, content: editContent });
      // Refresh the list
      setPages((prev) =>
        prev.map((p) =>
          p.name === selectedPage.name
            ? { ...p, title: editTitle, content: editContent, modified: new Date().toISOString() }
            : p
        )
      );
      setTimeout(() => {
        setMode("view");
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
      setSelectedPage(created);
      // Go straight to edit mode for the new page
      setEditTitle(created.title || newTitle);
      setEditContent(created.content || "");
      setMode("edit");
    } catch (err) {
      console.error("Failed to create wiki page:", err);
    } finally {
      setCreating(false);
    }
  }

  /* ─── Toolbar insert ─── */
  function insertMarkdown(action: ToolbarAction) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = editContent.substring(start, end);
    const before = editContent.substring(0, start);
    const after = editContent.substring(end);

    let insertion: string;
    if (action.block) {
      // For block-level, prepend at line start
      const lineStart = before.lastIndexOf("\n") + 1;
      const prefix = before.substring(0, lineStart);
      const lineContent = before.substring(lineStart);
      insertion = prefix + action.prefix + lineContent + selected + action.suffix + after;
    } else {
      insertion = before + action.prefix + (selected || t("wiki.placeholder_text")) + action.suffix + after;
    }

    setEditContent(insertion);
    // Restore focus
    requestAnimationFrame(() => {
      ta.focus();
      const newCursor = start + action.prefix.length + (selected || t("wiki.placeholder_text")).length;
      ta.setSelectionRange(newCursor, newCursor);
    });
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
          /* Empty state (only seen on desktop) */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <BookOpen size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-400 mb-1">{t("wiki.select_page")}</h3>
              <p className="text-sm text-slate-400">
                {t("wiki.select_or_create_hint")}
              </p>
            </div>
          </div>
        ) : mode === "view" ? (
          /* ─── VIEW MODE ─── */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top bar */}
            <div className="flex items-center justify-between gap-2 px-3 sm:px-8 py-3 sm:py-4 border-b border-slate-200 bg-white">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {/* Mobile-only back-to-list button */}
                <button
                  onClick={() => setSelectedPage(null)}
                  className="md:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer shrink-0"
                  title={t("common.back", { defaultValue: "Back" })}
                >
                  <ChevronLeft size={20} />
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
              <button
                onClick={startEditing}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-medium cursor-pointer shrink-0"
              >
                <Edit3 size={16} />
                <span className="hidden sm:inline">{t("wiki.edit")}</span>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-4xl mx-auto px-3 sm:px-8 py-4 sm:py-8">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-8 md:p-12">
                  {selectedPage.content ? (
                    <div
                      className="prose prose-slate max-w-none
                        prose-headings:text-slate-800
                        prose-p:text-slate-600 prose-p:leading-relaxed
                        prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                        prose-code:text-rose-600 prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
                        prose-pre:bg-slate-100 prose-pre:rounded-lg
                        prose-img:rounded-lg prose-img:shadow-sm
                        prose-li:text-slate-600
                        prose-strong:text-slate-800
                        prose-blockquote:border-blue-300 prose-blockquote:text-slate-500"
                      dangerouslySetInnerHTML={{ __html: markdownToHtml(selectedPage.content) }}
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
                  onClick={() => { setMode("view"); setSaveStatus("idle"); }}
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

                {/* Toolbar */}
                <div className="bg-white rounded-t-xl border border-slate-200 border-b-0 px-3 py-2 flex items-center gap-1">
                  {toolbarActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.label}
                        onClick={() => insertMarkdown(action)}
                        title={t(action.label)}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                      >
                        <Icon size={16} />
                      </button>
                    );
                  })}
                </div>

                {/* Content textarea */}
                <textarea
                  ref={textareaRef}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder={t("wiki.content_placeholder")}
                  className="w-full min-h-[500px] bg-white rounded-b-xl border border-slate-200 px-6 py-5 text-sm text-slate-700 font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
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
