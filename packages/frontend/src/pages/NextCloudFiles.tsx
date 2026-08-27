import { useState, useEffect, useCallback, useRef } from "react";
import { isDesktopApp } from "../lib/desktop";
import {
  Cloud,
  Settings,
  Folder,
  FolderOpen,
  File,
  FileImage,
  FileText,
  FileVideo,
  FileAudio,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  RefreshCw,
  Loader2,
  AlertCircle,
  Home,
  Upload,
  ExternalLink,
  Monitor,
  Link,
  Trash2,
  X,
  Copy,
  Check,
} from "lucide-react";
import { getActiveInstanceId } from "../lib/instances";
import { useTranslation } from "react-i18next";

/* ─── Types ─── */

interface FileEntry {
  name: string;
  path: string;
  size: number;
  lastModified: string;
  contentType: string;
  isDirectory: boolean;
}

interface TreeNode {
  name: string;
  path: string;
  children: TreeNode[];
  loaded: boolean;
  expanded: boolean;
  loading: boolean;
}

interface LocalLink {
  id: string;
  name: string;
  localPath: string;
  type: "file" | "folder";
  createdAt: string;
}

const API_BASE = "";

/* ─── Local Links Storage ─── */

function getLocalLinksKey(instanceId: string, ncPath: string): string {
  return `locallinks_${instanceId}_${ncPath}`;
}

function getLocalLinks(instanceId: string, ncPath: string): LocalLink[] {
  try {
    const raw = localStorage.getItem(getLocalLinksKey(instanceId, ncPath));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalLinks(instanceId: string, ncPath: string, links: LocalLink[]) {
  localStorage.setItem(getLocalLinksKey(instanceId, ncPath), JSON.stringify(links));
}

function addLocalLink(instanceId: string, ncPath: string, link: Omit<LocalLink, "id" | "createdAt">): LocalLink[] {
  const links = getLocalLinks(instanceId, ncPath);
  const newLink: LocalLink = {
    ...link,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  links.push(newLink);
  saveLocalLinks(instanceId, ncPath, links);
  return links;
}

function removeLocalLink(instanceId: string, ncPath: string, linkId: string): LocalLink[] {
  const links = getLocalLinks(instanceId, ncPath).filter((l) => l.id !== linkId);
  saveLocalLinks(instanceId, ncPath, links);
  return links;
}

/* ─── Helpers ─── */

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function getFileIcon(entry: FileEntry) {
  if (entry.isDirectory) return <Folder size={18} className="text-blue-500" />;
  const ct = entry.contentType || "";
  const ext = entry.name.split(".").pop()?.toLowerCase() || "";

  if (ct.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico"].includes(ext))
    return <FileImage size={18} className="text-emerald-500" />;
  if (ct.startsWith("video/") || ["mp4", "avi", "mkv", "mov", "webm", "flv"].includes(ext))
    return <FileVideo size={18} className="text-purple-500" />;
  if (ct.startsWith("audio/") || ["mp3", "wav", "flac", "ogg", "aac", "wma"].includes(ext))
    return <FileAudio size={18} className="text-pink-500" />;
  if (["xls", "xlsx", "ods", "csv"].includes(ext))
    return <FileSpreadsheet size={18} className="text-green-600" />;
  if (["zip", "rar", "7z", "tar", "gz", "bz2", "xz"].includes(ext))
    return <FileArchive size={18} className="text-amber-600" />;
  if (["js", "ts", "jsx", "tsx", "py", "java", "c", "cpp", "h", "cs", "go", "rs", "rb", "php", "html", "css", "json", "xml", "yaml", "yml", "sh", "bat"].includes(ext))
    return <FileCode size={18} className="text-sky-500" />;
  if (ct.startsWith("text/") || ["pdf", "doc", "docx", "ppt", "pptx", "txt", "md", "rtf", "odt"].includes(ext))
    return <FileText size={18} className="text-orange-500" />;
  return <File size={18} className="text-slate-400" />;
}

function getFileType(entry: FileEntry, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (entry.isDirectory) return t("nextcloud_files.folder");
  const ext = entry.name.split(".").pop()?.toUpperCase() || "";
  if (ext) return t("nextcloud_files.ext_file", { ext });
  return t("nextcloud_files.file");
}

function getStoredCreds(instanceId: string) {
  return {
    url: localStorage.getItem(`pref_${instanceId}_nextcloud_url`) || "",
    user: localStorage.getItem(`pref_${instanceId}_nextcloud_user`) || "",
    pass: localStorage.getItem(`pref_${instanceId}_nextcloud_pass`) || "",
  };
}

function hasStoredCreds(instanceId: string) {
  const c = getStoredCreds(instanceId);
  return !!(c.url && c.user && c.pass);
}

/* ─── Folder tree cache ─── */
const folderTreeCache = new Map<string, FileEntry[]>();

/* ─── Component ─── */

export default function NextCloudFiles() {
  const { t } = useTranslation();
  const instanceId = getActiveInstanceId();
  const [showSetup, setShowSetup] = useState(false);
  const [hasBackendCreds, setHasBackendCreds] = useState(false);

  // Check if backend has NextCloud credentials for this instance
  useEffect(() => {
    fetch(`${API_BASE}/api/services`, { credentials: "same-origin" })
      .then(r => r.json())
      .then(json => {
        if (json.data?.nextcloud?.url) {
          setHasBackendCreds(true);
          setShowSetup(false);
        } else if (hasStoredCreds(instanceId)) {
          setShowSetup(false);
        } else {
          setShowSetup(true);
        }
      })
      .catch(() => {
        if (!hasStoredCreds(instanceId)) setShowSetup(true);
      });
  }, [instanceId]);

  // Setup form state
  const stored = getStoredCreds(instanceId);
  const [url, setUrl] = useState(stored.url);
  const [user, setUser] = useState(stored.user);
  const [pass, setPass] = useState(stored.pass);
  const [saved, setSaved] = useState(false);

  // File browser state
  const [currentPath, setCurrentPath] = useState("/");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Folder tree state
  const [treeRoot, setTreeRoot] = useState<TreeNode>({
    name: t("nextcloud_files.home"),
    path: "/",
    children: [],
    loaded: false,
    expanded: true,
    loading: false,
  });
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const resizingRef = useRef(false);

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Local links state
  const [localLinks, setLocalLinks] = useState<LocalLink[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkName, setLinkName] = useState("");
  const [linkPath, setLinkPath] = useState("");
  const [linkType, setLinkType] = useState<"file" | "folder">("file");
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  // Load local links when path changes
  useEffect(() => {
    setLocalLinks(getLocalLinks(instanceId, currentPath));
  }, [instanceId, currentPath]);

  function handleAddLocalLink() {
    if (!linkName.trim() || !linkPath.trim()) return;
    const updated = addLocalLink(instanceId, currentPath, {
      name: linkName.trim(),
      localPath: linkPath.trim(),
      type: linkType,
    });
    setLocalLinks(updated);
    setLinkName("");
    setLinkPath("");
    setLinkType("file");
    setShowLinkModal(false);
  }

  function handleDeleteLocalLink(linkId: string) {
    const updated = removeLocalLink(instanceId, currentPath, linkId);
    setLocalLinks(updated);
  }

  function handleOpenLocalLink(link: LocalLink) {
    // Browsers block file:// links from http:// pages, so copy to clipboard
    navigator.clipboard.writeText(link.localPath).then(() => {
      setCopiedLinkId(link.id);
      setTimeout(() => setCopiedLinkId(null), 2000);
    }).catch(() => {
      // Fallback: try file:// protocol anyway
      const filePath = link.localPath.replace(/\\/g, "/");
      window.open(`file:///${filePath}`, "_blank");
    });
  }

  /* ─── API calls ─── */

  const fetchFiles = useCallback(async (path: string): Promise<FileEntry[]> => {
    // Use instance-based credential lookup (backend reads from vault)
    const params = new URLSearchParams({ instance: instanceId, path });
    const resp = await fetch(`${API_BASE}/api/nextcloud/files?${params}`);
    const json = await resp.json();
    if (!resp.ok) throw new Error(json.error || `HTTP ${resp.status}`);
    return json.data || [];
  }, [instanceId]);

  const loadFiles = useCallback(async (path: string) => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchFiles(path);
      setFiles(data);
      setCurrentPath(path);
      // Cache folder entries for tree
      folderTreeCache.set(path, data);
    } catch (err) {
      setError((err as Error).message);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [fetchFiles]);

  // Load root tree + files on mount
  useEffect(() => {
    if (!showSetup && (hasBackendCreds || hasStoredCreds(instanceId))) {
      loadFiles("/");
      loadTreeChildren("/");
    }
  }, [showSetup, hasBackendCreds]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Folder tree logic ─── */

  const loadTreeChildren = useCallback(async (path: string) => {
    try {
      const data = await fetchFiles(path);
      folderTreeCache.set(path, data);
      const folders = data.filter((f) => f.isDirectory);

      setTreeRoot((prev) => {
        const updated = structuredClone(prev);
        const node = findNode(updated, path);
        if (node) {
          node.children = folders.map((f) => ({
            name: f.name,
            path: f.path,
            children: [],
            loaded: false,
            expanded: false,
            loading: false,
          }));
          node.loaded = true;
          node.loading = false;
        }
        return updated;
      });
    } catch {
      // Silently fail for tree loading
      setTreeRoot((prev) => {
        const updated = structuredClone(prev);
        const node = findNode(updated, path);
        if (node) {
          node.loading = false;
          node.loaded = true;
        }
        return updated;
      });
    }
  }, [fetchFiles]);

  function findNode(node: TreeNode, path: string): TreeNode | null {
    const normalizedNodePath = node.path.replace(/\/+$/, "") || "/";
    const normalizedSearchPath = path.replace(/\/+$/, "") || "/";
    if (normalizedNodePath === normalizedSearchPath) return node;
    for (const child of node.children) {
      const found = findNode(child, path);
      if (found) return found;
    }
    return null;
  }

  function handleTreeToggle(path: string) {
    setTreeRoot((prev) => {
      const updated = structuredClone(prev);
      const node = findNode(updated, path);
      if (node) {
        node.expanded = !node.expanded;
        if (node.expanded && !node.loaded) {
          node.loading = true;
        }
      }
      return updated;
    });

    // Find node to check if we need to load
    const node = findNode(treeRoot, path);
    if (node && !node.expanded && !node.loaded) {
      loadTreeChildren(path);
    }
  }

  function handleTreeSelect(path: string) {
    loadFiles(path);
    // Expand the selected node in tree
    setTreeRoot((prev) => {
      const updated = structuredClone(prev);
      const node = findNode(updated, path);
      if (node) {
        node.expanded = true;
        if (!node.loaded) {
          node.loading = true;
        }
      }
      return updated;
    });

    const node = findNode(treeRoot, path);
    if (node && !node.loaded) {
      loadTreeChildren(path);
    }
  }

  /* ─── Resize handle ─── */

  const handleMouseDown = useCallback(() => {
    resizingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const newWidth = Math.max(160, Math.min(400, e.clientX - 256)); // 256 = main sidebar width
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      resizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, []);

  /* ─── Navigation ─── */

  function navigateTo(path: string) {
    loadFiles(path);
    // Expand tree nodes along the path
    setTreeRoot((prev) => {
      const updated = structuredClone(prev);
      const parts = path.split("/").filter(Boolean);
      let currentNodePath = "/";
      const rootNode = findNode(updated, "/");
      if (rootNode) rootNode.expanded = true;

      for (let i = 0; i < parts.length; i++) {
        currentNodePath = "/" + parts.slice(0, i + 1).join("/");
        const node = findNode(updated, currentNodePath);
        if (node) {
          node.expanded = true;
          if (!node.loaded) {
            node.loading = true;
            loadTreeChildren(currentNodePath);
          }
        }
      }
      return updated;
    });
  }

  function navigateUp() {
    const parts = currentPath.replace(/\/+$/, "").split("/").filter(Boolean);
    parts.pop();
    const parent = "/" + parts.join("/");
    navigateTo(parent || "/");
  }

  function handleEntryClick(entry: FileEntry) {
    if (entry.isDirectory) {
      navigateTo(entry.path);
    } else {
      // Open file via backend proxy (credentials stay server-side)
      const params = new URLSearchParams({ instance: instanceId, path: entry.path });
      if (isDesktopApp()) {
        // window.open gaat NIET door de desktop fetch-adapter (en dead-navigeert
        // het enige Tauri-venster). Haal de blob via fetch (wél ge-intercept)
        // en trigger een download via een anchor.
        void (async () => {
          try {
            const resp = await fetch(`${API_BASE}/api/nextcloud/download?${params}`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const blob = await resp.blob();
            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = objectUrl;
            a.download = entry.name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
          } catch (err) {
            setError((err as Error).message);
          }
        })();
        return;
      }
      window.open(`${API_BASE}/api/nextcloud/download?${params}`, "_blank");
    }
  }

  /* ─── Upload ─── */

  async function handleUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    setUploading(true);
    setError("");

    try {
      for (const file of Array.from(fileList)) {
        const uploadPath = currentPath === "/" ? `/${file.name}` : `${currentPath}/${file.name}`;
        const params = new URLSearchParams({ instance: instanceId, path: uploadPath });

        const resp = await fetch(`${API_BASE}/api/nextcloud/upload?${params}`, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });

        if (!resp.ok) {
          const json = await resp.json().catch(() => ({}));
          throw new Error(json.error || t("nextcloud_files.upload_failed", { name: file.name, status: resp.status }));
        }
      }
      // Refresh
      await loadFiles(currentPath);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSave() {
    const cleanUrl = url.replace(/\/+$/, "");
    // Save to backend vault (encrypted, per tenant)
    try {
      await fetch(`${API_BASE}/api/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          nextcloud: { url: cleanUrl, user, pass },
        }),
      });
      setHasBackendCreds(true);
    } catch {
      // Fallback to localStorage
      localStorage.setItem(`pref_${instanceId}_nextcloud_url`, cleanUrl);
      localStorage.setItem(`pref_${instanceId}_nextcloud_user`, user);
      localStorage.setItem(`pref_${instanceId}_nextcloud_pass`, pass);
    }
    setSaved(true);
    setShowSetup(false);
    setCurrentPath("/");
    setTimeout(() => setSaved(false), 2000);
  }

  // Breadcrumb segments
  const pathParts = currentPath.split("/").filter(Boolean);
  const breadcrumbs = [
    { label: t("nextcloud_files.home"), path: "/" },
    ...pathParts.map((part, i) => ({
      label: decodeURIComponent(part),
      path: "/" + pathParts.slice(0, i + 1).join("/"),
    })),
  ];

  /* ─── Tree Node renderer ─── */

  function renderTreeNode(node: TreeNode, depth: number = 0) {
    const isActive = (node.path.replace(/\/+$/, "") || "/") === (currentPath.replace(/\/+$/, "") || "/");

    return (
      <div key={node.path}>
        <div
          className={`flex items-center gap-1 py-1 pr-2 rounded-md cursor-pointer transition-colors group ${
            isActive
              ? "bg-blue-50 text-blue-700"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); handleTreeToggle(node.path); }}
            className="p-0.5 rounded hover:bg-slate-200/50 flex-shrink-0 cursor-pointer"
          >
            {node.loading ? (
              <Loader2 size={14} className="animate-spin text-slate-400" />
            ) : node.expanded ? (
              <ChevronDown size={14} className="text-slate-400" />
            ) : (
              <ChevronRight size={14} className="text-slate-400" />
            )}
          </button>
          <button
            onClick={() => handleTreeSelect(node.path)}
            className="flex items-center gap-1.5 flex-1 min-w-0 text-left cursor-pointer"
          >
            {node.expanded ? (
              <FolderOpen size={16} className={isActive ? "text-blue-500" : "text-amber-500"} />
            ) : (
              <Folder size={16} className={isActive ? "text-blue-500" : "text-amber-500"} />
            )}
            <span className={`text-sm truncate ${isActive ? "font-semibold" : ""}`}>
              {node.name}
            </span>
          </button>
        </div>
        {node.expanded && node.children.map((child) => renderTreeNode(child, depth + 1))}
      </div>
    );
  }

  /* ─── Setup Screen ─── */

  if (showSetup) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Cloud className="text-blue-500" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">{t("nextcloud_files.connect_title")}</h2>
              <p className="text-xs text-slate-500">{t("nextcloud.setup_hint")}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t("settings.nextcloud_url_label")}</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://cloud.example.com"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <p className="text-xs text-slate-400 mt-1">{t("nextcloud_files.base_url_hint")}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t("settings.imap_username")}</label>
            <input
              type="text"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              autoComplete="off" name="nc-user"
              placeholder="admin"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t("settings.app_password_placeholder")}</label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="new-password" name="nc-pass"
              placeholder={t("nextcloud_files.app_password_placeholder")}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-400 mt-1">
              {t("nextcloud.use_app_password_hint")}
            </p>
          </div>

          {saved && (
            <div className="p-3 rounded-lg text-sm bg-green-50 border border-green-200 text-green-700">
              {t("nextcloud_files.saved")}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={!url.trim() || !user.trim() || !pass.trim()}
            className="w-full px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 text-sm font-medium cursor-pointer"
          >
            {t("nextcloud.save_and_connect")}
          </button>
        </div>
      </div>
    );
  }

  /* ─── File Browser (two-pane layout) ─── */

  return (
    <div className="h-full flex flex-col">
      {/* Top toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-slate-200 flex-shrink-0">
        {/* Back button */}
        <button
          onClick={navigateUp}
          disabled={currentPath === "/"}
          className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          title={t("nextcloud_files.parent_folder")}
        >
          <ArrowLeft size={18} className="text-slate-600" />
        </button>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-0.5 text-sm flex-1 min-w-0 overflow-x-auto">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.path} className="flex items-center gap-0.5 whitespace-nowrap">
              {i > 0 && <ChevronRight size={14} className="text-slate-300 flex-shrink-0" />}
              <button
                onClick={() => navigateTo(crumb.path)}
                className={`px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors cursor-pointer ${
                  i === breadcrumbs.length - 1
                    ? "font-semibold text-slate-800"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {i === 0 ? <Home size={14} /> : crumb.label}
              </button>
            </span>
          ))}
        </div>

        {/* Actions */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
          title={t("nextcloud_files.upload_file")}
        >
          {uploading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Upload size={16} />
          )}
          <span className="hidden sm:inline">{t("nextcloud_files.upload")}</span>
        </button>
        <button
          onClick={() => setShowLinkModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          title={t("nextcloud_files.add_local_link")}
        >
          <Link size={16} />
          <span className="hidden sm:inline">{t("nextcloud_files.local_link")}</span>
        </button>
        <button
          onClick={() => loadFiles(currentPath)}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          title={t("common.refresh")}
        >
          <RefreshCw size={16} className={`text-slate-500 ${loading ? "animate-spin" : ""}`} />
        </button>
        <button
          onClick={() => setShowSetup(true)}
          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          title={t("nav.settings")}
        >
          <Settings size={16} className="text-slate-500" />
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 mx-4 mt-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex-shrink-0">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-600 cursor-pointer">
            &times;
          </button>
        </div>
      )}

      {/* Main content: sidebar + file list */}
      <div className="flex flex-1 min-h-0">
        {/* Folder tree sidebar */}
        <div
          className="bg-white border-r border-slate-200 flex-shrink-0 overflow-y-auto py-2"
          style={{ width: `${sidebarWidth}px` }}
        >
          <div className="px-3 pb-1.5 mb-1 border-b border-slate-100">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{t("nextcloud_files.folders")}</span>
          </div>
          <div className="px-1">
            {renderTreeNode(treeRoot)}
          </div>
        </div>

        {/* Resize handle */}
        <div
          className="w-1 cursor-col-resize hover:bg-blue-300 active:bg-blue-400 transition-colors flex-shrink-0"
          onMouseDown={handleMouseDown}
        />

        {/* File list panel */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
          {/* Loading state */}
          {loading && files.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center gap-3 text-slate-400">
                <Loader2 size={24} className="animate-spin" />
                <span className="text-sm">{t("nextcloud_files.loading_files")}</span>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && files.length === 0 && localLinks.length === 0 && !error && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-slate-400">
                <Folder size={48} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">{t("nextcloud_files.folder_empty")}</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 text-sm text-blue-500 hover:text-blue-600 cursor-pointer"
                >
                  {t("nextcloud_files.upload_file")}
                </button>
              </div>
            </div>
          )}

          {/* File table */}
          {(files.length > 0 || localLinks.length > 0) && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_auto_32px] sm:grid-cols-[1fr_100px_80px_160px_32px] gap-2 px-4 py-2 bg-white border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex-shrink-0">
                <span>{t("settings.name_label")}</span>
                <span className="text-right">{t("nextcloud_files.size")}</span>
                <span>{t("nextcloud_files.type")}</span>
                <span className="text-right">{t("nextcloud_files.modified")}</span>
                <span></span>
              </div>

              {/* File rows */}
              <div className="flex-1 overflow-y-auto">
                {/* Local links section */}
                {localLinks.length > 0 && (
                  <>
                    <div className="px-4 py-1.5 bg-amber-50 border-b border-amber-100 text-[10px] font-semibold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                      <Monitor size={12} />
                      {t("nextcloud_files.local_links_header", { count: localLinks.length })}
                    </div>
                    {localLinks.map((link) => (
                      <div
                        key={link.id}
                        className="w-full grid grid-cols-[1fr_auto_32px] sm:grid-cols-[1fr_100px_80px_160px_32px] gap-2 px-4 py-2 hover:bg-amber-50/50 border-b border-slate-100 transition-colors text-left group"
                      >
                        <button
                          onClick={() => handleOpenLocalLink(link)}
                          className="flex items-center gap-2.5 min-w-0 cursor-pointer text-left"
                          title={t("nextcloud_files.click_to_copy", { path: link.localPath })}
                        >
                          <Monitor size={18} className={link.type === "folder" ? "text-amber-500" : "text-amber-600"} />
                          <span className="text-sm text-slate-700 truncate group-hover:text-amber-700 transition-colors">
                            {link.name}
                          </span>
                          {copiedLinkId === link.id ? (
                            <Check size={14} className="text-green-500 flex-shrink-0" />
                          ) : (
                            <Copy size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          )}
                        </button>
                        <span className="text-xs text-slate-400 text-right self-center">-</span>
                        <span className="text-xs text-slate-400 self-center truncate">
                          {link.type === "folder" ? t("nextcloud_files.local_folder") : t("nextcloud_files.local_file")}
                        </span>
                        <span className="text-xs text-slate-400 text-right self-center" title={link.localPath}>
                          {link.localPath.length > 25 ? "..." + link.localPath.slice(-25) : link.localPath}
                        </span>
                        <button
                          onClick={() => handleDeleteLocalLink(link.id)}
                          className="p-1 rounded hover:bg-red-100 text-slate-300 hover:text-red-500 transition-colors cursor-pointer opacity-0 group-hover:opacity-100 self-center"
                          title={t("common.delete_tooltip")}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </>
                )}

                {/* NextCloud files */}
                {files.length > 0 && localLinks.length > 0 && (
                  <div className="px-4 py-1.5 bg-blue-50 border-b border-blue-100 text-[10px] font-semibold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Cloud size={12} />
                    {t("nextcloud_files.nextcloud_files_header", { count: files.length })}
                  </div>
                )}
                {files.map((entry) => (
                  <button
                    key={entry.path}
                    onClick={() => handleEntryClick(entry)}
                    className="w-full grid grid-cols-[1fr_auto_32px] sm:grid-cols-[1fr_100px_80px_160px_32px] gap-2 px-4 py-2 hover:bg-white border-b border-slate-100 transition-colors text-left cursor-pointer group"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      {getFileIcon(entry)}
                      <span className="text-sm text-slate-700 truncate group-hover:text-blue-600 transition-colors">
                        {entry.name}
                      </span>
                      {!entry.isDirectory && (
                        <ExternalLink size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      )}
                    </span>
                    <span className="text-xs text-slate-400 text-right self-center">
                      {entry.isDirectory ? "-" : formatFileSize(entry.size)}
                    </span>
                    <span className="text-xs text-slate-400 self-center truncate">
                      {getFileType(entry, t)}
                    </span>
                    <span className="text-xs text-slate-400 text-right self-center">
                      {formatDate(entry.lastModified)}
                    </span>
                    <span></span>
                  </button>
                ))}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 bg-white border-t border-slate-200 text-xs text-slate-400 flex-shrink-0 flex items-center justify-between">
                <span>
                  {t("nextcloud_files.footer_summary", {
                    folders: files.filter((f) => f.isDirectory).length,
                    files: files.filter((f) => !f.isDirectory).length,
                  })}
                  {localLinks.length > 0 && t("nextcloud_files.footer_links", { count: localLinks.length })}
                </span>
                {loading && <Loader2 size={12} className="animate-spin text-slate-400" />}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Local link modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowLinkModal(false)}>
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md mx-4 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 rounded-lg">
                  <Monitor className="text-amber-500" size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">{t("nextcloud_files.add_local_link_title")}</h3>
                  <p className="text-xs text-slate-500">{t("nextcloud.link_local_hint")}</p>
                </div>
              </div>
              <button onClick={() => setShowLinkModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("nextcloud_files.display_name")}</label>
              <input
                type="text"
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
                placeholder={t("nextcloud.folder_placeholder")}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("nextcloud_files.local_path")}</label>
              <input
                type="text"
                value={linkPath}
                onChange={(e) => setLinkPath(e.target.value)}
                placeholder={t("nextcloud_files.local_path_placeholder")}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <p className="text-xs text-slate-400 mt-1">{t("nextcloud_files.local_path_hint")}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t("nextcloud_files.type")}</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setLinkType("file")}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                    linkType === "file"
                      ? "border-amber-400 bg-amber-50 text-amber-700 font-medium"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <File size={16} />
                  {t("nextcloud_files.file")}
                </button>
                <button
                  onClick={() => setLinkType("folder")}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                    linkType === "folder"
                      ? "border-amber-400 bg-amber-50 text-amber-700 font-medium"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Folder size={16} />
                  {t("nextcloud_files.folder")}
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowLinkModal(false)}
                className="flex-1 px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleAddLocalLink}
                disabled={!linkName.trim() || !linkPath.trim()}
                className="flex-1 px-4 py-2 text-sm text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-50 cursor-pointer font-medium"
              >
                {t("common.add")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
