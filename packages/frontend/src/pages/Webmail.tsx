import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "../lib/useIsMobile";
import {
  Mail, Trash2, Star, Archive, FolderOpen,
  RefreshCw, Settings, Eye, EyeOff, User,
  PenSquare, Reply, ReplyAll, Forward,
  ChevronLeft, ChevronRight, ChevronDown, X, Paperclip,
  FileText, FileImage, File,
  FolderInput, Plus, ExternalLink, Check, Search,
  Loader2,
  FolderKanban,
  ChevronsLeft, ChevronsRight,
  Users, Users2,
  AlertTriangle,
} from "lucide-react";
import { getActiveInstanceId, getActiveInstance } from "../lib/instances";
import { SaveToNasDialog } from "../components/SaveToNasDialog";
import { isInlineAttachment } from "../lib/attachment-utils";
import {
  readMailFolderCache as readMailFolderCacheIdb,
  persistMailFolderCache as persistMailFolderCacheIdb,
  deleteMailFolderCache as deleteMailFolderCacheIdb,
  migrateLocalStorageMailCache,
  readMailBody,
  persistMailBody,
  evictBodiesOlderThan,
  countCachedBodies,
  readAttachment,
  persistAttachment,
  evictAttachmentsOlderThan,
  evictAttachmentsFetchedBefore,
  deleteMailBody,
  deleteFolderBodies,
} from "../lib/mail-cache-db";
import { prefillBodies, syncNewBodies, type PrefillProgress } from "../lib/mail-body-prefill";
import {
  getMailCacheWindowDays,
  MAIL_CACHE_DEFAULT_DAYS, MAIL_CACHE_ALL_DAYS,
} from "../lib/mailCacheSettings";
import { getEmailProjectLinks, setEmailProjectLink, hydrateEmailProjectLinks } from "../lib/email-project-links";
import { matchProjectFromFolder } from "../lib/project-folder-match";
import { matchProjectFromMail } from "../lib/project-mail-match";
import { resolveProjectFolder, type MailSide } from "../lib/project-folder-resolve";
import { buildFolderProfiles, scoreFoldersFromHistory, historyConfidence } from "../lib/folder-profile-match";
import { SortToProjectDialog, type SortRowProposal, type SortMove } from "../components/SortToProjectDialog";
import { isDesktopApp } from "../lib/desktop";
import { hydrateSignatureOverrides } from "../lib/mailSignature";
import { setBadgeCount } from "../lib/badges";
import { useProjects } from "../lib/DataContext";
import { useTranslation } from "react-i18next";
import {
  type MailMessage,
  type SharedMailbox,
  folderMsgCache,
  getImapConfig,
  getImapConfigForShared,
  getSharedMailboxes,
  saveSharedMailboxes,
  buildQuery,
  ensureMailConfigPushed,
  invalidateMailConfigPush,
} from "../lib/webmail-prefetch";
import {
  formatSender, formatAddress, formatDate, getDateGroup,
  formatFullDate, textBodyToHtml,
} from "../lib/mail-format";
import type {
  MailMessageFull, MailFolder, ForwardedAttachment, ComposeState, SendPayload,
} from "../lib/mail-types";
import { shouldCountForBadge } from "../lib/mail-badge";
import { isSentContext } from "../lib/sent-detect";
import { getFolderIcon, getFolderIconColor } from "../lib/folder-icons";
import {
  trackLocalMarkRead, applyRecentReadOverlay, applyRecentReadOverlayToFolders,
} from "../lib/mail-markread";
import {
  getHiddenFolders,
  getSentFolderOverride, getTrashFolderOverride,
  hydrateFolderPrefs,
} from "../lib/folder-prefs";
import {
  clearPrimaryImapConfig, loadAccountOrder, saveAccountOrder, orderVaultAccounts,
  saveImapConfig,
} from "../lib/imap-config";
import { readMailFolderCache, persistMailFolderCache } from "../lib/mail-folder-cache-ls";
import {
  EMAIL_CATEGORIES, getCategoryMap, setCategoryForMessage,
  getRepliedMessages, markAsReplied, isReplied,
} from "../lib/mail-categories";
import MobileMailboxDropdown from "../components/mail/MobileMailboxDropdown";
import AddSharedMailboxDialog from "../components/mail/AddSharedMailboxDialog";
import CreateFolderModal from "../components/mail/CreateFolderModal";
import FolderTree from "../components/mail/FolderTree";
import ImapSetup from "../components/mail/ImapSetup";
import ReadingPane from "../components/mail/ReadingPane";
import FloatingMailWindow from "../components/mail/FloatingMailWindow";
import ComposeWindow from "../components/mail/ComposeWindow";

/* ─── Types ─── */

/**
 * Achtergrond-warmup: fetch headers voor alle folders die nog niet
 * recent in cache zitten. Concurrency-cap 5, niet-blocking. TTL 1u.
 *
 * Reserved for future inspection use (entire-folder-list audits):
 * getCachedFolderPaths from "../lib/mail-cache-db". Not imported here
 * to keep tsc --noEmit clean (noUnusedLocals).
 */
async function warmupAllFolders(
  instanceId: string,
  acct: string,
  folderPaths: string[],
  fetchOne: (folder: string) => Promise<void>,
  onProgress?: (done: number, total: number) => void,
  isUserBusy?: () => boolean,
  isCancelled?: () => boolean,
): Promise<void> {
  const STALE_TTL_MS = 60 * 60 * 1000;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const now = Date.now();
  const queue: string[] = [];
  for (const f of folderPaths) {
    const cached = await readMailFolderCacheIdb(instanceId, acct, f);
    if (!cached || now - cached.ts > STALE_TTL_MS) {
      queue.push(f);
    }
  }
  const total = queue.length;
  let done = 0;
  // total=0 → niets te warmen (alles vers in IDB): meld direct "klaar" zodat
  // de UI-chip niet blijft hangen op een koude render.
  onProgress?.(0, total);
  // Gun de gebruiker de eerste seconden: bodies/folder-opens die hij meteen na
  // het openen doet, moeten niet achter een warmup-fetch wachten.
  await sleep(2500);
  // Lagere concurrency (2 i.p.v. 5): minder gelijktijdige IMAP-ops betekent dat
  // een interactieve klik nooit ver achter de warmup-rij staat. De seriële
  // server-queue verwerkt ze toch één voor één; 5 parallel vulde alleen de rij.
  const concurrency = 2;
  for (let i = 0; i < queue.length; i += concurrency) {
    // Account-switch / unmount → stop deze warmup. Voorkomt dat de warmup van
    // een vorig account blijft doorlopen naast die van het nieuwe account
    // (dubbele IMAP-belasting op een gelimiteerde host → "Command failed").
    if (isCancelled?.()) return;
    // Pauzeer zolang de gebruiker actief klikt — zo concurreert de warmup niet
    // met het openen van mails / wisselen van mappen. Max ~30s wachten zodat de
    // warmup uiteindelijk toch doorloopt als de gebruiker blijft lezen.
    let waited = 0;
    while (isUserBusy?.() && waited < 30_000) {
      await sleep(500);
      waited += 500;
    }
    const batch = queue.slice(i, i + concurrency);
    await Promise.all(
      batch.map((f) =>
        fetchOne(f)
          .catch(() => {
            // single-folder fail mag warmup niet stoppen
          })
          .finally(() => {
            done++;
            onProgress?.(done, total);
          }),
      ),
    );
    // Spacing tussen batches: spreidt de IMAP-commando's over tijd zodat een
    // grote mappenboom (100+ mappen) de per-account rate-limit van de
    // mailserver niet triggert. Een burst liet Stalwart de verbinding resetten
    // (`read ECONNRESET`) → mail viel volledig uit. ~750ms/batch (concurrency 2)
    // = ~2-3 IMAP-ops/s; rustig genoeg, en de warmup blijft binnen ~1-2 min.
    if (i + concurrency < queue.length) await sleep(750);
  }
}

/* ─── Caches (persist across re-renders for speed) ─── */
// folderMsgCache lives in lib/webmail-prefetch.ts so the prefetch can warm
// it without dragging Webmail.tsx into App.tsx's main bundle.
const fullMsgCache = new Map<string, MailMessageFull>(); // key: folder:uid

/* ─── Helpers ─── */
// getImapConfig and buildQuery also live in lib/webmail-prefetch.ts.

// prefetchInbox lives in lib/webmail-prefetch.ts (with B04 stale-while-revalidate cache).

/** Determine if an attachment is an inline image (signature/logo) that should be hidden */

// `isInlineAttachment` is verplaatst naar lib/attachment-utils.ts en wordt
// daar geimport. Geen lokale dupe meer — Webmail én MailView delen dezelfde
// detectie-logica via MessageAttachments + die helper.

/* ─── Mobile detection hook ─── */


const PAGE_SIZE = 50;

// Toast-severity herkennen over NL/EN/DE heen (bug #1): niet alleen op het NL
// "mislukt" matchen — anders krijgt een mislukte actie onder EN/DE de neutrale/
// succes-styling (groene check) i.p.v. rood met kruis.
// Woorden komen uit de daadwerkelijke toast-strings in nl/en/de.json — bij een
// nieuwe fail-toast met andere formulering: hier toevoegen (of ooit alsnog naar
// een expliciete {text, kind}-toast-state, zie handoff-doc bug #1).
const TOAST_ERROR_RE = /mislukt|failed|fehlgeschlagen|fehler|kon niet|could not|konnte nicht|\bfout\b|\berror\b/i;
const TOAST_LOADING_RE = /\bwordt\b|bezig|being sent|sending|loading|\bwird\b/i;

/* ─── Main component ─── */

export default function Webmail() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [mobilePane, setMobilePane] = useState<"folders" | "list" | "message" | "compose">("list");
  const [config, setConfig] = useState(getImapConfig);
  const [showSetup, setShowSetup] = useState(!config.host || !config.user || (!config.pass && config.authMode !== "oauth2"));

  // Vault-backed email accounts
  const [vaultAccounts, setVaultAccounts] = useState<Array<{id: string; email: string; label: string}>>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  // Sleepbare volgorde van de account-tabs (Chrome-stijl). Per instance bewaard.
  const [accountOrder, setAccountOrder] = useState<string[]>(() => loadAccountOrder(getActiveInstanceId()));
  const dragAccountId = useRef<string | null>(null);
  const [vaultLoading, setVaultLoading] = useState(true);

  // Re-read config when active instance changes (Chinese wall between instances)
  const currentInstanceId = getActiveInstanceId();
  const prevInstanceRef = useRef(currentInstanceId);
  useEffect(() => {
    if (prevInstanceRef.current !== currentInstanceId) {
      prevInstanceRef.current = currentInstanceId;
      const fresh = getImapConfig();
      setConfig(fresh);
      setShowSetup(!fresh.host || !fresh.user || (!fresh.pass && fresh.authMode !== "oauth2"));
      invalidateMailConfigPush();
    }
  }, [currentInstanceId]);

  // Fetch email accounts from vault
  useEffect(() => {
    const instanceId = getActiveInstanceId();
    if (instanceId === "default") { setVaultLoading(false); return; }
    fetch(`/api/instances/${instanceId}/mail-accounts`, { credentials: "same-origin" })
      .then(r => r.json())
      .then(data => {
        const accounts = data.accounts || [];
        // Fase 3: zit de huidige primary (localStorage) al als vault-account in
        // de server-DB? Dan de localStorage-primary opruimen — één bron (vault),
        // geen schaduw-primary in platte browseropslag. (Veilig: de vault dekt
        // 'm; O365-primaries zonder vault-tegenhanger blijven ongemoeid.)
        const cfg = getImapConfig();
        if (cfg.user && accounts.some((a: { email: string }) => a.email?.toLowerCase() === cfg.user.toLowerCase())) {
          clearPrimaryImapConfig(instanceId);
          setConfig(getImapConfig());
        }
        setVaultAccounts(accounts);
        if (accounts.length > 0) {
          // Open het eerste account in de door de gebruiker gesleepte
          // tab-volgorde (Chrome-stijl: meest linkse tab = standaard geopend).
          // Zonder opgeslagen volgorde valt orderVaultAccounts terug op de
          // server-volgorde, dus dit verandert niets tot je tabs sleept.
          const ordered = orderVaultAccounts(accounts, loadAccountOrder(instanceId));
          setActiveAccountId(ordered[0].id);
          setShowSetup(false); // Vault has accounts, skip ImapSetup
        }
      })
      .catch(() => {})
      .finally(() => setVaultLoading(false));
  }, []);

  // Push the IMAP creds to the server-side mail-session cache whenever
  // the config changes (including on mount). Every /api/mail/* call
  // below awaits ensureMailConfigPushed() before firing, so the push
  // finishes before the first request that needs it. Invalidate first
  // so a freshly-saved config doesn't hit the memoized previous push.
  useEffect(() => {
    invalidateMailConfigPush();
    ensureMailConfigPushed();
  }, [config.host, config.user, config.pass, config.accessToken, config.authMode]);

  // ─── Shared mailbox state ───
  const [sharedMailboxes, setSharedMailboxes] = useState<SharedMailbox[]>(() =>
    getSharedMailboxes(getActiveInstanceId())
  );
  const [activeAcct, setActiveAcct] = useState<string | null>(null); // null = primary
  const [showAddShared, setShowAddShared] = useState(false);

  // Push config for shared mailboxes when primary config or shared list changes
  useEffect(() => {
    for (const sm of sharedMailboxes) {
      ensureMailConfigPushed(sm.email);
    }
  }, [sharedMailboxes, config.accessToken, config.pass]);

  // Helper: get the effective config for the active account
  const activeSharedMailbox = activeAcct ? sharedMailboxes.find(m => m.email === activeAcct) : null;
  const activeVaultAccount = activeAccountId ? vaultAccounts.find(a => a.id === activeAccountId) : null;
  // Bij een vault-account: primary-config als basis, maar met het vault-adres
  // als user. Anders sluiten de `if (!activeConfig.user)`-guards in
  // loadMessages/loadFolders zodra de localStorage-primary is opgeruimd (Fase 3)
  // → dan zou het vault-account niet meer laden. (De creds komen sowieso
  // server-side uit de vault via ?account=; de user hier is voor de guards + de
  // email= query-param, die de server negeert als account= aanwezig is.)
  const activeConfig = activeAcct
    ? getImapConfigForShared(activeAcct, activeSharedMailbox?.effectiveUser)
    : (activeVaultAccount ? { ...config, user: activeVaultAccount.email } : config);

  /** True zodra er ≥1 vault-account (eigen IMAP-login) voor deze instance is. */
  const useVault = vaultAccounts.length > 0;
  // Vault-accounts in de door de gebruiker gesleepte volgorde (voor de tabs).
  const orderedVaultAccounts = orderVaultAccounts(vaultAccounts, accountOrder);
  /** Verplaats account `fromId` naar de positie van `toId` (tab-slepen). */
  const reorderAccounts = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const ids = orderedVaultAccounts.map(a => a.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    setAccountOrder(ids);
    saveAccountOrder(getActiveInstanceId(), ids);
  };

  // Cache key prefix for per-account caches. Een vault-account (eigen login)
  // krijgt prefix `v:<id>`, een gedeeld postvak z'n email, primary = "".
  // activeAccountId en activeAcct zijn wederzijds exclusief (zie de switch-
  // functies), zodat elk account een eigen cache-namespace heeft — anders zou
  // account A de gecachte mail van account B tonen.
  const acctCachePrefix = activeAccountId ? `v:${activeAccountId}` : (activeAcct || "");

  // E-mailadres van het ACTIEVE account, voor o.a. de profiel-header in het
  // mappaneel: vault-account → z'n eigen email, gedeeld postvak → activeAcct,
  // anders de primary. (activeConfig.user valt voor een vault-account terug op
  // de primary, dus die kun je hier niet gebruiken.)
  const activeAccountEmail = activeVaultAccount?.email || activeAcct || activeConfig.user;

  /** Shorthand for buildQuery that auto-injects the active shared account.
   *  When vault accounts are active, also injects ?account=<id>. */
  const bq = useCallback((extra?: Record<string, string>) => {
    const vaultExtra = useVault && activeAccountId
      ? { ...extra, account: activeAccountId }
      : extra;
    // Voor shared mailboxen: stuur primary email mee zodat de server ERPNext
    // kan bevragen voor de primary creds en daarna user vervangt.
    return buildQuery(activeConfig, vaultExtra, activeAcct, activeAcct ? config.user : null);
  }, [activeConfig, activeAcct, useVault, activeAccountId, config.user]);
  // Stabiele referentie naar bq zodat de achtergrond-warmup-effect NIET opnieuw
  // hoeft te draaien telkens als bq een nieuwe identiteit krijgt (gebeurt bij elke
  // folder-badge update). Zonder dit herstartte de warmup constant en ramde hij
  // de falende systeemmappen telkens opnieuw.
  const bqRef = useRef(bq);
  bqRef.current = bq;
  // Guard: warm één keer per (account, aantal mappen) i.p.v. bij elke re-render.
  const warmedKeyRef = useRef<string>("");
  // Run-token: bij een account-wissel bumpt dit, zodat de warmup van het vorige
  // account zichzelf afbreekt (cancel-check in warmupAllFolders).
  const warmupRunRef = useRef(0);
  // True zodra de lijst-warmup klaar is. De body-pre-fill wacht hierop zodat
  // beide niet tegelijk de ene IMAP-verbinding verstoppen (anders blijft de
  // pre-fill achter de warmup-queue hangen → "lijkt gestopt").
  const warmupDoneRef = useRef(false);
  // Laatste interactieve actie (mail openen / map wisselen). De achtergrond-
  // warmup pauzeert zolang dit < ~4s geleden is, zodat hij niet om de IMAP-
  // verbinding concurreert terwijl de gebruiker door mails klikt.
  const lastUserActivityRef = useRef(0);

  const [folders, setFolders] = useState<MailFolder[]>([]);
  const [activeFolder, setActiveFolder] = useState("INBOX");
  // Synchroon-leesbare spiegel van activeFolder voor race-guards. Bij snel
  // klikken op meerdere folders zou een laat-aankomende fetch voor folder A
  // anders setMessages overschrijven nadat de user al naar folder B is.
  const activeFolderRef = useRef("INBOX");
  useEffect(() => { activeFolderRef.current = activeFolder; }, [activeFolder]);
  // Mirror van activeAcct voor race-guards in async cache-reads bij snel
  // wisselen van postvak (zie switchAccount).
  const activeAcctRef = useRef<string | null>(null);
  useEffect(() => { activeAcctRef.current = activeAcct; }, [activeAcct]);
  // Mirror van het actieve vault-account, voor race-guards bij snel switchen
  // (zelfde patroon als activeAcctRef).
  const activeAccountIdRef = useRef<string | null>(null);
  useEffect(() => { activeAccountIdRef.current = activeAccountId; }, [activeAccountId]);
  // Init synchroon uit de module-level in-memory cache (overleeft remount) zodat
  // terug-navigeren naar Mail de gecachte INBOX-lijst DIRECT bij de eerste render
  // toont i.p.v. eerst leeg te renderen en pas na de async IndexedDB-hydratie te
  // vullen (voelde als merkbare vertraging). Verse data laadt async bij en
  // overschrijft. Default-mount = primaire INBOX (geen acct-prefix).
  const [messages, setMessages] = useState<MailMessage[]>(() => {
    const mem = folderMsgCache.get("INBOX");
    return mem ? applyRecentReadOverlay(mem.messages, "INBOX") : [];
  });
  const [total, setTotal] = useState(() => folderMsgCache.get("INBOX")?.total ?? 0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(false);
  // Achtergrond-warmup voortgang voor de cache-chip in de header. null = niet
  // bezig / klaar; {done,total} terwijl mappen op de achtergrond gevuld worden.
  const [warmupProgress, setWarmupProgress] = useState<{ done: number; total: number } | null>(null);
  // Body-cache (inhoud) pre-fill voortgang + totaal lokaal gecachte mails.
  const [bodyCacheProgress, setBodyCacheProgress] = useState<PrefillProgress | null>(null);
  const [bodyCacheCount, setBodyCacheCount] = useState<number>(0);
  // True tijdens een lichte delta-sync (alleen nieuwe mail bijwerken) → eigen,
  // subtielere melding dan de volledige pre-fill.
  const [bodyCacheSyncing, setBodyCacheSyncing] = useState(false);
  // True als de pre-fill stopte omdat de browseropslag vol is → toon een
  // waarschuwing i.p.v. een misleidend "✓ gecached".
  const [bodyCacheQuotaFull, setBodyCacheQuotaFull] = useState(false);
  // Ingesteld cache-venster (dagen) voor de chip-tekst.
  const [cacheWindowDays, setCacheWindowDays] = useState<number>(() => {
    const id = getActiveInstanceId();
    return id && id !== "default" ? getMailCacheWindowDays(id, activeAccountEmail) : MAIL_CACHE_DEFAULT_DAYS;
  });
  // True zodra een mail/map-load > ~5s duurt → toont een "trage verbinding /
  // cache vult nog" waarschuwing zodat een lege/koude weergave niet als kapot voelt.
  const [slowLoading, setSlowLoading] = useState(false);
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [selectedMsg, setSelectedMsg] = useState<MailMessageFull | null>(null);
  const [loadingMsg, setLoadingMsg] = useState(false);
  // Floating mail windows — mails geopend via dubbelklik die bovenop de UI
  // blijven staan zodat je in het lees-paneel door kunt bladeren.
  const [floatingMails, setFloatingMails] = useState<Array<{ id: string; msg: MailMessageFull; folder: string }>>([]);
  const [error, setError] = useState("");
  const [compose, setCompose] = useState<ComposeState | null>(null);
  // Bug #3: een inline-concept kan naar een eigen (zwevend, sleepbaar) venster
  // ge-popout worden — dan rendert ComposeWindow niet-inline naast het
  // leespaneel. Reset naar inline bij elke nieuwe concept-opening.
  const [composeFloating, setComposeFloating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [categories, setCategories] = useState<Record<string, string>>(getCategoryMap);
  const [emailContextMenu, setEmailContextMenu] = useState<{ x: number; y: number; uid: number } | null>(null);
  const [mailSearch, setMailSearch] = useState("");
  const [searchSubfolders, setSearchSubfolders] = useState(false);
  const [subfolderMessages, setSubfolderMessages] = useState<MailMessage[]>([]);
  const [loadingSubfolders, setLoadingSubfolders] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    try {
      const key = `webmail_collapsed_${getActiveInstanceId()}_${activeFolder}`;
      const saved = localStorage.getItem(key);
      if (saved) return new Set(JSON.parse(saved));
    } catch { /* ignore parse errors */ }
    return new Set();
  });
  // B07: reload collapse state when folder changes
  useEffect(() => {
    try {
      const key = `webmail_collapsed_${getActiveInstanceId()}_${activeFolder}`;
      const saved = localStorage.getItem(key);
      setCollapsedGroups(saved ? new Set(JSON.parse(saved)) : new Set());
    } catch {
      setCollapsedGroups(new Set());
    }
  }, [activeFolder]);

  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [folderWidth, setFolderWidth] = useState(() => {
    const saved = localStorage.getItem("webmail_folder_width");
    return saved ? parseInt(saved) : 208;
  });
  const [folderCollapsed, setFolderCollapsed] = useState(() => {
    return localStorage.getItem("webmail_folder_collapsed") === "true";
  });
  const [listWidth, setListWidth] = useState(() => {
    const saved = localStorage.getItem("webmail_list_width");
    return saved ? parseInt(saved) : 320;
  });
  const folderResizing = useRef(false);
  const listResizing = useRef(false);
  const mailContainerRef = useRef<HTMLDivElement>(null);
  const preloaded = useRef(false);
  const [repliedMap, setRepliedMap] = useState<Record<string, { repliedAt: string; sentMessageId?: string }>>(getRepliedMessages);
  const [conversationMsgs, setConversationMsgs] = useState<MailMessageFull[]>([]);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [createFolderParent, setCreateFolderParent] = useState<string | null>(null);
  const allProjects = useProjects();

  // Hydrate email-project links from server bij Webmail-mount.
  // Server is bron van waarheid (cross-device); localStorage = sync fallback.
  useEffect(() => {
    hydrateEmailProjectLinks();
    // Handmatige handtekening-overrides (Instellingen → Email accounts).
    hydrateSignatureOverrides();
    // Idem voor favorite + hidden mail-folders. Server is bron van waarheid;
    // localStorage = sync fallback. Na hydrate hebben we de server-versie
    // in localStorage — FolderTree initialiseert state vanuit localStorage
    // bij mount, dus dit werkt voor eerstvolgende re-mount of folder-toggle.
    hydrateFolderPrefs();
  }, []);

  // Migreer bestaande localStorage mail-cache naar IndexedDB (idempotent).
  // Eenmalig bij mount; latere persists schrijven via dual-write naar beide.
  useEffect(() => {
    const instanceId = getActiveInstanceId();
    if (!instanceId || instanceId === "default") return;
    (async () => {
      try {
        const { migrated } = await migrateLocalStorageMailCache(instanceId, activeAcct || "");
        if (migrated > 0) console.log(`[mail-cache] migrated ${migrated} folders from localStorage`);
      } catch {
        // ignore
      }
    })();
  }, [activeAcct]);

  // Achtergrond-warmup van alle folders nadat folder-list geladen is.
  // Concurrency 5, 1u TTL. Niet-blocking: folder-open ervaart geen vertraging.
  useEffect(() => {
    if (folders.length === 0) return;
    const instanceId = getActiveInstanceId();
    if (!instanceId || instanceId === "default") return;
    // Eén warmup-run per (account, aantal mappen). Re-renders door badge-updates
    // (folders krijgt nieuwe identiteit) triggeren het effect wel, maar de guard
    // maakt het dan een no-op i.p.v. een volledige her-warmup.
    const warmKey = `${acctCachePrefix}:${folders.length}`;
    if (warmedKeyRef.current === warmKey) return;
    warmedKeyRef.current = warmKey;
    const warmRun = ++warmupRunRef.current; // bumpt bij account-wissel → oude warmup cancelt
    const bq = bqRef.current;
    const folderPaths = folders.map((f) => f.path);
    warmupAllFolders(
      instanceId,
      acctCachePrefix,
      folderPaths,
      async (folder) => {
        // Hergebruik exact dezelfde fetch-vorm als loadMessages (regel 4090):
        //   /api/mail/messages?<bq>  met folder + pageSize (page 1 default)
        // bq() injecteert imap-config, vault account, shared-mailbox primary.
        // bg=1: de server enqueuet deze warmup-fetch op lagere IMAP-prioriteit
        // zodat een interactieve map-wissel of mail-open er altijd vóór gaat.
        const res = await fetch(
          `/api/mail/messages?${bq({ folder, pageSize: String(PAGE_SIZE), bg: "1" })}`,
        );
        if (!res.ok) return;
        const text = await res.text();
        if (!text) return;
        const data = JSON.parse(text);
        if (data?.error) return;
        const msgs = data?.data?.messages || [];
        const tot = data?.data?.total || msgs.length;
        await persistMailFolderCacheIdb(instanceId, acctCachePrefix, folder, msgs, tot);
      },
      (done, tot) => {
        // tot=0 (niets te warmen) of done===tot (klaar) → chip verbergen.
        setWarmupProgress(tot > 0 && done < tot ? { done, total: tot } : null);
      },
      () => Date.now() - lastUserActivityRef.current < 4000,
      () => warmupRunRef.current !== warmRun, // cancel als er inmiddels een ander account actief is
    ).catch(() => {
      // entire-warmup fail mag de UI niet raken
    }).finally(() => {
      setWarmupProgress(null);
      warmupDoneRef.current = true; // body-pre-fill mag nu starten
    });
    // bq bewust NIET in deps — via bqRef gelezen zodat badge-updates de warmup
    // niet herstarten. De warmedKeyRef-guard dekt herhaalde runs af.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folders, activeAcct, activeAccountId]);

  // Trage-verbinding waarschuwing: als een map-/mail-load > 5s duurt, toon een
  // amber hint zodat een lege/koude weergave niet als "kapot" voelt. Reset zodra
  // er niets meer laadt.
  useEffect(() => {
    if (!loading && !loadingMsg) {
      setSlowLoading(false);
      return;
    }
    const timer = setTimeout(() => setSlowLoading(true), 5000);
    return () => clearTimeout(timer);
  }, [loading, loadingMsg]);

  // ─── Body-cache pre-fill (component 3) + rollende eviction (component 4) ───
  // Vult op de achtergrond de lokale body-cache met de mailinhoud van de
  // laatste N dagen (instelbaar, per apparaat) voor alle echte mappen, en
  // verwijdert bodies ouder dan het venster. Activity-aware: pauzeert terwijl
  // de gebruiker klikt. Eén run per (instance, acct, mappen, venster).
  const bodyPrefilledKeyRef = useRef<string>("");
  // Spiegel van folders zodat de pre-fill de paden leest zonder dat een
  // folder-badge-update (nieuwe `folders`-identiteit) het effect herstart.
  // Eerder brak dat de pre-fill: de cleanup zette cancelled=true en de re-run
  // werd door de guard geblokkeerd → de pre-fill viel na een paar mappen stil.
  const foldersRef = useRef(folders);
  foldersRef.current = folders;
  // Bump zodat de pre-fill herstart wanneer de cache-instelling wijzigt.
  const [cacheCfgVersion, setCacheCfgVersion] = useState(0);
  useEffect(() => {
    const h = () => {
      setCacheCfgVersion((v) => v + 1);
      const id = getActiveInstanceId();
      if (id && id !== "default") setCacheWindowDays(getMailCacheWindowDays(id, activeAccountEmail));
    };
    window.addEventListener("y-app:mail-cache-window-changed", h);
    return () => window.removeEventListener("y-app:mail-cache-window-changed", h);
  }, []);
  useEffect(() => {
    if (folders.length === 0) return;
    const instId = getActiveInstanceId();
    if (!instId || instId === "default") return;
    const acct = acctCachePrefix;
    const windowDays = getMailCacheWindowDays(instId, activeAccountEmail);
    // Deps op folders.LENGTH (stabiel bij badge-updates), niet de folders-array
    // zelf — anders herstart/cancelt elke badge-update de pre-fill.
    const runKey = `${instId}:${acct}:${folders.length}:${windowDays}:${cacheCfgVersion}`;
    if (bodyPrefilledKeyRef.current === runKey) return;
    bodyPrefilledKeyRef.current = runKey;

    let cancelled = false;
    const bq = bqRef.current;
    (async () => {
      // Rollende eviction: gooi bodies ouder dan het venster weg. Bijlages:
      // desktop cachet ze bewust duurzaam mee (venster, op maildatum); web
      // houdt ze lazy en ruimt ze 10 min na ophalen op (op fetch-ts) zodat de
      // browser-opslag klein blijft.
      if (windowDays > 0) {
        const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
        await evictBodiesOlderThan(instId, acct, cutoff);
        if (isDesktopApp()) {
          await evictAttachmentsOlderThan(instId, acct, cutoff);
        } else {
          await evictAttachmentsFetchedBefore(instId, acct, Date.now() - 10 * 60 * 1000);
        }
        // Vraag (eenmalig) persistente opslag aan zodat de browser de cache niet
        // onder schijfdruk wist — net als Outlooks OST die blijft staan.
        try { await navigator.storage?.persist?.(); } catch { /* ignore */ }
      }
      const initialCount = await countCachedBodies(instId, acct);
      if (!cancelled) setBodyCacheCount(initialCount);
      if (windowDays <= 0) { if (!cancelled) setBodyCacheProgress(null); return; } // cache uit
      // Niet opnieuw scannen/ophalen bij elke F5: sla de pre-fill over als de
      // cache recent (< 15 min) volledig is gevuld. De rollende eviction draaide
      // hierboven al. Zo blijft de cache na een reload gewoon staan i.p.v.
      // opnieuw te lijken downloaden. Na 15 min draait hij weer (nieuwe mail +
      // eviction). Key incl. windowDays zodat een instellingswijziging wél meteen
      // her-vult (cacheCfgVersion forceert dan toch een nieuwe run).
      // Key incl. mapaantal: verschijnt er een nieuwe map (bijv. nieuw project-
      // archief), dan verandert de key → de pre-fill draait weer i.p.v. tot 12u
      // over te slaan.
      const lastFillKey = `mail_cache_lastfill_${instId}_${acct}_${windowDays}_${folders.length}`;
      const PREFILL_REFRESH_MS = 12 * 60 * 60 * 1000; // 12u — vol opnieuw scannen is zelden nodig; nieuwe mail komt via delta-sync binnen
      if (Date.now() - (parseInt(localStorage.getItem(lastFillKey) || "0", 10)) < PREFILL_REFRESH_MS) {
        if (!cancelled) setBodyCacheProgress(null);
        return;
      }
      // Wacht tot de lijst-warmup klaar is (anders vechten beide om de ene IMAP-
      // verbinding en blijft de pre-fill achter de warmup-queue hangen). Max 3
      // min als vangnet zodat het sowieso start. Folder-lijsten leest de pre-fill
      // daarna instant uit IndexedDB die de warmup vulde.
      let waitedWarmup = 0;
      while (!warmupDoneRef.current && waitedWarmup < 180_000 && !cancelled) {
        await new Promise((r) => setTimeout(r, 1000));
        waitedWarmup += 1000;
      }
      if (cancelled) return;
      // Skip Trash/Junk/Drafts op specialUse (locale-onafhankelijk; de naam-
      // regex in de pre-fill blijft als fallback voor systeemmappen zonder
      // specialUse). Sent/projectmappen worden wél gecached.
      const SKIP_SPECIAL = new Set(["\\Trash", "\\Junk", "\\Drafts"]);
      if (!cancelled) setBodyCacheQuotaFull(false); // verse run → reset
      await prefillBodies({
        instanceId: instId,
        acct,
        folders: foldersRef.current.filter((f) => !SKIP_SPECIAL.has(f.specialUse || "")).map((f) => f.path),
        windowDays,
        // pageSize wordt door de pre-fill gekozen: 50 (warm-cache-hit, snel) als
        // basis, en alleen voor drukke mappen een diepere ophaal (tot 1000) voor
        // volledige 30-dagen-dekking.
        fetchListUrl: (folder, pageSize) => `/api/mail/messages?${bq({ folder, pageSize: String(pageSize), bg: "1" })}`,
        fetchBodiesUrl: (folder, uids) => `/api/mail/bodies?${bq({ folder, uids: uids.join(","), bg: "1" })}`,
        isUserBusy: () => Date.now() - lastUserActivityRef.current < 4000,
        onProgress: (p) => {
          if (cancelled) return;
          setBodyCacheProgress(p);
          // Teller vloeiend laten meelopen zodat je het zíet downloaden.
          if (p) setBodyCacheCount(initialCount + p.done);
        },
        onQuotaFull: () => { if (!cancelled) { setToast(t("webmail.cache_full_warning")); setBodyCacheQuotaFull(true); } },
        isCancelled: () => cancelled,
      });
      if (!cancelled) {
        localStorage.setItem(lastFillKey, String(Date.now())); // markeer "recent volledig gevuld"
        const finalCount = await countCachedBodies(instId, acct);
        setBodyCacheCount(finalCount);
        setBodyCacheProgress(null);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folders.length, activeAcct, activeAccountId, cacheCfgVersion]);

  // ─── Delta-sync: alleen WIJZIGINGEN bijhouden ───
  // Op het `mail-changed` push-event (nieuwe mail via IMAP IDLE) cachet dit
  // alleen de net-binnengekomen mail in INBOX + de actieve map — lichtgewicht,
  // met een eigen "bijwerken…"-melding. De volledige pre-fill draait daardoor
  // zelden (12u), de cache blijft toch vers.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let running = false;
    const run = async () => {
      if (running) return;
      const instId = getActiveInstanceId();
      if (!instId || instId === "default") return;
      const windowDays = getMailCacheWindowDays(instId, activeAccountEmail);
      if (windowDays <= 0) return;
      running = true;
      setBodyCacheSyncing(true);
      try {
        const bq = bqRef.current;
        const acct = acctCachePrefix;
        const targets = Array.from(new Set([activeFolderRef.current, "INBOX"]));
        const added = await syncNewBodies({
          instanceId: instId, acct, folders: targets, windowDays,
          fetchListUrl: (folder, pageSize) => `/api/mail/messages?${bq({ folder, pageSize: String(pageSize), bg: "1" })}`,
          fetchBodiesUrl: (folder, uids) => `/api/mail/bodies?${bq({ folder, uids: uids.join(","), bg: "1" })}`,
        });
        if (added > 0) setBodyCacheCount(await countCachedBodies(instId, acct));
      } catch { /* ignore */ }
      finally { running = false; setBodyCacheSyncing(false); }
    };
    const onChanged = () => { if (timer) clearTimeout(timer); timer = setTimeout(run, 2000); };
    window.addEventListener("y-app:mail-changed", onChanged);
    return () => { window.removeEventListener("y-app:mail-changed", onChanged); if (timer) clearTimeout(timer); };
  }, [activeAcct, activeAccountId]);

  // F05: Multi-select state
  const [selectedUids, setSelectedUids] = useState<Set<number>>(new Set());
  const lastClickedUid = useRef<number | null>(null);
  // §11: timer voor single-vs-double-click discriminatie op mail-rij.
  // Single click opent in preview-paneel, dubbelklik opent popout-tab.
  // Zonder timer rent openMessage altijd en zet loadingMsg=true → button
  // disabled → tweede klik registreert niet → onDoubleClick vuurt nooit.
  const mailClickTimer = useRef<number | null>(null);
  // Race-guard bij snel achter elkaar mails aanklikken: spiegelt de
  // laatst-aangeklikte uid. Een traag laad-resultaat (IDB of server) van een
  // eerdere klik mag de huidige selectie NIET overschrijven — anders zie je
  // ineens een mail die je allang niet meer wilde zien.
  const selectedUidRef = useRef<number | null>(null);
  const [showBulkMoveDropdown, setShowBulkMoveDropdown] = useState(false);
  const [bulkMoveSearch, setBulkMoveSearch] = useState("");
  const bulkMoveDropdownRef = useRef<HTMLDivElement>(null);
  // "Sorteer in projectmap": per-mail folder-voorstel + reviewscherm.
  const [showSortModal, setShowSortModal] = useState(false);
  const [sortProposals, setSortProposals] = useState<SortRowProposal[]>([]);

  // Hydrate de initial-active folder (default INBOX) uit de generieke
  // per-folder localStorage-cache. 5 min TTL — server-fetch komt direct
  // erna en overschrijft als nodig (stale-while-revalidate). Apply de
  // TTL-Set-overlay (alleen UIDs die in de laatste 60 s lokaal gemarkeerd
  // zijn worden geforceerd op seen=true om IMAP \Seen STORE-race te
  // overbruggen). Andere mails: vertrouw localStorage (= server-truth).
  useEffect(() => {
    (async () => {
      try {
        const cached = (await readMailFolderCacheIdb(getActiveInstanceId(), "", "INBOX"))
          || readMailFolderCache(getActiveInstanceId(), "", "INBOX"); // fallback localStorage
        if (cached && cached.ts && Date.now() - cached.ts < 5 * 60 * 1000) {
          setMessages(applyRecentReadOverlay(cached.messages, "INBOX"));
          setTotal(cached.total);
        }
      } catch { /* ignore */ }
    })();
  }, []); // run once on mount

  // B04: Hydrate folder list from localStorage cache
  useEffect(() => {
    try {
      const cached = localStorage.getItem(`webmail_folders_${getActiveInstanceId()}`);
      if (cached) {
        const data = JSON.parse(cached);
        if (data.ts && Date.now() - data.ts < 10 * 60 * 1000) { // 10 min TTL
          setFolders(data.folders);
        }
      }
    } catch { /* ignore */ }
  }, []);

  // §1: Persist folders to localStorage on EVERY state change. Eerder werd
  // alleen na een verse fetch opgeslagen, waardoor optimistische unseen-
  // decrements (uit openMessage / handleMarkRead / handleMarkUnread) niet
  // bewaard bleven na reload — badge sprong terug op de oude unseen-count.
  // De key MOET dezelfde zijn als gebruikt in loadFolders voor shared
  // mailboxen, anders gaat de save naar een ander bucket dan het laden.
  useEffect(() => {
    if (folders.length === 0) return;
    try {
      const cacheKey = acctCachePrefix
        ? `webmail_folders_${getActiveInstanceId()}_${acctCachePrefix}`
        : `webmail_folders_${getActiveInstanceId()}`;
      localStorage.setItem(cacheKey, JSON.stringify({ folders, ts: Date.now() }));
    } catch { /* quota — ignore */ }
  }, [folders, acctCachePrefix]);

  // Auto-hide toast after 4 seconds (longer for send feedback)
  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }
  }, [toast]);

  // Close email context menu on click
  useEffect(() => {
    if (!emailContextMenu) return;
    const close = () => setEmailContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [emailContextMenu]);

  // F05: Close bulk move dropdown on click OUTSIDE the dropdown itself.
  // Eerdere implementatie luisterde op window-click — die ving de toggle-
  // button-click óók op (bubbeling), waardoor de dropdown nooit opende
  // (open + sluit in dezelfde tick).
  useEffect(() => {
    if (!showBulkMoveDropdown) return;
    const close = (e: MouseEvent) => {
      if (bulkMoveDropdownRef.current && !bulkMoveDropdownRef.current.contains(e.target as Node)) {
        setShowBulkMoveDropdown(false);
        setBulkMoveSearch("");
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showBulkMoveDropdown]);

  const isConfigured = config.host && config.user && (config.pass || config.authMode === "oauth2");

  // F07: Get subfolders of the current active folder
  const getSubfolderPaths = useCallback((): string[] => {
    // Use the delimiter from the active folder's data (or any folder that has one)
    const activeF = folders.find(f => f.path === activeFolder);
    const delimiter = activeF?.delimiter || folders.find(f => f.delimiter)?.delimiter || ".";
    const prefix = activeFolder + delimiter;
    return folders
      .filter(f => f.path !== activeFolder && f.path.startsWith(prefix))
      .map(f => f.path);
  }, [folders, activeFolder]);

  // F07: Load messages from subfolders when toggle is active
  // Filtering by mailSearch happens in the useMemo below, not here
  useEffect(() => {
    if (!searchSubfolders || !activeConfig.user) {
      setSubfolderMessages([]);
      return;
    }
    const subPaths = getSubfolderPaths();
    if (subPaths.length === 0) { setSubfolderMessages([]); return; }

    let cancelled = false;
    setLoadingSubfolders(true);

    (async () => {
      await ensureMailConfigPushed(activeAcct);
      const allMsgs: MailMessage[] = [];
      for (const folder of subPaths) {
        const cached = folderMsgCache.get(folder);
        if (cached) {
          allMsgs.push(...cached.messages.map(m => ({ ...m, _folder: folder })));
          continue;
        }
        try {
          const res = await fetch(`/api/mail/messages?${bq({ folder, pageSize: String(PAGE_SIZE) })}`);
          const text = await res.text();
          if (!text || cancelled) continue;
          const data = JSON.parse(text);
          if (data.data?.messages) {
            const msgs = data.data.messages as MailMessage[];
            folderMsgCache.set(folder, { messages: msgs, total: data.data.total || msgs.length, ts: Date.now() });
            allMsgs.push(...msgs.map(m => ({ ...m, _folder: folder })));
          }
        } catch { /* skip unreachable subfolders */ }
      }
      if (!cancelled) {
        setSubfolderMessages(allMsgs);
        setLoadingSubfolders(false);
      }
    })();

    return () => { cancelled = true; };
  }, [searchSubfolders, activeFolder, config, getSubfolderPaths]);

  // Filtered messages based on search + unread filter (+ subfolder results for F07)
  const filteredMessages = useMemo(() => {
    // De datumgroepering (getDateGroup) verwacht een aflopend gesorteerde lijst:
    // ze zet een groepskop zodra het label wisselt t.o.v. de vorige rij. Zit een
    // mail out-of-order (bv. na een move: de verplaatste mail krijgt een nieuwe,
    // hoogste UID maar een oude datum en komt zo bovenaan de UID-gesorteerde
    // server-respons; of bij subfolder-search die twee lijsten concat), dan
    // zouden dezelfde groepskoppen dubbel verschijnen. Sorteer daarom expliciet
    // op datum aflopend voordat we renderen.
    const byDateDesc = (a: MailMessage, b: MailMessage) =>
      new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
    let filtered = messages;
    if (showUnreadOnly) filtered = filtered.filter(m => !m.seen);
    if (!mailSearch.trim()) return filtered.slice().sort(byDateDesc);
    const q = mailSearch.toLowerCase();
    const matchFn = (msg: MailMessage) => {
      const sender = msg.from?.[0];
      const senderStr = sender ? `${sender.name} ${sender.address}`.toLowerCase() : "";
      const subject = (msg.subject || "").toLowerCase();
      const toStr = msg.to?.map(t => `${t.name} ${t.address}`).join(" ").toLowerCase() || "";
      return senderStr.includes(q) || subject.includes(q) || toStr.includes(q);
    };
    const results = filtered.filter(matchFn);
    if (searchSubfolders && subfolderMessages.length > 0) {
      const subResults = subfolderMessages.filter(matchFn);
      const merged = showUnreadOnly
        ? [...results, ...subResults.filter(m => !m.seen)]
        : [...results, ...subResults];
      return merged.sort(byDateDesc);
    }
    return results.sort(byDateDesc);
  }, [messages, mailSearch, showUnreadOnly, searchSubfolders, subfolderMessages]);

  // Unread count for current folder
  const unreadCount = useMemo(() => messages.filter(m => !m.seen).length, [messages]);

  // Folder + list pane resize handler
  const folderWidthRef = useRef(folderWidth);
  const listWidthRef = useRef(listWidth);
  folderWidthRef.current = folderWidth;
  listWidthRef.current = listWidth;

  useEffect(() => {
    const endResize = () => {
      if (folderResizing.current) {
        folderResizing.current = false;
        localStorage.setItem("webmail_folder_width", String(folderWidthRef.current));
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
      if (listResizing.current) {
        listResizing.current = false;
        localStorage.setItem("webmail_list_width", String(listWidthRef.current));
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      // If no resize is active, or the primary button has been released
      // (e.g. mouseup consumed by an HTML5 drag-and-drop elsewhere), bail.
      if (!folderResizing.current && !listResizing.current) return;
      if ((e.buttons & 1) === 0) { endResize(); return; }
      const containerLeft = mailContainerRef.current?.getBoundingClientRect().left ?? 0;
      if (folderResizing.current) {
        const newWidth = Math.max(140, Math.min(400, e.clientX - containerLeft));
        setFolderWidth(newWidth);
      }
      if (listResizing.current) {
        const currentFolderW = folderCollapsed ? 48 : folderWidthRef.current;
        const listLeft = containerLeft + currentFolderW;
        const newWidth = Math.max(200, Math.min(700, e.clientX - listLeft));
        setListWidth(newWidth);
      }
    };
    // HTML5 drag starting anywhere (mail drag to folder) aborts any splitter drag.
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", endResize);
    window.addEventListener("dragstart", endResize, true);
    window.addEventListener("blur", endResize);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", endResize);
      window.removeEventListener("dragstart", endResize, true);
      window.removeEventListener("blur", endResize);
    };
  }, [folderCollapsed]);

  const loadFolders = useCallback(async () => {
    if (!activeConfig.user) return;
    try {
      await ensureMailConfigPushed(activeAcct);
      const res = await fetch(`/api/mail/folders?${bq()}`);
      const text = await res.text();
      if (!text) return;
      const data = JSON.parse(text);
      if (data.data) {
        // Merge fresh server folders met de bestaande state. Enige uitzondering:
        // wanneer fresh.unseen=null (server kent count nog niet, A4-fix:
        // fetchFolders doet client.list() zonder statusQuery, counts komen
        // async via refreshFolderCountsAsync) bewaren we local zodat de UI
        // niet leeg gaat staan tussen de listfetch en de async status-update.
        //
        // Voor ALLE andere gevallen: vertrouw server. Eerder logica was
        // "local <= fresh → preserve local" voor optimistic mark-read race-
        // protection, maar die preserveerde ook wanneer fresh hoger was door
        // NIEUWE ongelezen mails (bv. IMAP IDLE arrival of mark-as-unread vanuit
        // andere client). Gevolg: badge bleef stuck op oud cijfer (4) terwijl
        // server al 7 zei. Optimistic decrement in openMessage werkt nog steeds
        // binnen dezelfde render — pas bij de volgende fresh-fetch wint server.
        setFolders((prev) => {
          let merged: MailFolder[];
          if (prev.length === 0) {
            merged = data.data;
          } else {
            const prevByPath = new Map(prev.map((f: MailFolder) => [f.path, f]));
            merged = data.data.map((fresh: MailFolder) => {
              if (fresh.unseen !== null && fresh.unseen !== undefined) return fresh;
              const local = prevByPath.get(fresh.path);
              return local ? { ...fresh, unseen: local.unseen ?? null } : fresh;
            });
          }
          // TTL-Set correctie: server-folder.unseen min recent lokaal-
          // gemarkeerde uids waarvan \Seen STORE nog niet door is. Zonder
          // dit zegt sidebar-badge 7 terwijl panel-header 5 toont (mismatch).
          return applyRecentReadOverlayToFolders(merged);
        });
        // Sidebar "Email" badge is derived from `folders` via the
        // useEffect below — no need to setBadgeCount here. That keeps
        // a single source of truth so optimistic decrements (open
        // message, mark read) stay in sync without scattered calls.
        // localStorage-persist gebeurt automatisch via de useEffect die
        // op `folders` state-changes hangt; daar wordt de merged state
        // opgeslagen i.p.v. de raw fresh-data (anders verlies je weer
        // de optimistic unseen-decrement).
      }
    } catch (err) { console.error("[Webmail] loadFolders error:", err); }
  }, [activeConfig, activeAcct, bq]);

  // Single source of truth for the sidebar Email badge: total unseen
  // restricted to INBOX-tree. Sent/Drafts/Trash/Junk/Archive are
  // excluded by SPECIAL-USE flag with name-based fallback for IMAP
  // servers that don't advertise SPECIAL-USE.
  useEffect(() => {
    const total = folders
      .filter(shouldCountForBadge)
      .reduce((sum, f) => sum + (f.unseen || 0), 0);
    setBadgeCount("webmail", total);
  }, [folders]);

  const loadMessages = useCallback(async (folder?: string, force = false, page = 1) => {
    if (!activeConfig.user) return;
    const f = folder || activeFolder;

    // Use cache if available and fresh (< 30s) — only for page 1
    const cacheKey = acctCachePrefix ? `${acctCachePrefix}:${f}` : f;
    if (!force && page === 1) {
      const cached = folderMsgCache.get(cacheKey);
      if (cached && Date.now() - cached.ts < 30_000) {
        setMessages(cached.messages);
        setTotal(cached.total);
        return;
      }
    }

    if (page === 1) { setLoading(true); } else { setLoadingMore(true); }
    setError("");
    try {
      await ensureMailConfigPushed(activeAcct);
      const res = await fetch(`/api/mail/messages?${bq({ folder: f, pageSize: String(PAGE_SIZE), page: String(page) })}`);
      // Race-guard: als de user inmiddels naar een andere folder is geklikt,
      // gooi dit resultaat weg. Alleen relevant voor page-1 (load-more is
      // per definitie binnen dezelfde folder).
      if (page === 1 && f !== activeFolderRef.current) {
        setLoading(false);
        setLoadingMore(false);
        return;
      }
      const text = await res.text();
      if (!text) { setError(t("webmail.empty_server_response")); if (page === 1) setMessages([]); setLoading(false); setLoadingMore(false); return; }
      const data = JSON.parse(text);
      if (data.error) {
        setError(data.detail ? `${data.error}\n${data.detail}` : data.error); if (page === 1) setMessages([]);
      } else {
        const msgs = data.data?.messages || [];
        const tot = data.data?.total || 0;
        // TTL-Set-overlay: alleen UIDs die in de laatste 60 s lokaal als
        // gelezen gemarkeerd zijn → forceer seen=true. Vertrouw server voor
        // alle andere mails (externe mark-as-unread, oude reads, nieuwe
        // arrivals). localStorage krijgt RAW server-msgs zodat F5 of cross-
        // client mark-as-unread direct correct werken.
        let displayMsgs: MailMessage[] = msgs;
        if (page === 1) {
          displayMsgs = applyRecentReadOverlay(msgs, f);
          setMessages(displayMsgs);
        } else {
          setMessages(prev => [...prev, ...msgs]);
        }
        setTotal(tot);
        const allMsgs = page === 1 ? displayMsgs : [...(folderMsgCache.get(cacheKey)?.messages || []), ...msgs];
        folderMsgCache.set(cacheKey, { messages: allMsgs, total: tot, ts: Date.now() });
        if (page === 1) {
          persistMailFolderCacheIdb(getActiveInstanceId(), acctCachePrefix, f, msgs, tot);
          persistMailFolderCache(getActiveInstanceId(), acctCachePrefix, f, msgs, tot); // dual-write voor rollback
        }
      }
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [activeConfig, activeAcct, activeFolder, acctCachePrefix, bq]);

  // Auto-load config from ERPNext, then preload mail
  // Background send handler — compose window closes immediately
  const handleBackgroundSend = useCallback(async (payload: SendPayload) => {
    // Extract and remove reply tracking fields (not sent to server)
    const replyToUid = payload._replyToUid;
    const replyToFolder = payload._replyToFolder;
    // `account` (vault-id) zit niet via bq() in de body — send gebruikt geen
    // querystring. Expliciet meesturen zodat de server met dít account z'n
    // eigen creds verstuurt (juiste From + SMTP-auth).
    const serverPayload = {
      ...payload,
      acct: activeAcct || undefined,
      account: useVault && activeAccountId ? activeAccountId : undefined,
      // Expliciete Verzonden-map (leeg → server doet auto-detectie).
      sentFolder: getSentFolderOverride(activeAccountEmail) || undefined,
    };
    delete serverPayload._replyToUid;
    delete serverPayload._replyToFolder;

    setToast(t("webmail.message_sending"));
    try {
      await ensureMailConfigPushed(activeAcct);
      const res = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serverPayload),
      });
      const text = await res.text();
      let sentMessageId: string | undefined;
      let sentSaved: boolean | null | undefined;
      if (text) {
        let data: { ok?: boolean; error?: string; messageId?: string; sentSaved?: boolean | null; sentFolder?: string };
        try { data = JSON.parse(text); } catch { throw new Error(`Server error (${res.status})`); }
        if (data.error) throw new Error(data.error);
        sentMessageId = data.messageId;
        sentSaved = data.sentSaved;
      } else if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      // Track reply in localStorage
      if (replyToUid && replyToFolder) {
        markAsReplied(replyToFolder, replyToUid, sentMessageId);
        setRepliedMap(getRepliedMessages());
      }

      // Verzonden, maar de IMAP-kopie naar de Verzonden-map faalde of geen map
      // gevonden → niet stil houden zodat de gebruiker het weet (en evt. de
      // Verzonden-map kan instellen via het mappen-contextmenu).
      setToast(sentSaved === false
        ? t("webmail.sent_not_saved", { defaultValue: "Verzonden, maar niet in de Verzonden-map opgeslagen" })
        : t("webmail.message_sent"));
      loadMessages(undefined, true);
    } catch (err) {
      setToast(t("webmail.send_failed", { message: (err as Error).message }));
    }
  }, [loadMessages]);

  // Server handles token refresh — frontend just sends instance + email
  const autoLoaded = useRef(false);
  useEffect(() => {
    if (autoLoaded.current) return;
    autoLoaded.current = true;

    const instanceId = getActiveInstanceId();

    (async () => {
      let finalConfig = config;

      if (!isConfigured) {
        // Not configured — try auto-config with employee email
        const defaultEmployee = localStorage.getItem(`pref_${instanceId}_employee`) || "";
        let email = "";
        try {
          const empResp = await fetch(`/api/resource/Employee?fields=${encodeURIComponent(JSON.stringify(["name","company_email","user_id"]))}&limit_page_length=50`, { credentials: "same-origin" });
          const empData = await empResp.json();
          const employees = empData?.data || [];
          if (defaultEmployee) {
            const emp = employees.find((e: any) => e.name === defaultEmployee);
            email = emp?.company_email || emp?.user_id || "";
          }
          if (!email && employees.length > 0) {
            const withEmail = employees.find((e: any) => e.company_email);
            email = withEmail?.company_email || employees[0]?.user_id || "";
          }
        } catch { /* ignore */ }

        if (email) {
          try {
            const res = await fetch(`/api/mail/auto-config?email=${encodeURIComponent(email)}`, { credentials: "same-origin" });
            if (res.ok) {
              const { data } = await res.json();
              if (data?.host) {
                finalConfig = {
                  host: data.host, port: String(data.port || 993), user: data.user || email,
                  pass: data.pass || "", secure: data.secure !== false,
                  authMode: data.authMode || "password",
                  accessToken: data.accessToken, refreshToken: data.refreshToken,
                  clientId: data.clientId, clientSecret: data.clientSecret, tokenUri: data.tokenUri,
                  smtpHost: data.smtpHost, smtpPort: String(data.smtpPort || 587), smtpSecure: data.smtpSecure || false,
                };
                saveImapConfig(finalConfig);
                if (data.signature) localStorage.setItem(`pref_${instanceId}_email_signature`, data.signature);
                setConfig(finalConfig);
                setShowSetup(false);
              }
            }
          } catch { /* ignore */ }
        }
      }

      // Preload mail — server resolves credentials from instance + email
      const ready = finalConfig.host && finalConfig.user;
      if (!ready || preloaded.current) return;
      preloaded.current = true;

      // finalConfig was just saved to localStorage; make sure the server
      // session cache sees the fresh values before the parallel fetches.
      invalidateMailConfigPush();
      await ensureMailConfigPushed(activeAcct);

      const q = buildQuery(finalConfig);

      // Load folders + messages in parallel for speed
      setLoading(true);
      const [foldersPromise, messagesPromise] = [
        fetch(`/api/mail/folders?${q}`).then(r => r.text()).then(t => t ? JSON.parse(t) : null).catch(() => null),
        fetch(`/api/mail/messages?${q}&folder=INBOX&pageSize=${PAGE_SIZE}`).then(r => r.text()).then(t => t ? JSON.parse(t) : null).catch(() => null),
      ];

      const [fData, mData] = await Promise.all([foldersPromise, messagesPromise]);

      // Als er inmiddels een vault-account actief is geworden (de vault-fetch
      // resolvet async en zet activeAccountId), NIET deze primary-preload tonen.
      // De reload-useEffect laadt dan het juiste vault-account; zonder deze guard
      // kan een trage primary-fetch het vault-resultaat overschrijven.
      if (activeAccountIdRef.current) { setLoading(false); return; }

      if (fData?.data) {
        // Trust server voor unseen-counts. Enige uitzondering: fresh.unseen=null
        // (A4-fix: fetchFolders doet eerst client.list() zonder statusQuery,
        // counts komen async via refreshFolderCountsAsync). In dat geval
        // behouden we local zodat de UI niet kort leeg gaat tot de status-
        // update binnenkomt. Optimistic mark-read decrement blijft binnen
        // dezelfde render werken; pas bij volgende fresh fetch wint server.
        setFolders((prev) => {
          let merged: MailFolder[];
          if (prev.length === 0) {
            merged = fData.data;
          } else {
            const prevByPath = new Map(prev.map((f: MailFolder) => [f.path, f]));
            merged = fData.data.map((fresh: MailFolder) => {
              if (fresh.unseen !== null && fresh.unseen !== undefined) return fresh;
              const local = prevByPath.get(fresh.path);
              return local ? { ...fresh, unseen: local.unseen ?? null } : fresh;
            });
          }
          return applyRecentReadOverlayToFolders(merged);
        });
      }
      if (mData?.error) {
        setError(mData.detail ? `${mData.error}\n${mData.detail}` : mData.error);
      } else if (mData?.data) {
        const msgs = mData.data.messages || [];
        const tot = mData.data.total || 0;
        // Apply TTL-Set-overlay zodat in laatste 60 s lokaal gemarkeerde
        // uids seen=true blijven (anti-race tegen \Seen STORE-propagatie).
        const displayMsgs = applyRecentReadOverlay(msgs, "INBOX");
        setMessages(displayMsgs);
        setTotal(tot);
        folderMsgCache.set("INBOX", { messages: displayMsgs, total: tot, ts: Date.now() });
        persistMailFolderCacheIdb(instanceId, "", "INBOX", msgs, tot);
        persistMailFolderCache(instanceId, "", "INBOX", msgs, tot); // dual-write voor rollback
      }
      setLoading(false);
    })();
  }, []);

  // Reload folders + messages when the active account changes — zowel een
  // gedeeld postvak (activeAcct) als een vault-account (activeAccountId).
  const prevAcct = useRef(activeAcct);
  const prevAccountId = useRef(activeAccountId);
  useEffect(() => {
    if (prevAcct.current === activeAcct && prevAccountId.current === activeAccountId) return;
    prevAcct.current = activeAcct;
    prevAccountId.current = activeAccountId;
    loadFolders();
    loadMessages("INBOX", true);
  }, [activeAcct, activeAccountId, loadFolders, loadMessages]);

  // Auto-refresh bij IMAP IDLE push-event. Zonder dit zou de mail-lijst pas
  // bij F5 of folder-switch nieuwe mails tonen, terwijl folder.unseen-badge
  // wel direct stijgt via /unseen-summary. Resultaat: badge=4 maar lijst=1
  // ongelezen, verwarrend. Refresh huidige folder + folders-counts.
  useEffect(() => {
    const onMailChanged = () => {
      loadFolders();
      loadMessages(activeFolder, true);
    };
    window.addEventListener("y-app:mail-changed", onMailChanged);
    return () => window.removeEventListener("y-app:mail-changed", onMailChanged);
  }, [activeFolder, loadFolders, loadMessages]);

  // Keep-alive re-activation: Webmail stays mounted while the user is on other
  // pages (see KeepAliveWebmail in App.tsx). When they return to Mail this
  // event fires so the saved view is verified against the server. Silent —
  // loadMessages(...,true) refetches in place without blanking the list
  // (the loading skeleton only shows when messages.length === 0).
  useEffect(() => {
    const onActivated = () => {
      loadFolders();
      loadMessages(activeFolder, true);
    };
    window.addEventListener("y-app:webmail-activated", onActivated);
    return () => window.removeEventListener("y-app:webmail-activated", onActivated);
  }, [activeFolder, loadFolders, loadMessages]);

  // Desktop popout-fout: op de desktop dispatcht popoutMail een CustomEvent
  // (y-app:open-popout) naar de Tauri-laag, die een echt nieuw venster maakt.
  // Faalt dat (ontbrekende capability, geblokkeerde webview, …), dan meldt de
  // desktop-laag het via y-app:popout-error terug — zonder dit zou het venster
  // 100% stil falen. Web gebruikt window.open en raakt dit pad nooit.
  useEffect(() => {
    const onPopoutError = (e: Event) => {
      const msg = (e as CustomEvent).detail?.message as string | undefined;
      setToast(t("webmail.popout_failed", { error: msg || "?" }));
    };
    window.addEventListener("y-app:popout-error", onPopoutError);
    return () => window.removeEventListener("y-app:popout-error", onPopoutError);
  }, [t]);

  // Deep-link: /webmail?msg=<uid>&folder=<path>&acct=<email>
  // Set by the double-click handler in the message list to open a mail in
  // a real new browser tab. We run the switch ONCE on mount; the message
  // is opened from cache if available, otherwise after the folder loads.
  const deeplinkHandled = useRef(false);
  useEffect(() => {
    if (deeplinkHandled.current) return;
    const url = new URL(window.location.href);
    const uidParam = url.searchParams.get("msg");
    const folderParam = url.searchParams.get("folder");
    const acctParam = url.searchParams.get("acct");
    if (!uidParam) return;
    deeplinkHandled.current = true;

    const uid = parseInt(uidParam, 10);
    if (Number.isNaN(uid)) return;

    // Switch shared mailbox first if needed
    if (acctParam && acctParam !== activeAcct) {
      setActiveAcct(acctParam);
    }
    // Switch folder if needed
    if (folderParam && folderParam !== activeFolder) {
      setActiveFolder(folderParam);
    }

    // Try to open from the in-memory cache; if the folder hasn't loaded
    // yet, retry briefly. After ~3s give up silently — the user can still
    // click the message manually.
    let attempts = 0;
    const tryOpen = () => {
      attempts++;
      const targetFolder = folderParam || activeFolder;
      // bug #5: cache-key moet account-bewust zijn (zoals loadMessages), anders
      // mist de lookup voor gedeelde/vault-mailboxen. (Dit ?msg=-pad wordt nu
      // niet meer geproduceerd — dubbelklik opent /mail/view — maar klopt zo
      // wél mocht het herleven.)
      const targetKey = acctCachePrefix ? `${acctCachePrefix}:${targetFolder}` : targetFolder;
      const cached = folderMsgCache.get(targetKey);
      const found = cached?.messages.find((m) => m.uid === uid);
      if (found) {
        openMessage(found);
        return;
      }
      if (attempts < 15) setTimeout(tryOpen, 200);
    };
    setTimeout(tryOpen, 200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The floating-mail subsystem (FloatingMailWindow component + floatingMails
  // state) is no longer reachable: message-list double-click now opens a
  // real new browser tab via window.open() per the user's request ("echt
  // los, geen hover in het scherm"). The window-component definition stays
  // until a future cleanup removes the FloatingMailWindow JSX too.
  function closeFloatingMail(id: string) {
    setFloatingMails(prev => prev.filter(f => f.id !== id));
  }

  // Genamespacede in-memory body-cache-key (per instance+acct, anders kan een
  // gelijke folder+uid in een andere mailbox de verkeerde body serveren).
  const fmKey = useCallback(
    (folder: string, uid: number) => `${getActiveInstanceId() || "default"}::${acctCachePrefix}::${folder}:${uid}`,
    [acctCachePrefix],
  );

  // Mark-read coalescer (#13): bodies uit de cache markeren we los read op de
  // server. Bij snel triëren van veel net-gesyncte ongelezen mail zou dat een
  // burst losse POSTs geven; we verzamelen ze 400ms en sturen ze dan serieel.
  const markReadQueueRef = useRef<Array<{ folder: string; uid: number }>>([]);
  const markReadTimerRef = useRef<number | null>(null);
  const flushMarkRead = useCallback(async () => {
    const q = markReadQueueRef.current;
    markReadQueueRef.current = [];
    for (const { folder, uid } of q) {
      try {
        await ensureMailConfigPushed(activeAcct);
        await fetch(`/api/mail/mark-read?${bq({ folder, uid: String(uid) })}`, { method: "POST" });
      } catch { /* best-effort */ }
    }
  }, [activeAcct, bq]);
  const markReadCoalesced = useCallback((folder: string, uid: number) => {
    markReadQueueRef.current.push({ folder, uid });
    if (markReadTimerRef.current) window.clearTimeout(markReadTimerRef.current);
    markReadTimerRef.current = window.setTimeout(() => { markReadTimerRef.current = null; flushMarkRead(); }, 400);
  }, [flushMarkRead]);

  async function openMessage(msg: MailMessage) {
    lastUserActivityRef.current = Date.now(); // pauzeer warmup tijdens actief klikken
    if (isMobile) setMobilePane("message");
    // F07: Use msg._folder for subfolder search results, otherwise activeFolder
    const msgFolder = msg._folder || activeFolder;
    setSelectedUid(msg.uid);
    selectedUidRef.current = msg.uid; // race-guard baseline (zie selectedUidRef)
    setConversationMsgs([]); // Clear previous conversation

    // Server's get-message auto-sets \Seen (mirrored in desktop
    // op_get_message). Decrement the in-memory folder count so the
    // sidebar badge reflects the new state immediately — the badge
    // useEffect below derives the total from `folders` so we don't
    // need to touch setBadgeCount here.
    if (!msg.seen) {
      setFolders(prev =>
        prev.map(f =>
          f.path === msgFolder && f.unseen ? { ...f, unseen: Math.max(0, (f.unseen || 0) - 1) } : f,
        ),
      );
    }

    const instId = getActiveInstanceId();
    const cacheKey = fmKey(msgFolder, msg.uid);
    // Staleness-guard: een gecachte body hoort alleen geserveerd te worden als
    // 'ie nog bij DEZE lijst-rij hoort. IMAP-UIDs worden hergebruikt na
    // expunge/move → onderwerp+datum vergelijken vangt het geval dat dezelfde
    // (folder,uid) inmiddels een ánder bericht is. Mismatch → niet serveren,
    // verse server-fetch.
    const matchesRow = (b: MailMessageFull) =>
      (b.subject || "") === (msg.subject || "") && (b.date || "") === (msg.date || "");

    // 1) In-memory cache (deze sessie).
    const cached = fullMsgCache.get(cacheKey);
    if (cached && matchesRow(cached)) {
      setSelectedMsg(cached);
      setMessages(prev => prev.map(m => m.uid === msg.uid ? { ...m, seen: true } : m));
      applyOptimisticReadFlag(msg.uid, true, msgFolder);
      if (!msg.seen) markReadCoalesced(msgFolder, msg.uid);
      loadConversation(cached, msgFolder);
      return;
    }

    // 2) Lokale body-cache (IndexedDB): instant + offline. Bodies komen via PEEK
    // binnen (server kent \Seen nog niet) → bij een ongelezen mail markeren we
    // 'm hier alsnog read (fire-and-forget).
    if (instId && instId !== "default") {
      const idb = await readMailBody<MailMessageFull>(instId, acctCachePrefix, msgFolder, msg.uid);
      // Race-guard: gebruiker klikte intussen een andere mail aan → verwerp.
      if (selectedUidRef.current !== msg.uid) return;
      if (idb?.body && matchesRow(idb.body)) {
        setSelectedMsg(idb.body);
        fullMsgCache.set(cacheKey, idb.body);
        setMessages(prev => prev.map(m => m.uid === msg.uid ? { ...m, seen: true } : m));
        applyOptimisticReadFlag(msg.uid, true, msgFolder);
        if (!msg.seen) {
          markReadCoalesced(msgFolder, msg.uid);
        }
        loadConversation(idb.body, msgFolder);
        return;
      }
      // Stale (UID hergebruikt) of niet aanwezig → ruim een stale entry op en
      // val door naar de server.
      if (idb?.body) deleteMailBody(instId, acctCachePrefix, msgFolder, msg.uid).catch(() => {});
    }

    setLoadingMsg(true);
    try {
      await ensureMailConfigPushed(activeAcct);
      const res = await fetch(`/api/mail/message?${bq({ folder: msgFolder, uid: String(msg.uid) })}`);
      const data = await res.json();
      // Race-guard: laat-binnenkomend resultaat van een eerdere klik niet de
      // huidige selectie overschrijven. (We cachen 'm wel nog, zie onder.)
      const stillSelected = selectedUidRef.current === msg.uid;
      if (data.data) {
        // Cachen gebeurt ALTIJD (we hebben de body al) — ook als de gebruiker
        // intussen verder klikte; dat maakt de volgende keer openen instant.
        fullMsgCache.set(cacheKey, data.data);
        if (instId && instId !== "default") {
          const mailDate = data.data.date ? new Date(data.data.date).getTime() : Date.now();
          persistMailBody(instId, acctCachePrefix, msgFolder, msg.uid, data.data, mailDate || Date.now())
            .then((r) => { if (r.quotaExceeded) setToast(t("webmail.cache_full_warning")); })
            .catch(() => { /* ignore */ });
        }
        // Weergeven ALLEEN als dit nog de geselecteerde mail is (race-guard):
        // anders zie je een mail die je allang niet meer wilde zien.
        if (stillSelected) {
          setSelectedMsg(data.data);
          setMessages(prev => prev.map(m => m.uid === msg.uid ? { ...m, seen: true } : m));
          applyOptimisticReadFlag(msg.uid, true, msgFolder);
          loadConversation(data.data, msgFolder);
        }
      }
    } catch { /* ignore */ }
    finally { setLoadingMsg(false); }
  }

  async function loadConversation(msg: MailMessageFull, msgFolder: string) {
    // Only load conversation if the message has threading info or looks like part of a thread
    const hasRePrefix = /^(Re|Fwd|FW|AW|Antw|Doorgestuurd):\s*/i.test(msg.subject);
    // bug #4: gebruik de map waaruit de mail geopend is (msg._folder bij een
    // submap-zoekresultaat), niet de actieve map — anders faalt de thread-lookup.
    const hasThreading = msg.messageId || msg.inReplyTo || msg.references || hasRePrefix || isReplied(msgFolder, msg.uid);
    if (!hasThreading) return;

    setLoadingConversation(true);
    try {
      await ensureMailConfigPushed(activeAcct);
      // Server doet nu zelf de header-based matching + transitive closure.
      // We sturen folder + uid; subject als fallback voor backward-compat.
      const params = new URLSearchParams({
        ...Object.fromEntries(new URLSearchParams(bq())),
        folder: msgFolder,
        uid: String(msg.uid),
        subject: msg.subject,
      });
      const res = await fetch(`/api/mail/conversation?${params}`);
      if (res.ok) {
        const data = await res.json();
        const thread = (data.data || []) as MailMessageFull[];
        // Race-guard: alleen tonen als deze mail nog geselecteerd is — anders
        // hoort de thread bij een mail die de gebruiker al verlaten heeft.
        if (thread.length > 1 && selectedUidRef.current === msg.uid) {
          setConversationMsgs(thread);
        }
      }
    } catch { /* ignore conversation loading errors */ }
    finally { setLoadingConversation(false); }
  }

  function switchFolder(folder: string) {
    lastUserActivityRef.current = Date.now(); // pauzeer warmup tijdens actief klikken
    setActiveFolder(folder);
    setCurrentPage(1);
    setSelectedUid(null);
    setSelectedMsg(null);
    setConversationMsgs([]);
    setSelectedUids(new Set());
    lastClickedUid.current = null;
    setSubfolderMessages([]); // F07: Clear subfolder results on folder switch
    // Try cache first for instant switch (alle paden door applyRecentReadOverlay
    // zodat in laatste 60 s lokaal gemarkeerde mails seen=true blijven, ook
    // als de gecachte snapshot ouder is dan de mark-read).
    const cached = folderMsgCache.get(acctCachePrefix ? `${acctCachePrefix}:${folder}` : folder);
    if (cached) {
      setMessages(applyRecentReadOverlay(cached.messages, folder));
      setTotal(cached.total);
      if (Date.now() - cached.ts > 30_000) loadMessages(folder, true);
    } else {
      // Async IDB-lookup met localStorage fallback. setMessages([]) als beide
      // leeg zijn — server-fetch (loadMessages) komt direct erna en vult.
      // Race-guard: bij snel-klikken op meerdere folders mag een laat-
      // aankomende IDB-lookup voor folder A niet de UI overschrijven nadat
      // de user al naar folder B is.
      (async () => {
        const persisted = (await readMailFolderCacheIdb(getActiveInstanceId(), acctCachePrefix, folder))
          || readMailFolderCache(getActiveInstanceId(), acctCachePrefix, folder);
        if (folder !== activeFolderRef.current) return; // stale
        if (persisted && persisted.messages && persisted.messages.length > 0) {
          setMessages(applyRecentReadOverlay(persisted.messages, folder));
          setTotal(persisted.total);
        } else {
          setMessages([]);
        }
      })();
      loadMessages(folder, true);
    }
  }

  /**
   * Invalideer alle 3 cache-lagen voor één folder na move/delete. Zonder
   * dit blijft een verwijderde mail in localStorage staan en "komt terug"
   * bij browser-refresh tot de server-fetch hem corrigeert (cache-flicker).
   */
  function invalidateFolderCache(folder: string) {
    const memKey = acctCachePrefix ? `${acctCachePrefix}:${folder}` : folder;
    folderMsgCache.delete(memKey);
    const instId = getActiveInstanceId();
    try {
      localStorage.removeItem(`webmail_msglist_cache_${instId}_${acctCachePrefix}_${folder}`);
    } catch { /* ignore */ }
    deleteMailFolderCacheIdb(instId, acctCachePrefix, folder); // fire-and-forget
    // Ook de body-cache van deze map wissen, anders blijft verwijderde/verplaatste
    // inhoud lokaal staan (en kan via UID-hergebruik later verkeerd opduiken).
    if (instId && instId !== "default") deleteFolderBodies(instId, acctCachePrefix, folder).catch(() => {});
  }

  function handleDeleteMsg(uid: number, skipConfirm = false) {
    // Confirm alleen bij PERMANENT delete (binnen Verwijderde items / Trash-folder).
    // Bij andere folders: backend verplaatst naar Trash — herstelbaar, geen confirm
    // nodig. Trash herkennen via specialUse OF naam-fallback (gelijk aan
    // getFolderIconColor logic): "\\Trash" / "verwijderde" / "deleted" / "prullenbak".
    const currentFolder = folders.find(f => f.path === activeFolder);
    const isInTrash = !!currentFolder && (
      currentFolder.specialUse === "\\Trash" ||
      /verwijderde|deleted|prullenbak|^trash$/i.test(currentFolder.name)
    );
    if (isInTrash && !skipConfirm) {
      if (!window.confirm(t("webmail.confirm_permanent_delete", "Deze e-mail permanent verwijderen? Dit kan niet ongedaan gemaakt worden."))) {
        return;
      }
    }
    // Check if the deleted message was unread
    const deletedMsg = messages.find(m => m.uid === uid);
    const wasUnread = deletedMsg && !deletedMsg.seen;
    // Optimistic: remove from UI immediately
    setMessages(prev => prev.filter(m => m.uid !== uid));
    if (selectedUid === uid) { setSelectedUid(null); setSelectedMsg(null); if (isMobile) setMobilePane("list"); }
    invalidateFolderCache(activeFolder);
    fullMsgCache.delete(fmKey(activeFolder, uid));
    { const _i = getActiveInstanceId(); if (_i && _i !== "default") deleteMailBody(_i, acctCachePrefix, activeFolder, uid).catch(() => {}); }
    // Update folder counts optimistically
    if (wasUnread) {
      setFolders(prev => prev.map(f => f.path === activeFolder && f.unseen ? { ...f, unseen: Math.max(0, (f.unseen || 0) - 1) } : f));
    }
    // Fire-and-forget: backend moves to Trash (or permanently deletes if already in Trash).
    // Await the config push so the server session cache is guaranteed to be populated —
    // otherwise the DELETE could race a just-updated config and 400.
    const trashOv = getTrashFolderOverride(activeAccountEmail);
    ensureMailConfigPushed(activeAcct).then(() =>
      fetch(`/api/mail/message?${bq({ folder: activeFolder, uid: String(uid), ...(trashOv ? { trashFolder: trashOv } : {}) })}`, { method: "DELETE" })
    ).then(async r => {
      if (!r || !r.ok) {
        // Server-fail: optimistic UI is al "weg". Geef gebruiker feedback
        // zodat hij weet dat de actie niet doorging — anders denkt hij dat
        // de mail veilig in Trash zit, terwijl die nog op de server staat.
        setToast(t("webmail.delete_failed"));
        return;
      }
      try {
        const data = await r.json() as { action?: string; trashPath?: string | null };
        if (data?.action === "moved" && data.trashPath && data.trashPath !== activeFolder) {
          invalidateFolderCache(data.trashPath);
        }
      } catch { /* response not JSON — ignore */ }
    }).catch(() => {
      setToast(t("webmail.delete_failed"));
    });
  }

  function handleMoveMsg(uid: number, toFolder: string) {
    // Check if the moved message was unread
    const movedMsg = messages.find(m => m.uid === uid);
    const wasUnread = movedMsg && !movedMsg.seen;
    // Auto-koppel aan project op basis van target-folder. Verplaatsen naar
    // bv. "[IN] 3001 JM24-026 CLT Offemweg 8" → mail wordt automatisch aan
    // project 3001 gekoppeld. Persistent (server + localStorage).
    if (movedMsg) {
      const match = matchProjectFromFolder(toFolder, allProjects);
      if (match) {
        const emailKey = `${uid}:${movedMsg.subject || ""}`;
        setEmailProjectLink(emailKey, match.name);
      }
    }
    // Optimistic: remove from UI immediately
    setMessages(prev => prev.filter(m => m.uid !== uid));
    if (selectedUid === uid) { setSelectedUid(null); setSelectedMsg(null); if (isMobile) setMobilePane("list"); }
    invalidateFolderCache(activeFolder);
    invalidateFolderCache(toFolder);
    fullMsgCache.delete(fmKey(activeFolder, uid));
    { const _i = getActiveInstanceId(); if (_i && _i !== "default") deleteMailBody(_i, acctCachePrefix, activeFolder, uid).catch(() => {}); }
    // Update folder counts optimistically
    if (wasUnread) {
      setFolders(prev => prev.map(f => {
        if (f.path === activeFolder && f.unseen) return { ...f, unseen: Math.max(0, (f.unseen || 0) - 1) };
        if (f.path === toFolder) return { ...f, unseen: (f.unseen || 0) + 1 };
        return f;
      }));
    }
    // Fire-and-forget: backend moves in background
    ensureMailConfigPushed(activeAcct).then(() =>
      fetch(`/api/mail/move?${bq({ folder: activeFolder, uid: String(uid), toFolder })}`, { method: "POST" })
    ).then((r) => {
      if (!r || !r.ok) setToast(t("webmail.move_failed"));
    }).catch(() => {
      setToast(t("webmail.move_failed"));
    });
  }

  /**
   * Cross-account move (e.g. info@ → administratie@). Both mailboxes need
   * to have been opened in this Y-app session at least once so their creds
   * are in the server-side mail-session cache. The endpoint blocks until
   * the IMAP append+delete is confirmed, so we don't optimistically remove
   * the message — we await and only then update the UI. Worth the extra
   * latency: a cross-account move can fail (auth, quota, missing target
   * folder) and the user should know.
   */
  async function handleMoveMsgCrossAccount(uid: number, dstAcct: string | null, dstFolder: string) {
    // Make sure both accounts' creds are pushed to the server cache.
    try {
      await ensureMailConfigPushed(activeAcct);
      await ensureMailConfigPushed(dstAcct);
    } catch {
      alert(t("webmail.cross_account_creds_failed", { defaultValue: "Kon niet alle mailbox-credentials laden. Open beide mailboxen eerst." }));
      return;
    }
    try {
      const res = await fetch("/api/mail/move-cross-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          srcAcct: activeAcct || null,
          srcFolder: activeFolder,
          srcUid: uid,
          dstAcct: dstAcct || null,
          dstFolder,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        alert(data?.error || t("webmail.move_failed_http", { status: res.status, defaultValue: "Verplaatsen mislukt (HTTP {{status}})" }));
        return;
      }
      if (data.warning) alert(data.warning);
      // Remove from UI on success
      setMessages(prev => prev.filter(m => m.uid !== uid));
      if (selectedUid === uid) {
        setSelectedUid(null);
        setSelectedMsg(null);
        if (isMobile) setMobilePane("list");
      }
      invalidateFolderCache(activeFolder);
      fullMsgCache.delete(fmKey(activeFolder, uid));
    { const _i = getActiveInstanceId(); if (_i && _i !== "default") deleteMailBody(_i, acctCachePrefix, activeFolder, uid).catch(() => {}); }
    } catch (err) {
      alert(t("webmail.move_failed_detail", { detail: err instanceof Error ? err.message : String(err), defaultValue: "Verplaatsen mislukt: {{detail}}" }));
    }
  }

  const [showMoveDropdown, setShowMoveDropdown] = useState(false);

  // F05: Multi-select handlers
  function handleSelectEmail(uid: number, e: React.MouseEvent) {
    setSelectedUids(prev => {
      const next = new Set(prev);
      if (e.shiftKey && lastClickedUid.current !== null) {
        // Range select: replace selection with range from anchor to current
        const uids = filteredMessages.map(m => m.uid);
        const start = uids.indexOf(lastClickedUid.current);
        const end = uids.indexOf(uid);
        if (start !== -1 && end !== -1) {
          next.clear();
          const [from, to] = start < end ? [start, end] : [end, start];
          for (let i = from; i <= to; i++) next.add(uids[i]);
        }
        // Anchor stays — do NOT update lastClickedUid on shift-click
        return next;
      } else if (e.ctrlKey || e.metaKey) {
        // Toggle individual; set new anchor
        if (next.has(uid)) next.delete(uid); else next.add(uid);
      } else {
        // Shift+click without existing anchor: start new anchor
        next.clear();
        next.add(uid);
      }
      return next;
    });
    // Only update anchor on non-shift clicks
    if (!e.shiftKey) lastClickedUid.current = uid;
  }

  function handleSelectAll() {
    if (selectedUids.size === filteredMessages.length) {
      setSelectedUids(new Set());
    } else {
      setSelectedUids(new Set(filteredMessages.map(m => m.uid)));
    }
  }

  function handleBulkDelete() {
    // bug #7: bij bulk-delete in Verwijderde items éénmalig bevestigen i.p.v.
    // per geselecteerde mail een aparte window.confirm (was N dialogen).
    const cf = folders.find(f => f.path === activeFolder);
    const isInTrash = !!cf && (cf.specialUse === "\\Trash" || /verwijderde|deleted|prullenbak|^trash$/i.test(cf.name));
    if (isInTrash && !window.confirm(t("webmail.confirm_permanent_delete", "Deze e-mail permanent verwijderen? Dit kan niet ongedaan gemaakt worden."))) {
      return;
    }
    for (const uid of selectedUids) {
      handleDeleteMsg(uid, true);
    }
    setSelectedUids(new Set());
    lastClickedUid.current = null;
  }

  function handleBulkMove(toFolder: string) {
    for (const uid of selectedUids) {
      handleMoveMsg(uid, toFolder);
    }
    setSelectedUids(new Set());
    lastClickedUid.current = null;
    setShowBulkMoveDropdown(false);
  }

  // ── "Sorteer in projectmap": per-mail folder-voorstel ──────────────────────

  /** Bijlagenamen van de kandidaat-mail uit de warme client-caches (signaal F);
   *  geen servercall. */
  async function candidateAttachmentNames(instId: string, acct: string, folder: string, uid: number): Promise<string[]> {
    const mem = fullMsgCache.get(fmKey(folder, uid));
    if (mem?.attachments) return mem.attachments.map((a) => a.filename).filter(Boolean) as string[];
    const idb = await readMailBody<MailMessageFull>(instId, acct, folder, uid);
    return (idb?.body?.attachments || []).map((a) => a.filename).filter(Boolean) as string[];
  }

  function buildCreateName(project: { name: string; project_name: string }, side: MailSide): string {
    const prefix = side === "sent" ? "[OUT]" : "[IN]";
    const nr = project.name.replace(/^PROJ-/i, "");
    return `${prefix} ${nr} ${project.project_name}`;
  }

  /** Combineert deterministische (D/E) + geleerde (C) signalen tot één voorstel. */
  function buildProposal(
    msg: MailMessage,
    src: string,
    side: MailSide,
    det: ReturnType<typeof matchProjectFromMail>,
    hist: { path: string; score: number }[],
  ): SortRowProposal {
    const confRank = (c: string) => (c === "high" ? 3 : c === "medium" ? 2 : c === "low" ? 1 : 0);
    const histTop = hist[0];
    const histConf = histTop ? historyConfidence(histTop.score) : "none";

    let detFolder: string | null = null;
    let detCreate: string | null = null;
    let detAmbiguous = false;
    if (det.project) {
      const resolved = resolveProjectFolder(det.project, side, folders, isSentContext);
      if (resolved) { detFolder = resolved.path; detAmbiguous = resolved.ambiguous; }
      else detCreate = buildCreateName(det.project, side);
    }
    const detHasTarget = !!(detFolder || detCreate);
    const histHasTarget = !!(histTop && histConf !== "none");
    const agree = !!(detFolder && histTop && detFolder === histTop.path);

    let proposedFolder: string | null = null;
    let createFolderName: string | null = null;
    let confidence: SortRowProposal["confidence"] = "none";
    let reason = "none";
    let ambiguous = false;

    if (det.reason === "link" && detHasTarget) {
      proposedFolder = detFolder; createFolderName = detFolder ? null : detCreate;
      confidence = "high"; reason = "link"; ambiguous = detAmbiguous;
    } else if (agree) {
      proposedFolder = detFolder; confidence = "high"; reason = "history"; ambiguous = detAmbiguous;
    } else if (det.confidence === "high" && detHasTarget) {
      proposedFolder = detFolder; createFolderName = detFolder ? null : detCreate;
      confidence = "high"; reason = det.reason; ambiguous = detAmbiguous;
    } else if (histHasTarget && confRank(histConf) >= confRank(det.confidence)) {
      proposedFolder = histTop!.path; confidence = histConf; reason = "history";
    } else if (detHasTarget) {
      proposedFolder = detFolder; createFolderName = detFolder ? null : detCreate;
      confidence = det.confidence; reason = det.reason; ambiguous = detAmbiguous;
    } else if (histHasTarget) {
      proposedFolder = histTop!.path; confidence = histConf; reason = "history";
    }

    return {
      uid: msg.uid,
      subject: msg.subject || "",
      sourceFolder: src,
      side,
      proposedFolder,
      confidence,
      reason,
      createFolderName,
      ambiguous,
      alreadyHere: !!proposedFolder && proposedFolder === src,
    };
  }

  /** Signaal B: staat een eerder bericht uit de thread al in een projectmap
   *  aan de juiste kant? Retourneert dat mappad, of null. */
  async function threadProjectFolder(p: SortRowProposal): Promise<string | null> {
    try {
      await ensureMailConfigPushed(activeAcct);
      const params = new URLSearchParams({
        ...Object.fromEntries(new URLSearchParams(bq())),
        folder: p.sourceFolder,
        uid: String(p.uid),
        subject: p.subject,
      });
      const res = await fetch(`/api/mail/conversation?${params}`);
      if (!res.ok) return null;
      const data = await res.json();
      const thread = (data.data || []) as MailMessageFull[];
      for (const m of thread) {
        if (!m.folder || m.folder === p.sourceFolder) continue;
        const memberSide: MailSide = isSentContext(m.folder, folders) ? "sent" : "inbox";
        if (memberSide !== p.side) continue;
        if (matchProjectFromFolder(m.folder, allProjects)) return m.folder;
      }
      return null;
    } catch {
      return null;
    }
  }

  /** Verrijkt onzekere rijen (low/none) via de thread-lookup, concurrency 4. */
  async function enrichWithThread(base: SortRowProposal[]) {
    const uncertain = base.filter((p) => (p.confidence === "low" || p.confidence === "none") && !p.alreadyHere);
    if (!uncertain.length) return;
    const uncertainUids = new Set(uncertain.map((p) => p.uid));
    setSortProposals((prev) => prev.map((p) => (uncertainUids.has(p.uid) ? { ...p, loadingThread: true } : p)));
    const queue = [...uncertain];
    const runOne = async () => {
      for (;;) {
        const p = queue.shift();
        if (!p) return;
        const folder = await threadProjectFolder(p);
        setSortProposals((prev) => prev.map((pp) => {
          if (pp.uid !== p.uid) return pp;
          if (folder) {
            return { ...pp, proposedFolder: folder, createFolderName: null, confidence: "high", reason: "thread", ambiguous: false, alreadyHere: folder === pp.sourceFolder, loadingThread: false };
          }
          return { ...pp, loadingThread: false };
        }));
      }
    };
    await Promise.all([runOne(), runOne(), runOne(), runOne()]);
  }

  async function openSortModal() {
    setSortProposals([]);
    setShowSortModal(true);
    const instId = getActiveInstanceId() || "default";
    const acct = acctCachePrefix;
    const links = getEmailProjectLinks();
    const selected = filteredMessages.filter((m) => selectedUids.has(m.uid));
    const profiles = await buildFolderProfiles(instId, acct, folders, allProjects, isSentContext);
    const base: SortRowProposal[] = [];
    for (const msg of selected) {
      const src = msg._folder || activeFolder;
      const side: MailSide = isSentContext(src, folders) ? "sent" : "inbox";
      const attNames = await candidateAttachmentNames(instId, acct, src, msg.uid);
      const participants = [...(msg.from || []), ...(msg.to || [])].map((a) => a.address).filter(Boolean) as string[];
      const linkKey = `${msg.uid}:${msg.subject || ""}`;
      const det = matchProjectFromMail(
        { subject: msg.subject, attachmentNames: attNames, linkedProjectName: links[linkKey] || null },
        allProjects,
      );
      const hist = scoreFoldersFromHistory({ subject: msg.subject, participants, attachmentNames: attNames }, profiles, side);
      base.push(buildProposal(msg, src, side, det, hist));
    }
    setSortProposals(base);
    enrichWithThread(base);
  }

  /** Maakt een projectmap aan aan de juiste kant en geeft het volledige pad terug. */
  async function createProjectFolder(side: MailSide, folderName: string): Promise<string | null> {
    const parentPath = side === "sent"
      ? (folders.find((f) => f.specialUse === "\\Sent")?.path || getSentFolderOverride() || "INBOX")
      : "INBOX";
    const parentFolder = folders.find((f) => f.path === parentPath);
    const delimiter = parentFolder?.delimiter || folders.find((f) => f.delimiter)?.delimiter || ".";
    const fullPath = `${parentPath}${delimiter}${folderName}`;
    try {
      await ensureMailConfigPushed(activeAcct);
      const resp = await fetch(`/api/mail/folder?${bq({ name: fullPath })}`, { method: "POST" });
      if (!resp.ok) { setToast(t("webmail.folder_create_error", { message: resp.statusText })); return null; }
      loadFolders();
      return fullPath;
    } catch (err) {
      setToast(t("webmail.folder_create_error", { message: (err as Error).message }));
      return null;
    }
  }

  async function handleSortConfirm(moves: SortMove[]) {
    setShowSortModal(false);
    const createdCache = new Map<string, string | null>();
    for (const mv of moves) {
      if (mv.toFolder) {
        handleMoveMsg(mv.uid, mv.toFolder);
      } else if (mv.createFolderName) {
        const key = `${mv.side}:${mv.createFolderName}`;
        let target = createdCache.get(key);
        if (target === undefined) {
          target = await createProjectFolder(mv.side, mv.createFolderName);
          createdCache.set(key, target);
        }
        if (target) handleMoveMsg(mv.uid, target);
      }
    }
    setSelectedUids(new Set());
    lastClickedUid.current = null;
  }

  function handleCreateFolder(parentPath: string) {
    setCreateFolderParent(parentPath);
  }

  async function submitCreateFolder(folderName: string) {
    const parentPath = createFolderParent || "INBOX";
    setCreateFolderParent(null);
    // Use the delimiter from folder data (IMAP server tells us "." or "/")
    const parentFolder = folders.find(f => f.path === parentPath);
    const delimiter = parentFolder?.delimiter || folders.find(f => f.delimiter)?.delimiter || ".";
    const fullPath = parentPath ? `${parentPath}${delimiter}${folderName}` : folderName;
    try {
      await ensureMailConfigPushed(activeAcct);
      const resp = await fetch(`/api/mail/folder?${bq({ name: fullPath })}`, { method: "POST" });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        alert(t("webmail.folder_create_error", { message: data.error || resp.statusText }));
        return;
      }
      loadFolders();
    } catch (err) {
      alert(t("webmail.folder_create_error", { message: (err as Error).message }));
    }
  }

  async function handleRenameFolder(oldPath: string) {
    const currentName = oldPath.split(/[./]/).pop() || oldPath;
    const newName = prompt(t("webmail.new_name_prompt"), currentName);
    if (!newName?.trim() || newName.trim() === currentName) return;
    // Keep the parent path (including INBOX prefix), just change the last segment
    const sepIdx = Math.max(oldPath.lastIndexOf("/"), oldPath.lastIndexOf("."));
    const newPath = sepIdx > 0 ? `${oldPath.slice(0, sepIdx + 1)}${newName.trim()}` : newName.trim();
    try {
      await ensureMailConfigPushed(activeAcct);
      const resp = await fetch(`/api/mail/rename-folder?${bq()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPath, newPath }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        alert(t("webmail.rename_error", { message: data.error || resp.statusText }));
        return;
      }
      loadFolders();
    } catch (err) {
      alert(t("webmail.rename_error", { message: (err as Error).message }));
    }
  }

  async function handleDeleteFolder(path: string) {
    const f = folders.find(ff => ff.path === path);
    const name = f?.name || path.split(/[./]/).pop() || path;
    if (!window.confirm(t("webmail.confirm_delete_folder", {
      name,
      defaultValue: `Map "${name}" en alle inhoud verwijderen? Dit kan niet ongedaan worden gemaakt.`,
    }))) return;
    try {
      await ensureMailConfigPushed(activeAcct);
      const resp = await fetch(`/api/mail/delete-folder?${bq({ path })}`, { method: "POST" });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        setToast(t("webmail.delete_folder_failed", {
          message: data.error || resp.statusText, defaultValue: "Map verwijderen mislukt",
        }));
        return;
      }
      // Lokale caches van deze map wissen; als we erin staan → terug naar INBOX.
      invalidateFolderCache(path);
      if (activeFolder === path) switchFolder("INBOX");
      loadFolders();
      setToast(t("webmail.folder_deleted", { name, defaultValue: `Map "${name}" verwijderd` }));
    } catch (err) {
      setToast(t("webmail.delete_folder_failed", {
        message: (err as Error).message, defaultValue: "Map verwijderen mislukt",
      }));
    }
  }

  // Optimistic mark-read: registreer in TTL-Set (60 s) zodat de overlay-
  // helpers weten dat deze UID *recent* lokaal gemarkeerd is en seen=true
  // moeten preserveren over server-fetches (\Seen STORE race-window).
  // Plus update in-memory folderMsgCache zodat tab-switch binnen 30 s een
  // consistente UI toont. localStorage wordt NIET aangepast — bij volgende
  // fresh fetch wint server-truth, gemoduleerd door de TTL-Set-overlay.
  function applyOptimisticReadFlag(uid: number, seen: boolean, folder: string) {
    trackLocalMarkRead(folder, uid, seen);
    const cacheKey = acctCachePrefix ? `${acctCachePrefix}:${folder}` : folder;
    const cached = folderMsgCache.get(cacheKey);
    if (cached) {
      folderMsgCache.set(cacheKey, {
        ...cached,
        messages: cached.messages.map(m => m.uid === uid ? { ...m, seen } : m),
      });
    }
  }

  async function handleMarkUnread(uid: number) {
    try {
      await ensureMailConfigPushed(activeAcct);
      await fetch(`/api/mail/mark-unread?${bq({ folder: activeFolder, uid: String(uid) })}`, { method: "POST" });
      setMessages(prev => prev.map(m => m.uid === uid ? { ...m, seen: false } : m));
      if (selectedUid === uid && selectedMsg) setSelectedMsg({ ...selectedMsg, seen: false });
      applyOptimisticReadFlag(uid, false, activeFolder);
      setFolders(prev => prev.map(f => f.path === activeFolder ? { ...f, unseen: (f.unseen || 0) + 1 } : f));
    } catch { /* ignore */ }
  }

  async function handleMarkRead(uid: number) {
    try {
      await ensureMailConfigPushed(activeAcct);
      await fetch(`/api/mail/mark-read?${bq({ folder: activeFolder, uid: String(uid) })}`, { method: "POST" });
      setMessages(prev => prev.map(m => m.uid === uid ? { ...m, seen: true } : m));
      if (selectedUid === uid && selectedMsg) setSelectedMsg({ ...selectedMsg, seen: true });
      applyOptimisticReadFlag(uid, true, activeFolder);
      setFolders(prev => prev.map(f => f.path === activeFolder && f.unseen ? { ...f, unseen: Math.max(0, (f.unseen || 0) - 1) } : f));
    } catch { /* ignore */ }
  }

  const [attachPreview, setAttachPreview] = useState<{ url: string; filename: string; contentType: string } | null>(null);
  const [attachPreviewLoading, setAttachPreviewLoading] = useState(false);

  function closeAttachPreview() {
    if (attachPreview?.url) URL.revokeObjectURL(attachPreview.url);
    setAttachPreview(null);
  }

  /**
   * Haal een bijlage op: eerst uit de lokale cache (instant/offline), anders van
   * de server. Bij een cold fetch wordt de bijlage gecached MITS de mail-cache
   * aanstaat (windowDays > 0) — lazy: alleen wat je opent/downloadt. Eviction
   * volgt hetzelfde rollende venster als de bodies (zie de pre-fill-useEffect).
   */
  async function fetchAttachmentBlob(uid: number, index: number, folder: string): Promise<Blob> {
    const instId = getActiveInstanceId();
    const acct = acctCachePrefix;
    if (instId && instId !== "default") {
      const cached = await readAttachment(instId, acct, folder, uid, index);
      if (cached?.blob) return cached.blob;
    }
    await ensureMailConfigPushed(activeAcct);
    const resp = await fetch(`/api/mail/attachment?${bq({ folder, uid: String(uid), index: String(index) })}`);
    if (!resp.ok) throw new Error("attachment fetch failed");
    const blob = await resp.blob();
    if (instId && instId !== "default" && getMailCacheWindowDays(instId, activeAccountEmail) > 0) {
      const att = selectedMsg?.attachments?.[index];
      const mailDate = selectedMsg?.date ? new Date(selectedMsg.date).getTime() : Date.now();
      persistAttachment(
        instId, acct, folder, uid, index, blob,
        att?.filename || "attachment",
        att?.contentType || resp.headers.get("content-type") || "",
        mailDate || Date.now(),
      ).then((r) => { if (r.quotaExceeded) setToast(t("webmail.cache_full_warning")); })
        .catch(() => { /* ignore */ });
    }
    return blob;
  }

  async function openAttachment(uid: number, index: number) {
    const att = selectedMsg?.attachments?.[index];
    const ct = att?.contentType || "";
    const fn = att?.filename || "attachment";

    // PDF → open fullscreen in een nieuw browser-tabblad (volledige native viewer,
    // alle tools). Het tabblad wordt SYNCHROON binnen de klik geopend, anders
    // blokkeert de popup-blocker het na de async blob-fetch. Daarna navigeren we
    // het naar de (gecachte → instant) blob-URL. De blob-URL pas na 60s vrijgeven,
    // anders breekt het net-geopende tabblad.
    //
    // Desktop: een Tauri-webview heeft geen echte browsertabs — window.open
    // hieronder faalt daar stil (retourneert null), waarna de code voorheen
    // terugviel op een ONZICHTBARE download (bestand verscheen zonder preview,
    // Piet's melding). Rust schrijft de bijlage nu rechtstreeks (géén blob/
    // base64-omweg — dat zou de al trage fetch verder vertragen) naar een
    // tijdelijk bestand en opent 'm met de OS-standaardviewer.
    if (ct === "application/pdf" && isDesktopApp()) {
      try {
        await ensureMailConfigPushed(activeAcct);
        const resp = await fetch(`/api/mail/attachment/open-external?${bq({ folder: activeFolder, uid: String(uid), index: String(index) })}`, { method: "POST" });
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data?.error || `HTTP ${resp.status}`);
        }
      } catch (err) {
        console.error("PDF open failed:", err);
        setToast(t("webmail.pdf_open_failed"));
      }
      return;
    }
    if (ct === "application/pdf") {
      const win = window.open("", "_blank");
      if (win) {
        try { win.document.write('<!doctype html><title>' + fn + '</title><body style="margin:0;font-family:Segoe UI,sans-serif;color:#64748b;display:flex;align-items:center;justify-content:center;height:100vh">PDF laden…</body>'); } catch { /* ignore */ }
      }
      try {
        const blob = await fetchAttachmentBlob(uid, index, activeFolder);
        const blobUrl = URL.createObjectURL(blob);
        if (win) {
          win.location.href = blobUrl;
        } else {
          // Popup geblokkeerd → val terug op een download.
          const a = document.createElement("a");
          a.href = blobUrl; a.download = fn;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
        }
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      } catch (err) {
        console.error("PDF open failed:", err);
        if (win) { try { win.close(); } catch { /* ignore */ } }
      }
      return;
    }

    // Niet-previewbaar (geen image/text) → download.
    if (!(ct.startsWith("image/") || ct.startsWith("text/"))) {
      downloadAttachment(uid, index);
      return;
    }

    // Afbeeldingen / tekst → inline preview (modal).
    setAttachPreviewLoading(true);
    try {
      const blob = await fetchAttachmentBlob(uid, index, activeFolder);
      const blobUrl = URL.createObjectURL(blob);
      setAttachPreview({ url: blobUrl, filename: fn, contentType: ct });
    } catch (err) {
      console.error("Attachment preview failed:", err);
    } finally {
      setAttachPreviewLoading(false);
    }
  }

  /** Download attachment locally (triggers browser Save dialog) */
  async function downloadAttachment(uid: number, index: number) {
    const att = selectedMsg?.attachments?.[index];
    const fn = att?.filename || "attachment";
    try {
      const blob = await fetchAttachmentBlob(uid, index, activeFolder);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fn;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error("Download failed:", err);
    }
  }

  /** Download all (non-inline) attachments locally */
  async function downloadAllAttachments(uid: number) {
    const atts = selectedMsg?.attachments;
    if (!atts) return;
    for (let i = 0; i < atts.length; i++) {
      if (!isInlineAttachment(atts[i], selectedMsg?.htmlBody)) {
        await downloadAttachment(uid, i);
      }
    }
  }

  /** Upload a single attachment to NextCloud */
  const [ncSaving, setNcSaving] = useState<string | null>(null); // filename being saved or "all"
  const ncSaveTarget = "/Email Attachments";

  /** Save-to-NAS dialog state */
  const [saveToNasOpen, setSaveToNasOpen] = useState(false);
  const saveToNasAttachments = useMemo(() => {
    if (!selectedMsg?.attachments) return [];
    return selectedMsg.attachments
      .map((a, idx) => ({ att: a, index: idx }))
      .filter(({ att }) => !isInlineAttachment(att, selectedMsg.htmlBody))
      .map(({ att, index }) => ({
        index,
        filename: att.filename || `bijlage-${index}`,
        size: att.size || 0,
      }));
  }, [selectedMsg]);
  const fetchAttachmentBytesForNas = useCallback(async (index: number): Promise<ArrayBuffer> => {
    if (!selectedUid) throw new Error("No message selected");
    await ensureMailConfigPushed(activeAcct);
    const url = `/api/mail/attachment?${bq({ folder: activeFolder, uid: String(selectedUid), index: String(index) })}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.arrayBuffer();
  }, [selectedUid, activeAcct, activeFolder, bq]);

  async function saveAttachmentToNextCloud(uid: number, index: number) {
    const att = selectedMsg?.attachments?.[index];
    if (!att) return;
    const fn = att.filename;
    setNcSaving(fn);
    try {
      await ensureMailConfigPushed(activeAcct);
      const url = `/api/mail/attachment?${bq({ folder: activeFolder, uid: String(uid), index: String(index) })}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(t("webmail.attachment_fetch_failed"));
      const blob = await resp.blob();

      const ncPath = `${ncSaveTarget.replace(/\/$/, "")}/${fn}`;
      const uploadResp = await fetch(`/api/nextcloud/upload?path=${encodeURIComponent(ncPath)}`, {
        method: "PUT",
        headers: { "Content-Type": att.contentType || "application/octet-stream" },
        credentials: "same-origin",
        body: blob,
      });
      if (!uploadResp.ok) {
        const err = await uploadResp.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || t("webmail.upload_failed"));
      }
    } catch (err) {
      console.error("NextCloud save failed:", err);
      alert(t("webmail.nextcloud_save_failed", { message: (err as Error).message }));
    } finally {
      setNcSaving(null);
    }
  }

  /** Upload all (non-inline) attachments to NextCloud */
  async function saveAllAttachmentsToNextCloud(uid: number) {
    const atts = selectedMsg?.attachments;
    if (!atts) return;
    setNcSaving("all");
    try {
      for (let i = 0; i < atts.length; i++) {
        if (!isInlineAttachment(atts[i], selectedMsg?.htmlBody)) {
          await saveAttachmentToNextCloud(uid, i);
        }
      }
    } finally {
      setNcSaving(null);
    }
  }

  /* ─── Compose helpers ─── */

  /**
   * Open een mail als standalone popout (/mail/view) in een echt nieuw
   * browser-tabblad — alleen de mail-inhoud, geen sidebar. De drie verplichte
   * URL-parameters (instance/email/acct) gaan mee zodat de popout de juiste
   * IMAP-creds resolvet (zie CLAUDE.md "Popout tabs"). Gedeeld door de rij-
   * dubbelklik én de popout-knop in het leespaneel.
   */
  function popoutMail(uid: number, folder: string, title?: string) {
    const params = new URLSearchParams();
    params.set("uid", String(uid));
    params.set("folder", folder);
    if (activeAcct) params.set("acct", activeAcct);
    if (activeConfig?.user) params.set("email", activeConfig.user);
    if (useVault && activeAccountId) params.set("account", activeAccountId);
    const instId = getActiveInstanceId();
    if (instId && instId !== "default") params.set("instance", instId);
    if (isDesktopApp()) {
      // Desktop: echt popout-VENSTER via de Tauri-laag (window.open zou de ene
      // webview weg-navigeren). DesktopApp vangt dit event af.
      window.dispatchEvent(new CustomEvent("y-app:open-popout", {
        detail: { route: `/mail/view?${params.toString()}`, title: title || "Y-app — mail" },
      }));
      return;
    }
    window.open(`/mail/view?${params.toString()}`, "_blank", "noopener");
  }

  function openCompose() {
    setComposeFloating(false);
    if (isMobile) setMobilePane("compose");
    setCompose({ mode: "new", from: activeConfig.user, to: "", cc: "", bcc: "", subject: "", body: "\n\n" });
  }

  function openReply(msgArg?: MailMessageFull, folderArg?: string) {
    const msg = msgArg || selectedMsg;
    const folder = folderArg || activeFolder;
    if (!msg) return;
    setComposeFloating(false);
    if (isMobile) setMobilePane("compose");
    // In Verzonden: de afzender ben je zelf — beantwoord aan de oorspronkelijke ontvanger(s).
    const fromSent = isSentContext(folder, folders);
    const quoteParty = formatSender(msg.from); // naam/email voor citaat-header blijft de afzender van het bericht
    const replyTo = fromSent ? msg.to.map(a => a.address).filter(Boolean).join(", ") : formatSender(msg.from).email;
    setCompose({
      mode: "reply", from: activeConfig.user, to: replyTo, cc: "", bcc: "",
      subject: msg.subject.startsWith("Re:") ? msg.subject : `Re: ${msg.subject}`,
      body: `\n\n---\n${t("webmail.reply_quote_header", { date: formatFullDate(msg.date), name: quoteParty.name, email: quoteParty.email })}\n\n`,
      inReplyTo: msg.messageId,
      references: [msg.references, msg.messageId].filter(Boolean).join(" "),
      replyToUid: msg.uid,
      replyToFolder: folder,
      quoteHtml: msg.htmlBody || textBodyToHtml(msg.textBody),
    });
  }

  function openReplyAll(msgArg?: MailMessageFull, folderArg?: string) {
    const msg = msgArg || selectedMsg;
    const folder = folderArg || activeFolder;
    if (!msg) return;
    setComposeFloating(false);
    if (isMobile) setMobilePane("compose");
    const fromSent = isSentContext(folder, folders);
    const quoteParty = formatSender(msg.from);
    let to: string;
    let cc: string;
    if (fromSent) {
      // In Verzonden: primaire ontvanger(s) blijven in "Aan", cc-ontvangers in "CC".
      to = msg.to.map(a => a.address).filter(Boolean).join(", ");
      cc = (msg.cc || []).map(a => a.address).filter(Boolean).join(", ");
    } else {
      const primary = formatSender(msg.from);
      const others = [...msg.to, ...(msg.cc || [])].filter(a => a.address && a.address !== activeConfig.user && a.address !== primary.email);
      to = primary.email;
      cc = others.map(a => a.address).join(", ");
    }
    setCompose({
      mode: "replyAll", from: activeConfig.user, to, cc, bcc: "",
      subject: msg.subject.startsWith("Re:") ? msg.subject : `Re: ${msg.subject}`,
      body: `\n\n---\n${t("webmail.reply_quote_header", { date: formatFullDate(msg.date), name: quoteParty.name, email: quoteParty.email })}\n\n`,
      inReplyTo: msg.messageId,
      references: [msg.references, msg.messageId].filter(Boolean).join(" "),
      replyToUid: msg.uid,
      replyToFolder: folder,
      quoteHtml: msg.htmlBody || textBodyToHtml(msg.textBody),
    });
  }

  function openForward(msgArg?: MailMessageFull, folderArg?: string) {
    const msg = msgArg || selectedMsg;
    const folder = folderArg || activeFolder;
    if (!msg) return;
    setComposeFloating(false);
    if (isMobile) setMobilePane("compose");
    const sender = formatSender(msg.from);
    // Bijlages uit oorspronkelijk bericht meenemen (filter inline-images uit handtekeningen)
    const atts = msg.attachments || [];
    const forwardedAttachments: ForwardedAttachment[] = atts
      .map((att, idx) => ({ att, idx }))
      .filter(({ att }) => !isInlineAttachment(att, msg.htmlBody))
      .map(({ att, idx }) => ({
        url: `/api/mail/attachment?${bq({ folder, uid: String(msg.uid), index: String(idx) })}`,
        filename: att.filename,
        contentType: att.contentType,
        size: att.size,
      }));
    setCompose({
      mode: "forward", from: activeConfig.user, to: "", cc: "", bcc: "",
      subject: msg.subject.startsWith("Fwd:") ? msg.subject : `Fwd: ${msg.subject}`,
      body: `\n\n---\n${t("webmail.forward_quote_header", { name: sender.name, email: sender.email, date: formatFullDate(msg.date) })}\n\n`,
      quoteHtml: msg.htmlBody || textBodyToHtml(msg.textBody),
      forwardedAttachments: forwardedAttachments.length > 0 ? forwardedAttachments : undefined,
    });
  }

  // Vault accounts override the old localStorage-based ImapSetup flow.
  // When vault has accounts, skip ImapSetup entirely (the vault path handles auth).
  // When vault is still loading, also skip — avoid flashing ImapSetup briefly.
  if (showSetup && !useVault && !vaultLoading) {
    return <ImapSetup config={config} folders={folders} onSave={(c) => { setConfig(c); setShowSetup(false); }} onCancel={() => setShowSetup(false)} />;
  }

  const hasSelection = !!selectedMsg;

  /** Switch to a primary/shared mailbox (null = primary). Wist een eventueel
   *  actief vault-account (wederzijds exclusief). */
  function switchAccount(acct: string | null) {
    if (acct === activeAcct && activeAccountId === null) return;
    const prefix = acct || "";
    const instId = getActiveInstanceId();
    // Vault-selectie opheffen → cache-prefix valt terug op `acct || ""`.
    setActiveAccountId(null);
    activeAccountIdRef.current = null;
    setActiveAcct(acct);
    activeAcctRef.current = acct;
    setActiveFolder("INBOX");
    activeFolderRef.current = "INBOX";
    setCurrentPage(1);
    setSelectedUid(null);
    setSelectedMsg(null);
    setSelectedUids(new Set());
    setConversationMsgs([]);
    setSubfolderMessages([]);
    setError("");

    // Optimistisch: toon de gecachte folder-lijst + INBOX van het DOEL-account
    // meteen i.p.v. de UI te blanken. De reload-useEffect (op activeAcct) ververst
    // daarna op de achtergrond. De lijst-spinner toont alleen bij messages.length
    // === 0, dus gecachte content onderdrukt 'm vanzelf → instant switch-gevoel.
    // (Eerder: setFolders([]) + setMessages([]) → blank + spinner ondanks cache.)
    try {
      const fKey = prefix ? `webmail_folders_${instId}_${prefix}` : `webmail_folders_${instId}`;
      const rawF = localStorage.getItem(fKey);
      const parsedF = rawF ? JSON.parse(rawF) : null;
      setFolders(parsedF?.folders && Array.isArray(parsedF.folders) ? parsedF.folders : []);
    } catch { setFolders([]); }

    const memKey = prefix ? `${prefix}:INBOX` : "INBOX";
    const mem = folderMsgCache.get(memKey);
    if (mem) {
      setMessages(applyRecentReadOverlay(mem.messages, "INBOX"));
      setTotal(mem.total);
    } else {
      setMessages([]);
      setTotal(0);
      // Async fallback: IndexedDB → localStorage. Race-guard op activeAcctRef
      // zodat een laat-aankomende lookup voor account A de UI niet overschrijft
      // nadat de gebruiker al naar B is geklikt.
      (async () => {
        const persisted = (await readMailFolderCacheIdb(instId, prefix, "INBOX"))
          || readMailFolderCache(instId, prefix, "INBOX");
        if (activeAcctRef.current !== acct) return; // stale
        if (persisted?.messages?.length) {
          setMessages(applyRecentReadOverlay(persisted.messages, "INBOX"));
          setTotal(persisted.total);
        }
      })();
    }
    // Config push + verse fetch gebeuren via de useEffect deps on activeAcct.
  }

  /** Switch to a vault account (eigen IMAP-login). Wist een eventueel actief
   *  gedeeld postvak (wederzijds exclusief) en herlaadt het doel-account.
   *  Spiegelt switchAccount, maar keyt op `v:<id>` en activeAccountIdRef. */
  function switchVaultAccount(id: string) {
    if (id === activeAccountId) return;
    const prefix = `v:${id}`;
    const instId = getActiveInstanceId();
    setActiveAccountId(id);
    activeAccountIdRef.current = id;
    setActiveAcct(null);
    activeAcctRef.current = null;
    setActiveFolder("INBOX");
    activeFolderRef.current = "INBOX";
    setCurrentPage(1);
    setSelectedUid(null);
    setSelectedMsg(null);
    setSelectedUids(new Set());
    setConversationMsgs([]);
    setSubfolderMessages([]);
    setError("");

    // Optimistisch: toon de gecachte folder-lijst + INBOX van het doel-account
    // meteen (instant switch-gevoel); de reload-useEffect ververst daarna.
    try {
      const rawF = localStorage.getItem(`webmail_folders_${instId}_${prefix}`);
      const parsedF = rawF ? JSON.parse(rawF) : null;
      setFolders(parsedF?.folders && Array.isArray(parsedF.folders) ? parsedF.folders : []);
    } catch { setFolders([]); }

    const mem = folderMsgCache.get(`${prefix}:INBOX`);
    if (mem) {
      setMessages(applyRecentReadOverlay(mem.messages, "INBOX"));
      setTotal(mem.total);
    } else {
      setMessages([]);
      setTotal(0);
      (async () => {
        const persisted = (await readMailFolderCacheIdb(instId, prefix, "INBOX"))
          || readMailFolderCache(instId, prefix, "INBOX");
        if (activeAccountIdRef.current !== id) return; // stale: user klikte al verder
        if (persisted?.messages?.length) {
          setMessages(applyRecentReadOverlay(persisted.messages, "INBOX"));
          setTotal(persisted.total);
        }
      })();
    }
    // Verse fetch via de reload-useEffect (deps op activeAccountId).
  }

  /** Remove a shared mailbox tab */
  function removeSharedMailbox(email: string) {
    const updated = sharedMailboxes.filter(m => m.email !== email);
    setSharedMailboxes(updated);
    saveSharedMailboxes(getActiveInstanceId(), updated);
    if (activeAcct === email) switchAccount(null);
  }

  // Gedeeld-postvak-tab + "+"-knop — hergebruikt in beide account-balk-varianten
  // (vault-modus en de klassieke primary-modus) zodat gedeelde postvakken in
  // beide bereikbaar blijven.
  const renderSharedTab = (sm: typeof sharedMailboxes[number]) => (
    <button
      key={sm.email}
      onClick={() => switchAccount(sm.email)}
      onContextMenu={(e) => {
        e.preventDefault();
        if (confirm(t("webmail.remove_shared_mailbox_confirm", { email: sm.email }))) {
          removeSharedMailbox(sm.email);
        }
      }}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
        activeAcct === sm.email
          ? "bg-blue-50 text-blue-700 border border-blue-200 border-b-white -mb-px"
          : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
      }`}
    >
      <Users size={12} />
      {sm.label || sm.email}
    </button>
  );
  const addSharedBtn = (
    <button
      onClick={() => setShowAddShared(true)}
      className="flex items-center gap-1 px-2 py-1.5 text-slate-400 hover:text-blue-600 rounded text-xs cursor-pointer"
      title={t("webmail.add_shared_mailbox")}
    >
      <Plus size={14} />
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-slate-100">
      {/* ─── Account-balk ─── */}
      {/* Eén balk: primary (ERPNext) + vault-accounts (eigen login) + gedeelde
          postvakken. De primary blijft altijd zichtbaar zodat het toevoegen van
          extra accounts puur additief is. Vault-accounts hebben hun eigen IMAP-
          creds (Settings → Email accounts); gedeelde postvakken lopen via
          delegatie van de primary (alleen zinvol bij O365/FullAccess). */}
      {!isMobile && (
        <div className="flex items-center gap-1 px-3 py-1 bg-white border-b border-slate-200 flex-shrink-0 overflow-x-auto">
          {/* Primary account tab — verborgen zodra dezelfde mailbox óók als
              vault-account bestaat (anders twee identieke tabs). Zo kun je piet
              naar de vault verhuizen zonder dubbeling, of 'm als primary laten. */}
          {config.user && !vaultAccounts.some(a => a.email?.toLowerCase() === config.user.toLowerCase()) && (
            <button
              onClick={() => switchAccount(null)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                activeAcct === null && activeAccountId === null
                  ? "bg-blue-50 text-blue-700 border border-blue-200 border-b-white -mb-px"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Mail size={12} />
              {config.user || t("webmail.primary_mailbox")}
            </button>
          )}
          {/* Vault-accounts (eigen login) — sleepbaar om de volgorde te wijzigen
              (Chrome-stijl). Native HTML5 drag-and-drop; volgorde per instance
              bewaard in localStorage. */}
          {orderedVaultAccounts.map(acc => (
            <button
              key={acc.id}
              onClick={() => switchVaultAccount(acc.id)}
              draggable
              onDragStart={(e) => { dragAccountId.current = acc.id; e.dataTransfer.effectAllowed = "move"; }}
              onDragOver={(e) => { if (dragAccountId.current && dragAccountId.current !== acc.id) e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragAccountId.current) reorderAccounts(dragAccountId.current, acc.id);
                dragAccountId.current = null;
              }}
              onDragEnd={() => { dragAccountId.current = null; }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                activeAccountId === acc.id
                  ? "bg-blue-50 text-blue-700 border border-blue-200 border-b-white -mb-px"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Mail size={12} />
              {acc.label || acc.email}
            </button>
          ))}
          {/* Gedeelde postvakken (delegatie via primary) */}
          {sharedMailboxes.map(renderSharedTab)}
          {addSharedBtn}
        </div>
      )}

      {/* ─── Mobile: compact mailbox dropdown ─── */}
      {sharedMailboxes.length > 0 && isMobile && (
        <MobileMailboxDropdown
          activeAcct={activeAcct}
          primaryLabel={config.user || t("webmail.primary_mailbox")}
          sharedMailboxes={sharedMailboxes}
          onSelect={switchAccount}
          onAdd={() => setShowAddShared(true)}
        />
      )}
      {/* Ribbon — hidden on mobile when viewing a message (actions move to bottom bar) */}
      {(!isMobile || mobilePane === "list") && <div className={`flex items-center gap-1 px-3 py-1.5 bg-white border-b border-slate-200 flex-shrink-0 ${isMobile ? "justify-between" : ""}`}>
        <button onClick={openCompose} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 cursor-pointer">
          <PenSquare size={14} /> <span className="hidden md:inline">{t("common.new")}</span>
        </button>
        <div className="w-px h-6 bg-slate-200 mx-1" />
        <button onClick={() => openReply()} disabled={!hasSelection} className="flex items-center gap-1.5 px-2.5 py-1.5 text-slate-600 rounded text-xs font-medium hover:bg-slate-100 disabled:opacity-30 disabled:cursor-default cursor-pointer">
          <Reply size={14} /> <span className="hidden md:inline">{t("webmail.reply")}</span>
        </button>
        <button onClick={() => openReplyAll()} disabled={!hasSelection} className="flex items-center gap-1.5 px-2.5 py-1.5 text-slate-600 rounded text-xs font-medium hover:bg-slate-100 disabled:opacity-30 disabled:cursor-default cursor-pointer">
          <ReplyAll size={14} /> <span className="hidden md:inline">{t("webmail.reply_all")}</span>
        </button>
        <button onClick={() => openForward()} disabled={!hasSelection} className="flex items-center gap-1.5 px-2.5 py-1.5 text-slate-600 rounded text-xs font-medium hover:bg-slate-100 disabled:opacity-30 disabled:cursor-default cursor-pointer">
          <Forward size={14} /> <span className="hidden md:inline">{t("webmail.forward")}</span>
        </button>
        <div className="w-px h-6 bg-slate-200 mx-1" />
        <button onClick={() => {
          // F05: Handle multi-select delete from ribbon
          if (selectedUids.size > 0) { handleBulkDelete(); }
          else if (selectedUid) { handleDeleteMsg(selectedUid); }
        }} disabled={!hasSelection && selectedUids.size === 0}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-slate-600 rounded text-xs font-medium hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:cursor-default cursor-pointer">
          <Trash2 size={14} /> <span className="hidden md:inline">{t("webmail.delete_btn")}</span>
        </button>
        {/* Move dropdown */}
        <div className="relative">
          <button onClick={() => setShowMoveDropdown(!showMoveDropdown)} disabled={!hasSelection && selectedUids.size === 0}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-slate-600 rounded text-xs font-medium hover:bg-slate-100 disabled:opacity-30 disabled:cursor-default cursor-pointer">
            <FolderInput size={14} /> <span className="hidden md:inline">{t("webmail.move")}</span> <ChevronDown size={10} />
          </button>
          {showMoveDropdown && (selectedUid || selectedUids.size > 0) && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50 max-h-64 overflow-y-auto">
              {/* Folders in the currently-active mailbox */}
              {folders.filter(f => f.path !== activeFolder).map(f => {
                const FIcon = getFolderIcon(f.name, f.specialUse);
                return (
                  <button key={f.path} onClick={() => {
                    // F05: Handle multi-select move from ribbon
                    if (selectedUids.size > 0) { handleBulkMove(f.path); }
                    else if (selectedUid) { handleMoveMsg(selectedUid, f.path); }
                    setShowMoveDropdown(false);
                  }}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer flex items-center gap-2">
                    <FIcon size={12} className={getFolderIconColor(f.name, f.specialUse, false)} /> {f.name}
                  </button>
                );
              })}

              {/* Cross-account targets: shared mailboxes + (if currently in
                  one) the primary account. Moves into the INBOX of the
                  target; user can re-file from there. Bulk moves are
                  intentionally not supported here yet — cross-account move
                  is per-message and awaits server confirmation. */}
              {(() => {
                const crossTargets: Array<{ acct: string | null; label: string }> = [];
                if (activeAcct !== null) {
                  // From a shared mailbox we can move back to the primary.
                  crossTargets.push({ acct: null, label: t("webmail.primary_mailbox", { defaultValue: "Hoofdpostvak" }) });
                }
                for (const sm of sharedMailboxes) {
                  if (sm.email === activeAcct) continue;
                  crossTargets.push({ acct: sm.email, label: sm.label || sm.email });
                }
                if (crossTargets.length === 0) return null;
                return (
                  <>
                    <div className="border-t border-slate-200 my-1" />
                    <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-slate-400">
                      {t("webmail.other_mailboxes", { defaultValue: "Andere mailboxen" })}
                    </div>
                    {crossTargets.map((tgt) => (
                      <button
                        key={`x:${tgt.acct ?? "__primary__"}`}
                        disabled={selectedUids.size > 0 || !selectedUid}
                        title={selectedUids.size > 0 ? t("webmail.cross_account_no_bulk", { defaultValue: "Cross-mailbox verplaatsen werkt nog niet voor meerdere berichten tegelijk" }) as string : undefined}
                        onClick={() => {
                          if (!selectedUid) return;
                          handleMoveMsgCrossAccount(selectedUid, tgt.acct, "INBOX");
                          setShowMoveDropdown(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-purple-50 hover:text-purple-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                      >
                        <Users size={12} className="text-purple-500" />
                        <span className="truncate">{tgt.label}</span>
                        <span className="text-slate-400 text-[10px] ml-auto">INBOX</span>
                      </button>
                    ))}
                  </>
                );
              })()}
            </div>
          )}
        </div>
        <button disabled={!hasSelection} className="flex items-center gap-1.5 px-2.5 py-1.5 text-slate-600 rounded text-xs font-medium hover:bg-slate-100 disabled:opacity-30 disabled:cursor-default cursor-pointer">
          <Archive size={14} /> <span className="hidden md:inline">{t("webmail.archive")}</span>
        </button>
        <button disabled={!hasSelection} className="flex items-center gap-1.5 px-2.5 py-1.5 text-slate-600 rounded text-xs font-medium hover:bg-amber-50 hover:text-amber-600 disabled:opacity-30 disabled:cursor-default cursor-pointer">
          <Star size={14} />
        </button>
        <div className="flex-1" />
        {(() => {
          const windowLabel = cacheWindowDays >= MAIL_CACHE_ALL_DAYS
            ? t("webmail.body_cache_window_all", { defaultValue: "alles" })
            : `${cacheWindowDays}d`;

          // Cache uit → toon alleen de interne lijst-warmup als die loopt.
          if (cacheWindowDays <= 0) {
            return warmupProgress ? (
              <span className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-slate-500 whitespace-nowrap"
                title={t("webmail.cache_progress_title")}>
                <Loader2 size={11} className="animate-spin" />
                <span className="hidden sm:inline">{t("webmail.cache_progress", { done: warmupProgress.done, total: warmupProgress.total })}</span>
              </span>
            ) : null;
          }

          // Cache aan → ÉÉN gecombineerde indicator: de lijst-warmup vult de
          // eerste helft van het %, de mail-inhoud (pre-fill) de tweede helft.
          if (warmupProgress || bodyCacheProgress) {
            let pct = 0;
            if (bodyCacheProgress) {
              pct = 50 + (bodyCacheProgress.folderTotal > 0
                ? Math.round((bodyCacheProgress.folderIndex / bodyCacheProgress.folderTotal) * 50) : 0);
            } else if (warmupProgress && warmupProgress.total > 0) {
              pct = Math.round((warmupProgress.done / warmupProgress.total) * 50);
            }
            pct = Math.min(99, Math.max(1, pct));
            return (
              <span className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-teal-600 whitespace-nowrap"
                title={t("webmail.body_cache_progress_title", { count: bodyCacheCount })}>
                <Loader2 size={11} className="animate-spin" />
                <span className="hidden sm:inline">{t("webmail.body_cache_progress", { window: windowLabel, pct })}</span>
              </span>
            );
          }
          if (bodyCacheSyncing) {
            return (
              <span className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-slate-400 whitespace-nowrap"
                title={t("webmail.body_cache_syncing_title")}>
                <RefreshCw size={11} className="animate-spin" />
                <span className="hidden sm:inline">{t("webmail.body_cache_syncing")}</span>
              </span>
            );
          }
          if (bodyCacheQuotaFull) {
            return (
              <span className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-amber-600 whitespace-nowrap"
                title={t("webmail.cache_full_warning")}>
                <AlertTriangle size={11} />
                <span className="hidden sm:inline">{t("webmail.body_cache_quota_full")}</span>
              </span>
            );
          }
          if (bodyCacheCount > 0) {
            return (
              <span className="flex items-center gap-1 px-2 py-1 text-[11px] text-slate-400 whitespace-nowrap"
                title={t("webmail.body_cache_done_title", { count: bodyCacheCount })}>
                <Check size={11} className="text-teal-500" />
                <span className="hidden md:inline">{t("webmail.body_cache_done", { window: windowLabel })}</span>
              </span>
            );
          }
          return null;
        })()}
        <button onClick={() => loadMessages(undefined, true)} disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-slate-500 rounded text-xs hover:bg-slate-100 cursor-pointer disabled:opacity-50">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>}

      {/* 3-pane layout (horizontal on desktop, vertical stack on mobile) */}
      <div ref={mailContainerRef} className={`flex flex-1 min-h-0 ${isMobile ? "flex-col" : ""}`}>
        {/* Folder pane — resizable & collapsible (hidden on mobile) */}
        {!isMobile && <div className="bg-slate-50 border-r border-slate-200 flex flex-col flex-shrink-0 relative overflow-x-hidden transition-[width] duration-150" style={{ width: folderCollapsed ? 48 : folderWidth }}>
          {folderCollapsed ? (
            <>
              <div className="flex items-center justify-center py-3 border-b border-slate-200">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${activeAcct ? "bg-purple-600" : "bg-blue-600"}`} title={activeConfig.user}>
                  {activeAcct ? <Users size={14} /> : <User size={14} />}
                </div>
              </div>
              <FolderTree folders={folders} activeFolder={activeFolder} onSelect={switchFolder}
                onDropMessage={(toFolder) => {
                  // F05: Handle multi-select drop
                  if (selectedUids.size > 0) { handleBulkMove(toFolder); }
                  else if (selectedUid) { handleMoveMsg(selectedUid, toFolder); }
                }}
                onCreateFolder={handleCreateFolder}
                onRenameFolder={handleRenameFolder}
                onDeleteFolder={handleDeleteFolder}
                collapsed />
              {!useVault && (
                <div className="border-t border-slate-200 flex items-center justify-center py-2">
                  <button onClick={() => setShowSetup(true)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded cursor-pointer" title={t("nav.settings")}>
                    <Settings size={14} />
                  </button>
                </div>
              )}
              <button
                onClick={() => { setFolderCollapsed(false); localStorage.setItem("webmail_folder_collapsed", "false"); }}
                className="absolute -right-3 top-3 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 cursor-pointer shadow-sm z-20"
                title={t("webmail.tt_expand_folder_pane")}
              >
                <ChevronsRight size={12} />
              </button>
            </>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${activeAcct ? "bg-purple-600" : "bg-blue-600"}`}>
                    {activeAcct ? <Users size={14} /> : <User size={14} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{activeAccountEmail.split("@")[0]}</p>
                    <p className="text-[10px] text-slate-400 truncate">{activeAccountEmail}</p>
                  </div>
                </div>
              </div>
              <FolderTree folders={folders} activeFolder={activeFolder} onSelect={switchFolder}
                onDropMessage={(toFolder) => {
                  // F05: Handle multi-select drop
                  if (selectedUids.size > 0) { handleBulkMove(toFolder); }
                  else if (selectedUid) { handleMoveMsg(selectedUid, toFolder); }
                }}
                onCreateFolder={handleCreateFolder}
                onRenameFolder={handleRenameFolder}
                onDeleteFolder={handleDeleteFolder} />
              <div className="p-2 border-t border-slate-200 flex items-center gap-1">
                {/* Bij vault-accounts is ImapSetup uitgeschakeld (creds komen uit de
                    server-vault, zie render-guard), dus deze knop opende niets →
                    dode knop. Alleen tonen voor non-vault (legacy IMAP-config). */}
                {!useVault && (
                  <button onClick={() => setShowSetup(true)} className="flex-1 flex items-center gap-2 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded cursor-pointer">
                    <Settings size={12} /> {t("webmail.settings_label")}
                  </button>
                )}
                <button
                  onClick={() => setShowAddShared(true)}
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded cursor-pointer"
                  title={t("webmail.add_shared_mailbox")}
                >
                  <Plus size={12} />
                </button>
                <button
                  onClick={() => { setFolderCollapsed(true); localStorage.setItem("webmail_folder_collapsed", "true"); }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                  title={t("webmail.tt_collapse_folder_pane")}
                >
                  <ChevronsLeft size={12} />
                </button>
              </div>
              {/* Resize handle */}
              <div
                onMouseDown={(e) => { if (e.button !== 0) return; e.preventDefault(); folderResizing.current = true; document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none"; }}
                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400/40 active:bg-blue-500/50 z-10"
              />
            </>
          )}
        </div>}

        {/* Mobile folder selector (quick switcher + button to full folder tree) */}
        {isMobile && mobilePane === "list" && (
          <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-slate-200 md:hidden w-full">
            <button onClick={() => setMobilePane("folders")} className="p-2 -ml-1 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100 flex-shrink-0" title={t("webmail.folders")}>
              <FolderOpen size={18} />
            </button>
            <select value={activeFolder} onChange={e => switchFolder(e.target.value)}
              className="flex-1 text-sm font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              {folders.filter(f => !getHiddenFolders().has(f.path)).map(f => (
                <option key={f.path} value={f.path}>
                  {f.name}{f.unseen ? ` (${f.unseen})` : ""}
                </option>
              ))}
            </select>
            {!useVault && (
              <button onClick={() => setShowSetup(true)} className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 flex-shrink-0">
                <Settings size={18} />
              </button>
            )}
          </div>
        )}

        {/* Mobile full-screen folder pane */}
        {isMobile && mobilePane === "folders" && (
          <div className="fixed inset-0 z-40 bg-white flex flex-col pt-[env(safe-area-inset-top,0px)]">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 bg-white flex-shrink-0">
              <button onClick={() => setMobilePane("list")} className="p-2 -ml-1 rounded-lg hover:bg-slate-100">
                <ChevronLeft size={20} className="text-slate-600" />
              </button>
              <span className="text-sm font-semibold text-slate-800 flex-1">{t("webmail.folders")}</span>
              {!useVault && (
                <button onClick={() => setShowSetup(true)} className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">
                  <Settings size={18} />
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              <FolderTree folders={folders} activeFolder={activeFolder} onSelect={(path) => {
                switchFolder(path);
                setMobilePane("list");
              }}
                onDropMessage={(toFolder) => {
                  if (selectedUids.size > 0) { handleBulkMove(toFolder); }
                  else if (selectedUid) { handleMoveMsg(selectedUid, toFolder); }
                }}
                onCreateFolder={handleCreateFolder}
                onRenameFolder={handleRenameFolder}
                onDeleteFolder={handleDeleteFolder} />
            </div>
          </div>
        )}

        {/* Message list pane with delete-on-hover — resizable */}
        {(!isMobile || mobilePane === "list") && <div
          className={`bg-white ${isMobile ? "flex-1" : "border-r border-slate-200 flex-shrink-0 relative"} flex flex-col`}
          style={isMobile ? undefined : { width: listWidth }}>
          <div className="px-4 py-2.5 border-b border-slate-200 flex-shrink-0 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-800">{activeFolder}</span>
                <span className="text-xs text-slate-400">{mailSearch || showUnreadOnly ? `${filteredMessages.length}/` : ""}{total}</span>
                {unreadCount > 0 && <span className="text-[10px] text-blue-600 font-medium">{t("webmail.unread_count", { count: unreadCount })}</span>}
                {(() => {
                  // Fix 4: "Shared (ERP)" stub — alleen tonen als de folder
                  // matched aan een ERPNext-project. Klik = toast met uitleg
                  // over toekomstige feature (gedeeld postvak via ERPNext
                  // Communication). Geen functionaliteit nu, alleen visuele
                  // aanwezigheid van het idee.
                  const projectMatch = matchProjectFromFolder(activeFolder, allProjects);
                  if (!projectMatch) return null;
                  return (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setToast(t("webmail.shared_inbox_future", {
                          defaultValue: `Toekomstige feature: koppel mail via ERPNext Communication aan project ${projectMatch.name} — maakt mail-verkeer zichtbaar voor alle teamleden.`,
                          project: projectMatch.name,
                        }));
                      }}
                      title={t("webmail.shared_inbox_tooltip", { defaultValue: "Toekomstige feature: gedeeld postvak per project" })}
                      className="flex items-center gap-0.5 text-slate-400 hover:text-violet-600 cursor-pointer"
                    >
                      <Users2 size={13} />
                      <FolderKanban size={13} />
                    </button>
                  );
                })()}
              </div>
              <button
                onClick={() => setShowUnreadOnly(prev => !prev)}
                title={showUnreadOnly ? t("webmail.show_all_messages") : t("webmail.show_unread_only")}
                className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                  showUnreadOnly ? "bg-blue-100 text-blue-600" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                }`}
              >
                {showUnreadOnly ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </div>
            <div className="relative mt-2">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={mailSearch}
                onChange={(e) => setMailSearch(e.target.value)}
                placeholder={t("webmail.search_placeholder")}
                className="w-full pl-8 pr-8 py-1.5 bg-slate-100 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 border-0"
              />
              {mailSearch && (
                <button onClick={() => setMailSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={12} />
                </button>
              )}
            </div>
            {/* F07: Subfolder search toggle */}
            {getSubfolderPaths().length > 0 && (
              <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={searchSubfolders}
                  onChange={(e) => setSearchSubfolders(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-y-teal accent-[#45B6A8]"
                />
                <span className="text-[11px] text-slate-500">{t("webmail.search_subfolders")}</span>
                {loadingSubfolders && <span className="text-[10px] text-slate-400 ml-1">...</span>}
              </label>
            )}
          </div>
          {error && messages.length > 0 && <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-xs text-red-600">{error}</div>}
          {/* F05: Bulk action bar */}
          {selectedUids.size > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 border-b border-violet-200 flex-shrink-0">
              <input
                type="checkbox"
                checked={selectedUids.size === filteredMessages.length && filteredMessages.length > 0}
                ref={(el) => { if (el) el.indeterminate = selectedUids.size > 0 && selectedUids.size < filteredMessages.length; }}
                onChange={handleSelectAll}
                className="w-3.5 h-3.5 rounded border-slate-300 text-violet-600 cursor-pointer"
              />
              <span className="text-xs text-violet-700 font-medium">
                {t("webmail.n_selected", { count: selectedUids.size })}
              </span>
              <div className="flex-1" />
              <div className="relative" ref={bulkMoveDropdownRef}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowBulkMoveDropdown(!showBulkMoveDropdown);
                  }}
                  className="text-xs px-3 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer flex items-center gap-1.5"
                >
                  <FolderInput size={12} /> {t("webmail.move")} <ChevronDown size={10} />
                </button>
                {showBulkMoveDropdown && (() => {
                  const q = bulkMoveSearch.trim().toLowerCase();
                  const filtered = folders
                    .filter(f => f.path !== activeFolder)
                    .filter(f => !q || f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q));
                  return (
                    <div className="absolute top-full left-0 mt-1 w-72 bg-white rounded-lg shadow-lg border border-slate-200 z-[100] flex flex-col max-h-80">
                      <div className="p-2 border-b border-slate-100">
                        <input
                          type="search"
                          autoFocus
                          value={bulkMoveSearch}
                          onChange={(e) => setBulkMoveSearch(e.target.value)}
                          placeholder={t("webmail.search_folders", { defaultValue: "Zoek mappen..." })}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </div>
                      <div className="flex-1 overflow-y-auto py-1">
                        {folders.length === 0 ? (
                          <p className="text-xs text-slate-400 italic px-3 py-2">{t("common.loading")}</p>
                        ) : filtered.length === 0 ? (
                          <p className="text-xs text-slate-400 italic px-3 py-2">
                            {t("webmail.no_folder_matches", { defaultValue: "Geen mappen gevonden" })}
                          </p>
                        ) : filtered.map(f => {
                          const FIcon = getFolderIcon(f.name, f.specialUse);
                          return (
                            <button key={f.path} onClick={() => { handleBulkMove(f.path); setShowBulkMoveDropdown(false); setBulkMoveSearch(""); }}
                              className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer flex items-center gap-2">
                              <FIcon size={12} className={getFolderIconColor(f.name, f.specialUse, false)} /> {f.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
              <button
                onClick={openSortModal}
                title={t("webmail.sort_to_project.button_tooltip")}
                className="text-xs px-3 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer flex items-center gap-1.5"
              >
                <FolderKanban size={12} /> {t("webmail.sort_to_project.button")}
              </button>
              <button
                onClick={handleBulkDelete}
                className="text-xs px-3 py-1 bg-red-50 border border-red-200 text-red-600 rounded-lg hover:bg-red-100 cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={12} /> {t("webmail.delete_btn")}
              </button>
              <button
                onClick={() => { setSelectedUids(new Set()); lastClickedUid.current = null; }}
                className="text-xs px-2 py-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                title={t("webmail.clear_selection")}
              >
                <X size={14} />
              </button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {loading && messages.length === 0 && (
              <div className="p-8 text-center">
                <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                  <Loader2 size={16} className="animate-spin" /> {t("webmail.loading_email")}
                </div>
                {slowLoading && (
                  <div className="mx-auto mt-4 max-w-sm flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs text-amber-700">
                    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                    <span>{t("common.slow_loading_warning")}</span>
                  </div>
                )}
              </div>
            )}
            {!loading && messages.length === 0 && error && (
              <div className="m-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-700">{t("webmail.load_failed")}</p>
                <p className="mt-1 text-xs text-red-600 break-words">{error}</p>
                <button
                  onClick={() => { loadMessages(undefined, true); loadFolders(); }}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-300 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100 cursor-pointer">
                  <RefreshCw size={12} /> {t("webmail.retry")}
                </button>
              </div>
            )}
            {!loading && filteredMessages.length === 0 && !error && (
              <div className="p-8 text-center text-sm text-slate-400">
                {mailSearch ? t("webmail.no_results") : t("webmail.no_messages")}
              </div>
            )}
            {(() => {
              let lastGroup = "";
              return filteredMessages.map((msg) => {
                const isSelected = selectedUid === msg.uid;
                const msgFolder = msg._folder || activeFolder;
                // In Verzonden / sub-folders daarvan: toon de ontvanger i.p.v.
                // de afzender (die ben je zelf).
                const showAsSent = isSentContext(msgFolder, folders);
                const primaryAddr = showAsSent && msg.to.length > 0 ? msg.to : msg.from;
                const sender = formatSender(primaryAddr);
                const displayName = showAsSent
                  ? (formatAddress(msg.to) || sender.name)
                  : sender.name;
                const catId = categories[`${msgFolder}:${msg.uid}`];
                const cat = catId ? EMAIL_CATEGORIES.find(c => c.id === catId) : null;
                const group = getDateGroup(msg.date);
                const showHeader = group !== lastGroup;
                lastGroup = group;
                const isCollapsed = collapsedGroups.has(group);
                const groupCount = showHeader ? filteredMessages.filter(m => getDateGroup(m.date) === group).length : 0;
                return (
                  <div key={msg._folder ? `${msg._folder}:${msg.uid}` : msg.uid}>
                    {showHeader && (
                      <button
                        onClick={() => setCollapsedGroups(prev => {
                          const next = new Set(prev);
                          if (next.has(group)) next.delete(group); else next.add(group);
                          try {
                            const key = `webmail_collapsed_${getActiveInstanceId()}_${activeFolder}`;
                            localStorage.setItem(key, JSON.stringify([...next]));
                          } catch { /* ignore */ }
                          return next;
                        })}
                        className="sticky top-0 z-10 w-full flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
                      >
                        {isCollapsed ? <ChevronRight size={12} className="text-slate-400" /> : <ChevronDown size={12} className="text-slate-400" />}
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{group}</span>
                        <span className="text-[10px] text-slate-400 ml-1">{groupCount}</span>
                      </button>
                    )}
                    {!isCollapsed && <div draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/x-mail-uid", String(msg.uid));
                        e.dataTransfer.effectAllowed = "move";
                        // F05: Include all selected UIDs for multi-select drag
                        if (selectedUids.size > 1 && selectedUids.has(msg.uid)) {
                          e.dataTransfer.setData("text/x-mail-uids", JSON.stringify([...selectedUids]));
                        }
                        setSelectedUid(msg.uid);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setEmailContextMenu({ x: e.clientX, y: e.clientY, uid: msg.uid });
                        setSelectedUid(msg.uid);
                      }}
                      className={`group relative border-b border-slate-100 transition-colors ${
                      selectedUids.has(msg.uid) ? "bg-violet-50 border-l-2 border-l-violet-500"
                      : isSelected ? "bg-blue-100 border-l-4 border-l-blue-600"
                      : !msg.seen ? "bg-white border-l-2 border-l-blue-400 hover:bg-slate-50"
                      : "border-l-2 border-l-transparent hover:bg-slate-50"
                    }`}>
                      <div className="flex items-start">
                        <button
                          onClick={(e) => {
                            if (e.shiftKey) {
                              e.preventDefault();
                              handleSelectEmail(msg.uid, e);
                              return;
                            }
                            if (e.ctrlKey || e.metaKey) {
                              e.preventDefault();
                              handleSelectEmail(msg.uid, e);
                              return;
                            }
                            // Direct openMessage — geen 250ms wachttijd meer.
                            // Originele code wachtte op dblclick-detectie zodat
                            // dblclick-popout kon onderscheppen voordat
                            // openMessage `loadingMsg=true` zette en de button
                            // disabled werd. Maar `disabled` is allang weg uit
                            // het button-element; de dblclick-handler kan
                            // gewoon parallel afvuren (browser stuurt eerst 2
                            // click-events en dan 1 dblclick — onze handler
                            // opent dan de popout-tab terwijl het preview-paneel
                            // links al laadt). Resultaat: typische klik wordt
                            // 250ms sneller (was de grootste post-cache-HIT
                            // wig in mail-open latency).
                            lastClickedUid.current = msg.uid;
                            setSelectedUids(new Set());
                            openMessage(msg);
                          }}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // Cancel pending single-click open: we doen popout i.p.v. preview.
                            if (mailClickTimer.current !== null) {
                              window.clearTimeout(mailClickTimer.current);
                              mailClickTimer.current = null;
                            }
                            // Open de standalone mail-view in een echt nieuw
                            // browser-tabblad. Gedeelde logica met de popout-knop
                            // in het leespaneel (zie popoutMail).
                            popoutMail(msg.uid, msg._folder || activeFolder, msg.subject || "Y-app — mail");
                          }}
                          title={t("webmail.dblclick_to_popout", "Dubbelklik om in nieuw tabblad te openen")}
                          className={`flex-1 min-w-0 text-left pl-5 pr-10 ${isMobile ? "py-3.5" : "py-2.5"} cursor-pointer ${loadingMsg ? "opacity-70" : ""}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              {cat && <span className={`w-2 h-2 rounded-full ${cat.color} flex-shrink-0`} title={t(cat.nameKey)} />}
                              <span className={`text-sm truncate ${!msg.seen ? "font-semibold text-slate-900" : "text-slate-700"}`}>{displayName}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {repliedMap[`${msgFolder}:${msg.uid}`] && <span title={t("webmail.replied")}><Reply size={11} className="text-green-500" /></span>}
                              {(() => {
                                // Server-flag msg.hasAttachments wordt door
                                // pre-deploy productie nog true gegeven voor
                                // mails met alleen inline sig-CIDs. Als we
                                // de full-msg al gecachet hebben kunnen we
                                // de echte staat afleiden en de paperclip
                                // verbergen bij sig-only mails.
                                if (!msg.hasAttachments) return null;
                                const cached = fullMsgCache.get(fmKey(msgFolder, msg.uid));
                                if (cached && cached.attachments) {
                                  const hasReal = cached.attachments.some(
                                    a => !isInlineAttachment(a, cached.htmlBody),
                                  );
                                  if (!hasReal) return null;
                                }
                                return <Paperclip size={11} className="text-slate-400" />;
                              })()}
                              {msg.flagged && <Star size={11} className="text-amber-400 fill-amber-400" />}
                              <span className="text-[11px] text-slate-400">{formatDate(msg.date)}</span>
                            </div>
                          </div>
                          <p className={`text-xs truncate mt-0.5 ${!msg.seen ? "font-medium text-slate-800" : "text-slate-500"}`}>
                            {msg.subject || t("webmail.no_subject")}
                          </p>
                          {msg._folder && (
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">
                              {msg._folder.split("/").pop() || msg._folder.split(".").pop() || msg._folder}
                            </p>
                          )}
                        </button>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteMsg(msg.uid); }}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-red-100 text-slate-400 hover:text-red-600 transition-opacity cursor-pointer ${isMobile ? "opacity-70" : "opacity-0 group-hover:opacity-100"}`}
                        title={t("common.delete_tooltip")}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>}
                  </div>
                );
              });
            })()}
            {messages.length < total && (
              <button
                onClick={() => {
                  const next = currentPage + 1;
                  setCurrentPage(next);
                  loadMessages(undefined, false, next);
                }}
                disabled={loadingMore}
                className="w-full py-3 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors border-t border-slate-100 cursor-pointer flex items-center justify-center gap-2"
              >
                {loadingMore ? (
                  <><Loader2 size={14} className="animate-spin" /> {t("webmail.loading_message")}</>
                ) : (
                  <>{t("webmail.load_more")} ({messages.length} / {total})</>
                )}
              </button>
            )}
            {/* Email context menu */}
            {emailContextMenu && (
              <div className="fixed bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50 min-w-[180px]"
                style={{ left: Math.min(emailContextMenu.x, window.innerWidth - 200), top: Math.min(emailContextMenu.y, window.innerHeight - 300) }}>
                {(() => {
                  const ctxMsg = messages.find(m => m.uid === emailContextMenu.uid);
                  return ctxMsg?.seen ? (
                    <button onClick={() => { handleMarkUnread(emailContextMenu.uid); setEmailContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer flex items-center gap-2">
                      <EyeOff size={12} /> {t("webmail.mark_unread")}
                    </button>
                  ) : (
                    <button onClick={() => { handleMarkRead(emailContextMenu.uid); setEmailContextMenu(null); }}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer flex items-center gap-2">
                      <Eye size={12} /> {t("webmail.mark_read")}
                    </button>
                  );
                })()}
                <div className="border-t border-slate-100 my-0.5" />
                <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase">{t("webmail.category")}</div>
                {EMAIL_CATEGORIES.map(c => {
                  const isActive = categories[`${activeFolder}:${emailContextMenu.uid}`] === c.id;
                  return (
                    <button key={c.id} onClick={() => {
                      const key = `${activeFolder}:${emailContextMenu.uid}`;
                      if (isActive) {
                        setCategoryForMessage(activeFolder, emailContextMenu.uid, null);
                        setCategories(prev => { const n = { ...prev }; delete n[key]; return n; });
                      } else {
                        setCategoryForMessage(activeFolder, emailContextMenu.uid, c.id);
                        setCategories(prev => ({ ...prev, [key]: c.id }));
                      }
                      setEmailContextMenu(null);
                    }}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${c.color}`} />
                      {t(c.nameKey)}
                      {isActive && <Check size={12} className="ml-auto text-blue-600" />}
                    </button>
                  );
                })}
                {categories[`${activeFolder}:${emailContextMenu.uid}`] && (
                  <button onClick={() => {
                    setCategoryForMessage(activeFolder, emailContextMenu.uid, null);
                    setCategories(prev => { const n = { ...prev }; delete n[`${activeFolder}:${emailContextMenu.uid}`]; return n; });
                    setEmailContextMenu(null);
                  }}
                    className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 cursor-pointer flex items-center gap-2">
                    <X size={12} /> {t("webmail.remove_category")}
                  </button>
                )}
              </div>
            )}
          </div>
          {/* List resize handle */}
          {!isMobile && <div
            onMouseDown={(e) => { if (e.button !== 0) return; e.preventDefault(); listResizing.current = true; document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none"; }}
            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400/40 active:bg-blue-500/50 z-10"
          />}
        </div>}

        {/* Reading pane */}
        {(!isMobile || mobilePane === "message") && (
          <div className={isMobile ? "fixed inset-0 z-40 bg-white flex flex-col pt-[env(safe-area-inset-top,0px)]" : "flex-1 flex flex-col"}>
            {isMobile && (
              <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 bg-white flex-shrink-0">
                <button onClick={() => { setMobilePane("list"); setSelectedMsg(null); setSelectedUid(null); }}
                  className="p-2 -ml-1 rounded-lg hover:bg-slate-100">
                  <ChevronRight size={20} className="rotate-180 text-slate-600" />
                </button>
                <span className="text-sm font-medium text-slate-800 truncate flex-1">{selectedMsg?.subject || ""}</span>
              </div>
            )}
            {compose && !isMobile && !composeFloating ? (
              // Nieuwe mail / beantwoorden verschijnt INLINE in het leespaneel
              // (geen zwevend sleepbaar popup-venster meer). Op mobiel blijft
              // het de full-screen overlay hieronder. De popout-knop zet
              // composeFloating → het concept verhuist naar een eigen zwevend
              // venster (hieronder gerenderd) en het leespaneel komt weer vrij.
              <ComposeWindow inline compose={compose} onClose={() => setCompose(null)}
                onSendBackground={handleBackgroundSend} config={activeConfig}
                onPopout={() => setComposeFloating(true)} />
            ) : loadingMsg ? (
              // Toon de spinner zodra een mail laadt — óók als er nog een vorige
              // mail in beeld stond. Anders bleef de oude mail zichtbaar tijdens
              // het laden ("ik zie niet dat er wat geladen wordt / ik zie de
              // oude"). Cache-hits (in-memory/IDB) zetten loadingMsg niet, dus
              // die openen nog steeds zonder spinner-flits.
              <div className="flex-1 flex items-center justify-center bg-slate-50/50">
                <div className="text-center text-slate-400">
                  <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-blue-500" />
                  <p className="text-sm">{t("webmail.loading_message")}</p>
                </div>
              </div>
            ) : (
              <ReadingPane message={selectedMsg} onReply={() => openReply()} onReplyAll={() => openReplyAll()} onForward={() => openForward()}
                onPopout={selectedUid ? () => popoutMail(selectedUid, activeFolder, selectedMsg?.subject) : undefined}
                onDelete={() => selectedUid && handleDeleteMsg(selectedUid)}
                onOpenAttachment={(idx) => selectedUid && openAttachment(selectedUid, idx)}
                onDownloadAttachment={(idx) => selectedUid && downloadAttachment(selectedUid, idx)}
                onDownloadAll={() => selectedUid && downloadAllAttachments(selectedUid)}
                onSaveToNextCloud={(idx) => selectedUid && saveAttachmentToNextCloud(selectedUid, idx)}
                onSaveAllToNextCloud={() => selectedUid && saveAllAttachmentsToNextCloud(selectedUid)}
                ncSaving={ncSaving}
                onSaveToNas={() => setSaveToNasOpen(true)}
                currentFolder={activeFolder}
                accountEmail={activeAccountEmail || ""}
                conversationMessages={conversationMsgs}
                loadingConversation={loadingConversation}
                onOpenThreadMessage={(m) => {
                  // Click op een thread-blokje opent die mail. Server-resultaten
                  // hebben een `folder` veld (kan andere folder zijn dan activeFolder).
                  const targetFolder = m.folder || activeFolder;
                  if (targetFolder !== activeFolder) {
                    switchFolder(targetFolder);
                  }
                  openMessage({ ...m, _folder: targetFolder } as MailMessage);
                }}
                onFollowUp={(action) => {
                  if (!selectedMsg) return;
                  const inst = getActiveInstance();
                  if (!inst?.url) { setToast(t("webmail.erpnext_url_unavailable")); return; }

                  const subject = selectedMsg.subject || "";
                  const senderName = selectedMsg.from?.[0]?.name || selectedMsg.from?.[0]?.address || "";
                  const senderEmail = selectedMsg.from?.[0]?.address || "";
                  const bodyPreview = (selectedMsg.textBody || "").slice(0, 500);

                  switch (action) {
                    case "task": {
                      const p = new URLSearchParams();
                      p.set("subject", subject);
                      if (bodyPreview) p.set("description", `${t("webmail.from_prefix")}: ${senderName} <${senderEmail}>\n${t("webmail.subject_prefix")}: ${subject}\n\n${bodyPreview}`);
                      window.open(`${inst.url}/app/task/new?${p}`, "_blank");
                      break;
                    }
                    case "quotation": {
                      const p = new URLSearchParams();
                      if (subject) p.set("title", subject);
                      if (senderName) p.set("party_name", senderName);
                      window.open(`${inst.url}/app/quotation/new?${p}`, "_blank");
                      break;
                    }
                    case "project": {
                      // Open the in-app project sidebar instead of redirecting to
                      // ERPNext. Customer hint = sender name; Projects.tsx tries
                      // an exact match against Customer.name / customer_name once
                      // its list loads, otherwise it leaves the hint in the
                      // customer search box for the user to refine.
                      const p = new URLSearchParams();
                      p.set("create", "1");
                      if (senderName) p.set("customer", senderName);
                      navigate(`/projects?${p.toString()}`);
                      break;
                    }
                    case "purchase-invoice": {
                      const p = new URLSearchParams();
                      if (subject) p.set("bill_no", subject);
                      window.open(`${inst.url}/app/purchase-invoice/new?${p}`, "_blank");
                      break;
                    }
                  }
                }} />
            )}
          </div>
        )}
      </div>

      {/* Attachment preview loading */}
      {attachPreviewLoading && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative flex items-center gap-3 bg-white rounded-xl px-6 py-4 shadow-xl">
            <Loader2 className="animate-spin text-blue-500" size={20} />
            <span className="text-sm text-slate-600">{t("webmail.loading_attachment", "Loading attachment...")}</span>
          </div>
        </div>
      )}

      {/* Attachment preview panel */}
      {attachPreview && (
        <div className="fixed inset-0 z-[55] flex pt-[env(safe-area-inset-top,0px)]">
          <div className="absolute inset-0 bg-black/40" onClick={closeAttachPreview} />
          <div className="relative ml-auto w-full md:w-[55%] max-w-[800px] h-full bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {attachPreview.contentType.startsWith("image/") ? <FileImage size={16} className="text-green-500 shrink-0" /> :
                 attachPreview.contentType === "application/pdf" ? <FileText size={16} className="text-red-500 shrink-0" /> :
                 <File size={16} className="text-slate-400 shrink-0" />}
                <span className="text-sm font-medium text-slate-700 truncate">{attachPreview.filename}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a href={attachPreview.url} download={attachPreview.filename}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 cursor-pointer">
                  <ExternalLink size={12} /> {t("webmail.download")}
                </a>
                <button onClick={closeAttachPreview} className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer rounded hover:bg-slate-200">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 flex items-center justify-center p-4">
              {attachPreview.contentType.startsWith("image/") ? (
                <img src={attachPreview.url} alt={attachPreview.filename} className="max-w-full max-h-full object-contain rounded shadow-lg" />
              ) : attachPreview.contentType === "application/pdf" ? (
                // #view=FitH: open de pagina meteen passend op de smalle preview-
                // panel i.p.v. een ongunstige zoom. De volledige native werkbalk
                // (roteren, zoom, zoeken, print, download) blijft bewust behouden.
                <iframe src={`${attachPreview.url}#view=FitH`} className="w-full h-full border-0 rounded shadow-lg bg-white" title={attachPreview.filename} />
              ) : (
                <iframe src={attachPreview.url} className="w-full h-full border-0 rounded shadow-lg bg-white font-mono text-sm" title={attachPreview.filename} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Compose — alleen op mobiel als full-screen overlay. Op desktop
          rendert compose INLINE in de leespaneel-kolom (zie hierboven), geen
          zwevend/sleepbaar popup-venster meer. */}
      {compose && isMobile && (
        <ComposeWindow compose={compose} onClose={() => {
          setCompose(null);
          if (mobilePane === "compose") setMobilePane(selectedMsg ? "message" : "list");
        }} onSendBackground={handleBackgroundSend} config={activeConfig} />
      )}

      {/* Bug #3: uit-gepopoute concept — zwevend/sleepbaar eigen venster naast
          het (weer vrijgekomen) leespaneel. Hergebruikt ComposeWindow niet-inline. */}
      {compose && !isMobile && composeFloating && (
        <ComposeWindow compose={compose} onClose={() => { setCompose(null); setComposeFloating(false); }}
          onSendBackground={handleBackgroundSend} config={activeConfig} />
      )}

      {/* Floating mail windows — geopend via dubbelklik. Blijven bovenop de UI
          staan zodat je in het achterliggende lees-paneel door kunt bladeren. */}
      {floatingMails.map((f, idx) => (
        <FloatingMailWindow key={f.id}
          offsetIndex={idx}
          msg={f.msg}
          folder={f.folder}
          onClose={() => closeFloatingMail(f.id)}
          onReply={() => openReply(f.msg, f.folder)}
          onReplyAll={() => openReplyAll(f.msg, f.folder)}
          onForward={() => openForward(f.msg)}
        />
      ))}

      {/* F06: Create folder modal */}
      {createFolderParent !== null && (
        <CreateFolderModal
          parentPath={createFolderParent}
          projects={allProjects}
          onConfirm={submitCreateFolder}
          onCancel={() => setCreateFolderParent(null)}
        />
      )}

      {/* "Sorteer in projectmap" reviewscherm */}
      <SortToProjectDialog
        open={showSortModal}
        onClose={() => setShowSortModal(false)}
        proposals={sortProposals}
        folders={folders}
        onConfirm={handleSortConfirm}
      />

      {/* Add shared mailbox dialog */}
      {showAddShared && (
        <AddSharedMailboxDialog
          primaryEmail={config.user || ""}
          onAdd={(email, label, effectiveUser) => {
            const updated = [...sharedMailboxes, { email, label, effectiveUser }];
            setSharedMailboxes(updated);
            saveSharedMailboxes(getActiveInstanceId(), updated);
            setShowAddShared(false);
            setToast(t("webmail.shared_added", { email }));
          }}
          onCancel={() => setShowAddShared(false)}
          existingEmails={[config.user, ...sharedMailboxes.map(m => m.email)]}
        />
      )}

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] animate-fade-in">
          <div className={`flex items-center gap-2.5 px-5 py-3 rounded-xl shadow-lg ${TOAST_ERROR_RE.test(toast) ? "bg-red-700 text-white" : "bg-slate-800 text-white"}`}>
            {TOAST_LOADING_RE.test(toast) ? (
              <Loader2 size={16} className="text-blue-300 animate-spin" />
            ) : TOAST_ERROR_RE.test(toast) ? (
              <X size={16} className="text-red-300" />
            ) : (
              <Check size={16} className="text-green-400" />
            )}
            <span className="text-sm font-medium">{toast}</span>
          </div>
        </div>
      )}

      {/* Save-to-NAS dialog */}
      <SaveToNasDialog
        open={saveToNasOpen}
        onClose={() => setSaveToNasOpen(false)}
        instanceId={getActiveInstanceId()}
        subject={selectedMsg?.subject || ""}
        from={selectedMsg?.from?.[0]?.name || selectedMsg?.from?.[0]?.address}
        attachments={saveToNasAttachments}
        fetchAttachmentBytes={fetchAttachmentBytesForNas}
        onToast={setToast}
        linkedProjectName={
          selectedMsg
            ? getEmailProjectLinks()[`${selectedMsg.uid}:${selectedMsg.subject}`] || undefined
            : undefined
        }
        currentFolder={activeFolder}
      />
    </div>
  );
}
