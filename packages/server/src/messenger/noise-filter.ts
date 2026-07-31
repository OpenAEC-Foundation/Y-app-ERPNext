/**
 * NextCloud Talk message noise-filter.
 *
 * NC Talk emits several kinds of rows into the chat feed that are not
 * standalone chat messages. This module holds the pure predicates that
 * decide which raw rows to show, extracted from `ncGetMessages` so they can
 * be unit-tested in isolation. See `messenger.ts` for how they're applied.
 */

// Detecteer berichten die enkel uit emoji bestaan (1-8 codepoints na trimmen).
// Gebruikt om "fake reactions" te onderdrukken: iemand stuurt letterlijk "👍"
// als quoted reply vanuit een NC Talk client. Dat is messageType === "comment"
// (geen reaction-event), dus de bestaande filter mist het. Combinatie met
// een aanwezig parent-veld = geen echte chat-uiting maar een verkapte reactie.
export const EMOJI_ONLY_RE = /^[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Emoji_Component}‍️\s]{1,8}$/u;

export function isEmojiOnly(text: string | undefined | null): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  return EMOJI_ONLY_RE.test(trimmed);
}

/** Minimal structural view of a raw NC Talk chat message, for filtering. */
export interface NcRawMessageLike {
  messageType?: string;
  systemMessage?: string;
  parent?: unknown;
  message?: string;
}

/**
 * True if a raw NC Talk row should be SHOWN in the feed. Drops:
 *
 *  - reaction-event records. NextCloud Talk emits a separate ChatMessage
 *    entry voor elke reactie (👍, ❤️) — anders verschijnen reacties als
 *    losse berichten in de feed. De daadwerkelijke reactie-tellingen zitten
 *    op het bovenliggende bericht zelf via `reactions: {emoji: count}`.
 *  - de "X bewerkte/verwijderde een bericht" system-message; het bovenliggende
 *    bericht heeft zelf al een `lastEditTimestamp` waardoor de UI weet dat
 *    hij bewerkt is — een aparte system-rij eronder is ruis.
 *  - een 👍 / ❤️ / 😂 als quoted reply: geen chat-bericht maar een verkapte
 *    reactie. Een losstaand emoji-bericht (zonder parent) blijft wel gewoon
 *    zichtbaar — dat is een normale uiting.
 */
export function isVisibleMessage(m: NcRawMessageLike): boolean {
  return (
    m.messageType !== "reaction" &&
    m.messageType !== "reaction_deleted" &&
    !(m.messageType === "system" && (m.systemMessage === "message_edited" || m.systemMessage === "message_deleted")) &&
    !(m.parent && isEmojiOnly(m.message))
  );
}
