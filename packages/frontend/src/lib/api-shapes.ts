/**
 * Fase 5 — gedeelde response-envelope-types (drift-safety, Deliverable D).
 *
 * Eén bron van waarheid voor de wire-shapes die op DRIE plekken identiek
 * moeten zijn: de Express-server-handlers (web), de desktop fetch-adapter
 * (die dezelfde envelopes met de hand nabouwt) en de frontend-consumers.
 * Vóór dit bestand waren die shapes ~150× hand-gekopieerd in
 * packages/desktop/src/adapter/fetch.ts en faalde drift stil.
 *
 * Gebruik:
 *  - Server: `import type { … } from "../../frontend/src/lib/api-shapes.ts"`
 *    en `res.json(payload satisfies MailFoldersResponse)` — type-only, wordt
 *    door esbuild/tsx weggestript, nul runtime-wijziging.
 *  - Desktop-adapter: `jsonResponse<MailFoldersResponse>(…)` + getypte
 *    `invoke<…>`-aanroepen.
 *  - De Rust-kant kan niet meecompileren; de structs zijn per shape
 *    gedocumenteerd (serde camelCase) en driftgevoelige velden worden door
 *    de parity-tests in desktop-parity.test.ts bewaakt.
 *
 * REGELS voor dit bestand (bewust):
 *  - Puur type-declaraties. Nul imports, nul runtime-code, geen DOM-types —
 *    de server-tsc-baseline (25 echte fouten) mag hierdoor niet verschuiven.
 *  - Uitbreiden per domein ("gefaseerd"): mail + messenger eerst (hoogste
 *    drift-risico). Overige domeinen (settings, instances, calendar, stats)
 *    volgen in eigen slices.
 */

/* ─── Generieke envelopes ─── */

/** `{ ok: true }` — bevestiging zonder payload (moves, marks, deletes). */
export interface ApiOk {
  ok: true;
}

/** `{ error }` — foutenvelope; statuscode draagt de ernst. */
export interface ApiError {
  error: string;
}

/** `{ data: T }` — de standaard lees-envelope van de meeste GET-routes. */
export interface ApiData<T> {
  data: T;
}

/** `{ ok: true, value: T }` — de settings-envelope (instance_settings). */
export interface ApiValue<T> {
  ok: true;
  value: T;
}

/* ─── Mail ─── */

/**
 * Eén IMAP-map zoals de folder-list 'm levert.
 * Server: `CachedFolder` in packages/server/src/mail.ts.
 * Desktop: Rust `FolderInfo` in packages/desktop/src-tauri/src/mail.rs
 * (serde rename_all = "camelCase") — veldnamen zijn 1-op-1 gelijk.
 */
export interface MailFolderShape {
  path: string;
  name: string;
  delimiter: string;
  flags: string[];
  specialUse: string | null;
  listed: boolean;
  messages: number | null;
  unseen: number | null;
}

/** GET /api/mail/folders */
export type MailFoldersResponse = ApiData<MailFolderShape[]>;

/** Eén regel uit de unseen-summary (alleen path + unseen, minimaal payload). */
export interface UnseenFolderShape {
  path: string;
  unseen: number;
}

/**
 * GET /api/mail/unseen-summary — gepolt door BackgroundSyncProvider (web) en
 * useDesktopMailNotifications (desktop) voor badge + notificatie-delta.
 */
export type MailUnseenSummaryResponse = ApiData<{
  folders: UnseenFolderShape[];
  total: number;
}>;

/* ─── Messenger ─── */

/**
 * Eén conversatie in de lijst.
 * Server: `Conversation` in packages/server/src/messenger/types.ts.
 * Desktop: Rust `Conversation` in packages/desktop/src-tauri/src/messenger.rs
 * (serde-renames naar dezelfde camelCase-namen; `pinned` is daar verplicht —
 * verplicht ⊂ optioneel, dus wire-compatibel).
 */
export interface MessengerConversationShape {
  id: string;
  name: string;
  lastMessage: string;
  lastMessageTime: string;
  /** Raw NC id of the newest message — used by the client read-overlay. */
  lastMessageId?: number;
  unreadCount: number;
  participants: number;
  type: string; // "one-to-one" | "group" | "public" | "bot"
  avatar?: string;
  platform: string;
  pinned?: boolean;
}

/**
 * GET /api/messenger/conversations + /api/messenger/all-conversations.
 * `cached: true` markeert een respons uit de server-side conversatie-cache.
 */
export type MessengerConversationsResponse = ApiData<MessengerConversationShape[]> & {
  cached?: boolean;
};

export interface MessengerReactionShape {
  emoji: string;
  count: number;
  userReacted: boolean;
}

/**
 * Eén chat-bericht. Server: `Message` in packages/server/src/messenger/types.ts;
 * desktop-Rust spiegelt dezelfde velden (zie CLAUDE.md "Messenger on desktop").
 */
export interface MessengerMessageShape {
  id: string;
  text: string;
  sender: string;
  senderDisplayName: string;
  timestamp: string;
  isOwn: boolean;
  platform: string;
  messageType?: string;
  reactions?: MessengerReactionShape[];
  attachments?: Array<{
    id: string;
    name: string;
    mimetype: string;
    size: number;
    link: string;
    previewUrl?: string;
  }>;
  parent?: {
    id: string;
    text: string;
    sender: string;
  };
  lastEditTimestamp?: number;
  deleted?: boolean;
}

/**
 * GET /api/messenger/messages — `lastGivenId` is de long-poll-cursor (max raw
 * NC-id incl. door de noise-filter gestripte rijen; zie CLAUDE.md "Messenger
 * long-poll cursor").
 */
export type MessengerMessagesResponse = ApiData<MessengerMessageShape[]> & {
  hasMore?: boolean;
  lastGivenId?: number;
};
