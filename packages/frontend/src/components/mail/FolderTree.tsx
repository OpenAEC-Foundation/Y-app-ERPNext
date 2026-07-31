import { useState, useEffect, useMemo, useRef } from "react";
import {
  ChevronDown, ChevronRight, FolderInput, Star, Settings, Plus, Pencil, Send, Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MailFolder } from "../../lib/mail-types";
import { getFolderIcon, getFolderIconColor } from "../../lib/folder-icons";
import {
  getHiddenFolders, setHiddenFolders, getFavoriteFolders, setFavoriteFolders,
  getSentFolderOverride, setSentFolderOverride,
} from "../../lib/folder-prefs";

/* ─── Folder tree ─── */

interface FolderNode { folder: MailFolder; children: FolderNode[]; }

function buildFolderTree(folders: MailFolder[]): FolderNode[] {
  const roots: FolderNode[] = [];
  const nodeMap = new Map<string, FolderNode>();
  const sorted = [...folders].sort((a, b) => a.path.localeCompare(b.path));
  for (const f of sorted) {
    const node: FolderNode = { folder: f, children: [] };
    nodeMap.set(f.path, node);
    const sepIdx = Math.max(f.path.lastIndexOf("/"), f.path.lastIndexOf("."));
    const parentPath = sepIdx > 0 ? f.path.slice(0, sepIdx) : null;
    const parent = parentPath ? nodeMap.get(parentPath) : null;
    if (parent) parent.children.push(node); else roots.push(node);
  }
  return roots;
}

export default function FolderTree({ folders, activeFolder, onSelect, onDropMessage, onCreateFolder, onRenameFolder, onDeleteFolder, collapsed }: {
  folders: MailFolder[]; activeFolder: string; onSelect: (path: string) => void;
  onDropMessage?: (toFolder: string) => void;
  onCreateFolder?: (parentPath: string) => void;
  onRenameFolder?: (path: string) => void;
  onDeleteFolder?: (path: string) => void;
  collapsed?: boolean;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["INBOX"]));
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string } | null>(null);
  const [hiddenPaths, setHiddenPaths] = useState<Set<string>>(getHiddenFolders);
  const [favoritePaths, setFavoritePaths] = useState<Set<string>>(getFavoriteFolders);
  const [sentOverride, setSentOverride] = useState<string>(getSentFolderOverride);
  const [showFolderSettings, setShowFolderSettings] = useState(false);
  const [folderSearch, setFolderSearch] = useState("");
  const settingsRef = useRef<HTMLDivElement>(null);

  // Filter hidden folders
  const visibleFolders = useMemo(
    () => folders.filter(f => !hiddenPaths.has(f.name) && !hiddenPaths.has(f.path)),
    [folders, hiddenPaths]
  );
  const tree = useMemo(() => buildFolderTree(visibleFolders), [visibleFolders]);
  // Folder-search: bij actieve zoekterm renderen we platte lijst i.p.v.
  // de tree (eenvoudiger te scannen bij veel diepe project-folders).
  const searchedFolders = useMemo(() => {
    const q = folderSearch.trim().toLowerCase();
    if (!q) return null;
    return visibleFolders.filter(
      f => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q),
    );
  }, [folderSearch, visibleFolders]);
  // Tree van álle folders (incl. verborgen) voor de "Show/hide"-dropdown.
  // De normale `tree` filtert verborgen mappen weg — die mogen daar juist
  // wel staan zodat de gebruiker ze terug kan zetten.
  const allFoldersTree = useMemo(() => buildFolderTree(folders), [folders]);
  const favoriteFoldersList = useMemo(
    () => folders.filter(f => favoritePaths.has(f.path)),
    [folders, favoritePaths]
  );

  // Close folder settings on click outside
  useEffect(() => {
    if (!showFolderSettings) return;
    const close = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setShowFolderSettings(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showFolderSettings]);

  function toggleHidden(folderName: string) {
    const next = new Set(hiddenPaths);
    if (next.has(folderName)) next.delete(folderName); else next.add(folderName);
    setHiddenPaths(next);
    setHiddenFolders(next);
  }

  function toggleFavorite(folderPath: string) {
    const next = new Set(favoritePaths);
    if (next.has(folderPath)) next.delete(folderPath); else next.add(folderPath);
    setFavoritePaths(next);
    setFavoriteFolders(next);
  }

  function toggle(path: string) {
    setExpanded(prev => { const next = new Set(prev); if (next.has(path)) next.delete(path); else next.add(path); return next; });
  }

  function handleDragOver(e: React.DragEvent, path: string) {
    if (path === activeFolder) return; // Can't drop on same folder
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(path);
  }

  function handleDrop(e: React.DragEvent, path: string) {
    e.preventDefault();
    setDropTarget(null);
    if (onDropMessage) onDropMessage(path);
  }

  function handleContextMenu(e: React.MouseEvent, path: string) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, path });
  }

  // Close context menu on click elsewhere
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenu]);

  function renderNode(node: FolderNode, depth: number) {
    const f = node.folder;
    const Icon = getFolderIcon(f.name, f.specialUse);
    const active = f.path === activeFolder;
    const hasChildren = node.children.length > 0;
    const isExpanded = expanded.has(f.path);
    const isInbox = f.specialUse === "\\Inbox" || f.path === "INBOX";
    const isDragOver = dropTarget === f.path;
    const iconColor = getFolderIconColor(f.name, f.specialUse, active || isDragOver);

    // Collapsed mode: show only icon with tooltip
    if (collapsed) {
      return (
        <div key={f.path}>
          <button onClick={() => onSelect(f.path)}
            title={`${f.name}${f.unseen ? ` (${f.unseen})` : ""}`}
            onDragOver={(e) => handleDragOver(e, f.path)}
            onDragLeave={() => setDropTarget(null)}
            onDrop={(e) => handleDrop(e, f.path)}
            className={`w-full flex items-center justify-center py-2 cursor-pointer transition-colors relative ${
              isDragOver ? "bg-blue-100 text-blue-700" :
              active ? "bg-blue-50 text-blue-700" :
              "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            }`}>
            <Icon size={18} className={iconColor} />
            {f.unseen ? (
              <span className="absolute top-0.5 right-1 text-[8px] font-bold bg-blue-500 text-white rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">{f.unseen}</span>
            ) : null}
          </button>
        </div>
      );
    }

    return (
      <div key={f.path}>
        <div className="flex items-center group"
          onDragOver={(e) => handleDragOver(e, f.path)}
          onDragLeave={() => setDropTarget(null)}
          onDrop={(e) => handleDrop(e, f.path)}
          onContextMenu={(e) => handleContextMenu(e, f.path)}>
          {hasChildren ? (
            <button onClick={() => toggle(f.path)} className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer flex-shrink-0" style={{ marginLeft: depth * 12 }}>
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          ) : (
            <span className="w-5 flex-shrink-0" style={{ marginLeft: depth * 12 }} />
          )}
          <button onClick={() => onSelect(f.path)}
            className={`flex-1 flex items-center gap-2 px-2 py-1.5 text-left transition-colors cursor-pointer rounded-r ${
              isDragOver ? "bg-blue-100 text-blue-700 ring-2 ring-blue-400" :
              active ? "bg-blue-50 text-blue-700 font-semibold" :
              "text-slate-600 hover:bg-slate-50"
            }`}>
            <Icon size={15} className={iconColor} />
            <span className={`text-sm truncate ${isInbox && !active ? "font-medium" : ""} ${f.unseen ? "font-semibold" : ""}`}>{f.name}</span>
            {f.unseen ? (
              <span className="ml-auto text-[10px] font-bold bg-blue-500 text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{f.unseen}</span>
            ) : isDragOver ? <FolderInput size={12} className="text-blue-500 ml-auto" /> : null}
          </button>
          {/* Favorite star — visible on hover */}
          <button
            onClick={() => toggleFavorite(f.path)}
            className={`flex-shrink-0 p-0.5 cursor-pointer transition-colors ${
              favoritePaths.has(f.path) ? "text-amber-400" : "text-slate-300 opacity-0 group-hover:opacity-100"
            }`}
            title={favoritePaths.has(f.path) ? t("webmail.remove_favorite", { defaultValue: "Remove from favorites" }) : t("webmail.add_favorite", { defaultValue: "Add to favorites" })}
          >
            <Star size={12} fill={favoritePaths.has(f.path) ? "currentColor" : "none"} />
          </button>
        </div>
        {hasChildren && isExpanded && <div>{node.children.map(child => renderNode(child, depth + 1))}</div>}
      </div>
    );
  }

  function renderFavoriteRow(f: MailFolder) {
    const Icon = getFolderIcon(f.name, f.specialUse);
    const active = f.path === activeFolder;
    const isDragOver = dropTarget === f.path;
    const iconColor = getFolderIconColor(f.name, f.specialUse, active || isDragOver);
    return (
      // Drag-handlers + context-menu OOK hier, zodat slepen-naar-favoriet en
      // slepen-naar-zoekresultaat werkt (renderFavoriteRow rendert beide). Zonder
      // dit miste een mail-drop op deze rijen z'n drop-target volledig.
      <div key={`fav-${f.path}`} className="flex items-center group"
        onDragOver={(e) => handleDragOver(e, f.path)}
        onDragLeave={() => setDropTarget(null)}
        onDrop={(e) => handleDrop(e, f.path)}
        onContextMenu={(e) => handleContextMenu(e, f.path)}>
        <button onClick={() => onSelect(f.path)}
          className={`flex-1 flex items-center gap-2 px-3 py-1.5 text-left transition-colors cursor-pointer rounded ${
            isDragOver ? "bg-blue-100 text-blue-700 ring-2 ring-blue-400" :
            active ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-600 hover:bg-slate-50"
          }`}>
          <Icon size={15} className={iconColor} />
          <span className={`text-sm truncate ${f.unseen ? "font-semibold" : ""}`}>{f.name}</span>
          {f.unseen ? (
            <span className="ml-auto text-[10px] font-bold bg-blue-500 text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{f.unseen}</span>
          ) : null}
        </button>
        <button onClick={() => toggleFavorite(f.path)}
          className="flex-shrink-0 p-0.5 cursor-pointer text-amber-400 transition-colors"
          title={t("webmail.remove_favorite", { defaultValue: "Remove from favorites" })}>
          <Star size={12} fill="currentColor" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 relative">
      {folders.length === 0 && <p className="text-xs text-slate-400 px-4 py-2">{t("common.loading")}</p>}

      {/* Folder-search bovenaan */}
      {!collapsed && folders.length > 0 && (
        <div className="px-3 pb-2">
          <input
            type="search"
            placeholder={t("webmail.search_folders", { defaultValue: "Zoek mappen..." })}
            value={folderSearch}
            onChange={(e) => setFolderSearch(e.target.value)}
            className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      )}

      {searchedFolders ? (
        /* Search-mode: platte lijst */
        searchedFolders.length === 0 ? (
          <p className="text-xs text-slate-400 px-4 py-2 italic">
            {t("webmail.no_folder_matches", { defaultValue: "Geen mappen gevonden" })}
          </p>
        ) : (
          searchedFolders.map(f => renderFavoriteRow(f))
        )
      ) : (
        <>
          {/* Favorites section */}
          {!collapsed && favoriteFoldersList.length > 0 && (
            <div className="border-b border-slate-200 pb-1 mb-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide px-3 py-1">
                {t("webmail.favorites", { defaultValue: "Favorites" })}
              </div>
              {favoriteFoldersList.map(f => renderFavoriteRow(f))}
            </div>
          )}

          {/* Folder tree */}
          {tree.map(node => renderNode(node, 0))}
        </>
      )}

      {/* Folder visibility settings gear */}
      {!collapsed && (
        <div className="relative px-3 pt-2 border-t border-slate-100 mt-1" ref={settingsRef}>
          <button
            onClick={() => setShowFolderSettings(!showFolderSettings)}
            className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
          >
            <Settings size={11} />
            {t("webmail.folder_visibility", { defaultValue: "Folder visibility" })}
          </button>

          {showFolderSettings && (
            <div className="absolute bottom-full left-0 mb-1 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-50 max-h-[300px] overflow-y-auto w-64">
              <div className="px-3 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100 mb-1">
                {t("webmail.show_hide_folders", { defaultValue: "Show/hide folders" })}
              </div>
              {(() => {
                const renderVisibilityNode = (node: FolderNode, depth: number) => {
                  const f = node.folder;
                  const isHidden = hiddenPaths.has(f.name) || hiddenPaths.has(f.path);
                  return (
                    <div key={f.path}>
                      <label
                        className="flex items-center gap-2 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 cursor-pointer"
                        style={{ paddingLeft: 12 + depth * 14 }}
                      >
                        <input
                          type="checkbox"
                          checked={!isHidden}
                          onChange={() => toggleHidden(f.name)}
                          className="rounded border-slate-300 text-blue-500"
                        />
                        <span className="truncate">{f.name}</span>
                      </label>
                      {node.children.map(child => renderVisibilityNode(child, depth + 1))}
                    </div>
                  );
                };
                return allFoldersTree.map(node => renderVisibilityNode(node, 0));
              })()}
            </div>
          )}
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div className="fixed bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button onClick={() => { onCreateFolder?.(contextMenu.path); setContextMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer flex items-center gap-2">
            <Plus size={12} /> {t("webmail.new_folder")}
          </button>
          {contextMenu.path !== "INBOX" && (
            <button onClick={() => { onRenameFolder?.(contextMenu.path); setContextMenu(null); }}
              className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer flex items-center gap-2">
              <Pencil size={12} /> {t("webmail.rename")}
            </button>
          )}
          {/* Favoriet toggelen — rechtermuis-equivalent van het sterretje. */}
          <button onClick={() => { toggleFavorite(contextMenu.path); setContextMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer flex items-center gap-2">
            <Star size={12} fill={favoritePaths.has(contextMenu.path) ? "currentColor" : "none"} className={favoritePaths.has(contextMenu.path) ? "text-amber-400" : ""} />
            {favoritePaths.has(contextMenu.path)
              ? t("webmail.remove_favorite", { defaultValue: "Verwijderen uit favorieten" })
              : t("webmail.add_favorite", { defaultValue: "Toevoegen aan favorieten" })}
          </button>
          {/* Verzonden-map instellen — fix voor servers met meerdere Sent-achtige
              mappen: dwingt de sent-kopie naar de map die de gebruiker echt gebruikt. */}
          <button onClick={() => {
            const next = sentOverride === contextMenu.path ? "" : contextMenu.path;
            setSentFolderOverride(next);
            setSentOverride(next);
            setContextMenu(null);
          }}
            className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer flex items-center gap-2">
            <Send size={12} className={sentOverride === contextMenu.path ? "text-teal-500" : ""} />
            {sentOverride === contextMenu.path
              ? t("webmail.unset_sent_folder", { defaultValue: "Niet meer als Verzonden-map" })
              : t("webmail.set_sent_folder", { defaultValue: "Als Verzonden-map instellen" })}
          </button>
          {/* Map verwijderen — niet voor INBOX of system-mappen (specialUse). */}
          {(() => {
            const ctxF = folders.find(ff => ff.path === contextMenu.path);
            const isSystem = !!ctxF?.specialUse &&
              ["\\Inbox", "\\Sent", "\\Trash", "\\Drafts", "\\Junk", "\\Archive"].includes(ctxF.specialUse);
            if (contextMenu.path === "INBOX" || isSystem) return null;
            return (
              <button onClick={() => { onDeleteFolder?.(contextMenu.path); setContextMenu(null); }}
                className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 cursor-pointer flex items-center gap-2 border-t border-slate-100 mt-1 pt-2">
                <Trash2 size={12} /> {t("webmail.delete_folder", { defaultValue: "Map verwijderen" })}
              </button>
            );
          })()}
        </div>
      )}
    </div>
  );
}
