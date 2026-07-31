/* ─── NextCloud Talk helpers ─── */

import { isVisibleMessage } from "./noise-filter.ts";
import type { Conversation, Message, Reaction } from "./types.ts";

// NC `/core/preview` dimensions. The chat bubble shows a small thumbnail; the
// lightbox / click-to-open must show the image at (near-)native resolution.
// NC never upscales, so requesting a large box returns the original size
// capped at the server's preview_max (default 4096) — i.e. true dimensions for
// virtually every screenshot/photo shared in Talk.
const NC_PREVIEW_THUMB_PX = 200;
const NC_PREVIEW_FULL_PX = 3840;

// NC username (uid) is niet altijd gelijk aan de login (b.v. login = email,
// uid = "piet.mol"). Cache de echte uid per (ncUrl, user) zodat we de
// isOwn-check robuust kunnen doen.
const ncUidCache = new Map<string, { uid: string; ts: number }>();
const NC_UID_TTL = 60 * 60_000;

async function ncResolveUid(ncUrl: string, user: string, pass: string): Promise<string> {
  const cacheKey = `${ncUrl}|${user}`;
  const cached = ncUidCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < NC_UID_TTL) return cached.uid;
  try {
    const resp = await fetch(`${ncUrl}/ocs/v1.php/cloud/user?format=json`, {
      headers: {
        "OCS-APIRequest": "true",
        Authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64"),
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });
    const json = await resp.json();
    const uid = json?.ocs?.data?.id || user;
    ncUidCache.set(cacheKey, { uid, ts: Date.now() });
    return uid;
  } catch {
    return user;
  }
}

export async function ncTalkRequest(
  ncUrl: string,
  user: string,
  pass: string,
  path: string,
  method: string = "GET",
  body?: string,
  timeoutMs: number = 10_000,
): Promise<{ status: number; data: any }> {
  const url = `${ncUrl}${path}`;
  const headers: Record<string, string> = {
    "OCS-APIRequest": "true",
    Authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64"),
    Accept: "application/json",
  };
  if (body) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }
  const resp = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(timeoutMs) });
  const json = await resp.json();
  return { status: resp.status, data: json };
}

export function ncConversationTypeLabel(type: number): string {
  switch (type) {
    case 1: return "one-to-one";
    case 2: return "group";
    case 3: return "public";
    case 4: return "changelog";
    default: return "unknown";
  }
}

export async function ncListConversations(ncUrl: string, user: string, pass: string): Promise<Conversation[]> {
  const result = await ncTalkRequest(
    ncUrl, user, pass,
    "/ocs/v2.php/apps/spreed/api/v4/room?format=json"
  );
  const rooms = result.data?.ocs?.data || [];
  return rooms.map((r: any) => ({
    id: r.token,
    name: r.displayName || r.name || "Gesprek",
    lastMessage: r.lastMessage?.message || "",
    lastMessageTime: r.lastMessage?.timestamp
      ? new Date(r.lastMessage.timestamp * 1000).toISOString()
      : "",
    lastMessageId: typeof r.lastMessage?.id === "number" ? r.lastMessage.id : undefined,
    unreadCount: r.unreadMessages || 0,
    participants: r.participantCount || 0,
    type: ncConversationTypeLabel(r.type),
    platform: "nextcloud-talk",
    pinned: !!r.isFavorite,
  }));
}

export async function ncGetMessages(
  ncUrl: string, user: string, pass: string, token: string,
  options?: { limit?: number; lastKnownMessageId?: number; lookIntoFuture?: boolean; timeoutSeconds?: number }
): Promise<{ messages: Message[]; hasMore: boolean; lastGivenId?: number }> {
  const myUid = await ncResolveUid(ncUrl, user, pass);
  const limit = options?.limit || 20;
  const lookIntoFuture = options?.lookIntoFuture ? 1 : 0;
  // NextCloud Talk requires lastKnownMessageId when lookIntoFuture=1 so it
  // knows which messages are "new". With lookIntoFuture=0 the param is
  // optional (acts as an offset).
  const timeoutSeconds = options?.timeoutSeconds ?? (lookIntoFuture === 1 ? 30 : 0);
  let apiUrl = `/ocs/v2.php/apps/spreed/api/v1/chat/${encodeURIComponent(token)}?lookIntoFuture=${lookIntoFuture}&limit=${limit}&includeLastKnown=0&timeout=${timeoutSeconds}`;
  if (options?.lastKnownMessageId) {
    apiUrl += `&lastKnownMessageId=${options.lastKnownMessageId}`;
  }
  // For long-poll we need a fetch timeout that's longer than the upstream
  // hold time, otherwise our request aborts before NextCloud can respond.
  const fetchTimeoutMs = lookIntoFuture === 1 ? (timeoutSeconds + 5) * 1000 : 10_000;
  const result = await ncTalkRequest(ncUrl, user, pass, apiUrl, "GET", undefined, fetchTimeoutMs);
  const rawMessages = result.data?.ocs?.data || [];
  const messages = rawMessages
    // Skip reaction-event records. NextCloud Talk emits a separate ChatMessage
    // entry voor elke reactie (👍, ❤️) — anders verschijnen reacties als
    // losse berichten in de feed. De daadwerkelijke reactie-tellingen zitten
    // op het bovenliggende bericht zelf via `reactions: {emoji: count}`.
    // Skip ook de "X bewerkte een bericht" system-message; het bovenliggende
    // bericht heeft zelf al een `lastEditTimestamp` waardoor de UI weet dat
    // hij bewerkt is — een aparte system-rij eronder is ruis.
    // Filter NC Talk noise (reaction events, edit/delete system rows,
    // emoji-only quoted replies). See messenger/noise-filter.ts.
    .filter(isVisibleMessage)
    .map((m: any) => {
      // Parse reactions from the API response
      const reactions: Reaction[] = [];
      if (m.reactions && typeof m.reactions === "object") {
        for (const [emoji, count] of Object.entries(m.reactions)) {
          reactions.push({
            emoji,
            count: count as number,
            // NC Talk includes reactionsSelf array for current user's reactions
            userReacted: Array.isArray(m.reactionsSelf) && m.reactionsSelf.includes(emoji),
          });
        }
      }

      // Extract file attachments from messageParameters
      const attachments: Array<{
        id: string;
        name: string;
        mimetype: string;
        size: number;
        link: string;
        previewUrl?: string;
      }> = [];
      if (m.messageParameters) {
        for (const [, param] of Object.entries(m.messageParameters)) {
          const p = param as any;
          if (p.type === "file") {
            const isImage = p.mimetype?.startsWith("image/");
            // For images, rewrite `link` to a direct binary preview (the default
            // p.link is an HTML file-view page `/f/<id>` which renders blank
            // when fetched as an image). Non-images keep the original link so
            // they open the NextCloud file page normally.
            const fullImageUrl = isImage && p.id
              ? `${ncUrl}/core/preview?fileId=${p.id}&x=${NC_PREVIEW_FULL_PX}&y=${NC_PREVIEW_FULL_PX}&a=true`
              : null;
            attachments.push({
              id: String(p.id),
              name: p.name || "file",
              mimetype: p.mimetype || "application/octet-stream",
              size: p.size || 0,
              link: fullImageUrl || p.link || "",
              // Build preview URL for images; p.id may be a fileId or a share token
              previewUrl: isImage && p.id
                ? `${ncUrl}/core/preview?fileId=${p.id}&x=${NC_PREVIEW_THUMB_PX}&y=${NC_PREVIEW_THUMB_PX}&a=true`
                : undefined,
            });
          } else if (p.type === "rich-object" && p.subtype === "file") {
            // Screenshots shared as rich-objects (NextCloud Talk >= 17)
            const isImage = p.mimetype?.startsWith("image/");
            const richId = p.id || p.objectId;
            const fullImageUrl = isImage && richId
              ? `${ncUrl}/core/preview?fileId=${richId}&x=${NC_PREVIEW_FULL_PX}&y=${NC_PREVIEW_FULL_PX}&a=true`
              : null;
            attachments.push({
              id: String(richId || ""),
              name: p.name || p.description || "screenshot",
              mimetype: p.mimetype || "image/png",
              size: p.size || 0,
              link: fullImageUrl || p.link || p.url || "",
              previewUrl: isImage && richId
                ? `${ncUrl}/core/preview?fileId=${richId}&x=${NC_PREVIEW_THUMB_PX}&y=${NC_PREVIEW_THUMB_PX}&a=true`
                : undefined,
            });
          }
        }
      }

      // Replace {file} and {user} placeholders in message text.
      // If the message is *only* placeholders (typical for a bare file/screenshot
      // upload: message === "{file}"), drop the text entirely — the attachment
      // preview already shows the filename, so keeping the replaced text would
      // render the name twice in the chat bubble.
      let text = m.message || "";
      const hasOnlyPlaceholders = text.replace(/\{[^}]+\}/g, "").trim() === "";
      if (hasOnlyPlaceholders && attachments.length > 0) {
        text = "";
      } else if (m.messageParameters) {
        for (const [key, param] of Object.entries(m.messageParameters)) {
          const p = param as any;
          if (p.type === "file") {
            text = text.replace(`{${key}}`, p.name || "file");
          } else if (p.type === "user") {
            text = text.replace(`{${key}}`, p.name || p.id || "");
          }
        }
      }

      // M2: Extract parent (threaded reply) info if present
      const parent = m.parent
        ? {
          id: String(m.parent.id),
          text: m.parent.message || "",
          sender: m.parent.actorDisplayName || m.parent.actorId || "",
        }
        : undefined;

      return {
        id: String(m.id),
        text,
        sender: m.actorId || "",
        senderDisplayName: m.actorDisplayName || m.actorId || "",
        timestamp: m.timestamp ? new Date(m.timestamp * 1000).toISOString() : "",
        // NC Talk actorId is de echte uid (b.v. "piet.mol"), niet altijd
        // gelijk aan de login. Vergelijk daarom tegen myUid (opgehaald via
        // /ocs/v1.php/cloud/user). Behoud user-fallback voor edge cases.
        isOwn: m.actorType === "users" && !!m.actorId && (
          m.actorId === myUid ||
          m.actorId.toLowerCase() === myUid.toLowerCase() ||
          m.actorId.toLowerCase() === user.toLowerCase()
        ),
        platform: "nextcloud-talk",
        messageType: m.messageType,
        reactions: reactions.length > 0 ? reactions : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
        parent,
        lastEditTimestamp: typeof m.lastEditTimestamp === "number" && m.lastEditTimestamp > 0
          ? m.lastEditTimestamp
          : undefined,
        deleted: m.messageType === "comment_deleted" || undefined,
      };
    })
    .reverse(); // OCS returns newest first; we want oldest first

  // Highest raw NC message id in this batch — INCLUDING the reaction/system
  // events we filtered out above. The long-poll client uses this as its next
  // lastKnownMessageId so the cursor advances PAST filtered noise. Without it,
  // a batch containing only reactions/system rows returns `messages: []`, the
  // client (which derives its cursor from visible messages) can't move forward,
  // and it re-polls the same id in a tight loop — the storm we're fixing.
  let lastGivenId = 0;
  for (const m of rawMessages) {
    const idNum = parseInt(String(m.id), 10);
    if (Number.isFinite(idNum) && idNum > lastGivenId) lastGivenId = idNum;
  }
  return { messages, hasMore: rawMessages.length === limit, lastGivenId: lastGivenId || undefined };
}

export async function ncSendMessage(ncUrl: string, user: string, pass: string, token: string, message: string, replyTo?: string) {
  let body = `message=${encodeURIComponent(message)}`;
  if (replyTo) body += `&replyTo=${encodeURIComponent(replyTo)}`;
  return ncTalkRequest(
    ncUrl, user, pass,
    `/ocs/v2.php/apps/spreed/api/v1/chat/${encodeURIComponent(token)}`,
    "POST",
    body,
  );
}

export async function ncMarkRead(
  ncUrl: string, user: string, pass: string, token: string,
  lastReadMessage?: number,
) {
  // NC Talk's /read endpoint marks the conversation read up to `lastReadMessage`.
  // Recent NextCloud versions no longer reliably mark the whole chat read when
  // the parameter is omitted (they end up marking read up to id 0 → nothing),
  // which is why the unread badge kept coming back after opening a chat. Always
  // send the newest known raw id so the read marker actually advances.
  const body = typeof lastReadMessage === "number" && lastReadMessage > 0
    ? `lastReadMessage=${lastReadMessage}`
    : undefined;
  return ncTalkRequest(
    ncUrl, user, pass,
    `/ocs/v2.php/apps/spreed/api/v1/chat/${encodeURIComponent(token)}/read`,
    "POST",
    body,
  );
}

export async function ncReactToMessage(ncUrl: string, user: string, pass: string, token: string, messageId: string, reaction: string) {
  return ncTalkRequest(
    ncUrl, user, pass,
    `/ocs/v2.php/apps/spreed/api/v1/reaction/${encodeURIComponent(token)}/${encodeURIComponent(messageId)}?reaction=${encodeURIComponent(reaction)}`,
    "POST"
  );
}

export async function ncRemoveReaction(ncUrl: string, user: string, pass: string, token: string, messageId: string, reaction: string) {
  return ncTalkRequest(
    ncUrl, user, pass,
    `/ocs/v2.php/apps/spreed/api/v1/reaction/${encodeURIComponent(token)}/${encodeURIComponent(messageId)}?reaction=${encodeURIComponent(reaction)}`,
    "DELETE"
  );
}

export async function ncEditMessage(
  ncUrl: string, user: string, pass: string, token: string,
  messageId: string, newText: string,
) {
  const body = `message=${encodeURIComponent(newText)}`;
  return ncTalkRequest(
    ncUrl, user, pass,
    `/ocs/v2.php/apps/spreed/api/v1/chat/${encodeURIComponent(token)}/${encodeURIComponent(messageId)}`,
    "PUT",
    body,
  );
}

export async function ncDeleteMessage(
  ncUrl: string, user: string, pass: string, token: string,
  messageId: string,
) {
  return ncTalkRequest(
    ncUrl, user, pass,
    `/ocs/v2.php/apps/spreed/api/v1/chat/${encodeURIComponent(token)}/${encodeURIComponent(messageId)}`,
    "DELETE",
  );
}

async function ncGetReactions(ncUrl: string, user: string, pass: string, token: string, messageId: string): Promise<Record<string, { actorId: string; actorDisplayName: string }[]>> {
  const result = await ncTalkRequest(
    ncUrl, user, pass,
    `/ocs/v2.php/apps/spreed/api/v1/reaction/${encodeURIComponent(token)}/${encodeURIComponent(messageId)}`
  );
  return result.data?.ocs?.data || {};
}
