/**
 * Server-to-browser event-bus over WebSocket.
 *
 * Mounting: zie /ws/events handler in index.ts. Auth via y_app_session cookie
 * + ?instance=<id> query (zelfde patroon als /ws/terminal).
 *
 * Doel: IMAP IDLE-events en NC Talk long-poll-events real-time naar de
 * browser pushen i.p.v. de browser te laten pollen. BackgroundSyncProvider
 * luistert en doet één lichte fetch op het juiste endpoint zodra een event
 * binnenkomt.
 *
 * Event-format:
 *   { type: "mail-changed", folder: "INBOX", instance: 38 }
 *   { type: "messenger-changed", conversation: "abc123", instance: 38 }
 *   { type: "mail-unseen", folder: "INBOX", unseen: 5, instance: 38 }
 *
 * Multi-client: één Y-app session kan meerdere WS-clients hebben (popouts,
 * meerdere browsers). EventBus stuurt naar ALLE clients van een sessie.
 */
import type { WebSocket } from "ws";

interface ClientEntry {
  ws: WebSocket;
  yAppSid: string;
  instanceId: number;
  subscribedConversations: Set<string>;
}

const clients = new Set<ClientEntry>();

export interface YAppEvent {
  type: "mail-changed" | "mail-unseen" | "messenger-changed";
  instance: number;
  folder?: string;
  conversation?: string;
  unseen?: number;
  /** Optionele extra payload — bv. nieuwe message-id zodat client weet welke ophalen. */
  [key: string]: unknown;
}

export function addEventClient(ws: WebSocket, yAppSid: string, instanceId: number): ClientEntry {
  const entry: ClientEntry = { ws, yAppSid, instanceId, subscribedConversations: new Set() };
  clients.add(entry);
  ws.on("close", () => { clients.delete(entry); });
  ws.on("error", () => { clients.delete(entry); });
  return entry;
}

/**
 * Broadcast naar alle clients van een bepaalde Y-app session + instance.
 * Slechte clients (already closed) worden stilzwijgend overgeslagen.
 */
export function broadcast(yAppSid: string, instanceId: number, event: YAppEvent): void {
  const payload = JSON.stringify(event);
  for (const c of clients) {
    if (c.yAppSid !== yAppSid || c.instanceId !== instanceId) continue;
    if (c.ws.readyState !== 1 /* WebSocket.OPEN */) continue;
    try {
      c.ws.send(payload);
    } catch {
      /* dead connection, will be cleaned up on close */
    }
  }
}

/**
 * Iterator voor alle actieve client-entries — gebruikt door IDLE/long-poll
 * loops om te checken of er nog luisteraars zijn voor een specifieke
 * sessie/instance. Als er niemand luistert kan de loop afgesloten worden
 * om server-resources te besparen.
 */
export function hasListeners(yAppSid: string, instanceId: number): boolean {
  for (const c of clients) {
    if (c.yAppSid === yAppSid && c.instanceId === instanceId) return true;
  }
  return false;
}

/** Itereer entries voor een specifieke sessie+instance (read-only). */
export function getClientsFor(yAppSid: string, instanceId: number): ClientEntry[] {
  return Array.from(clients).filter(c => c.yAppSid === yAppSid && c.instanceId === instanceId);
}

/** Subscribe een client op een specifieke NC Talk conversatie. Door dit te
 *  tracken kan de NC long-poll-loop weten welke conversaties actief zijn. */
export function subscribeConversation(entry: ClientEntry, conversation: string): void {
  entry.subscribedConversations.add(conversation);
}

export function unsubscribeConversation(entry: ClientEntry, conversation: string): void {
  entry.subscribedConversations.delete(conversation);
}

/** Verzamel ALLE actieve conversation-subscriptions voor een sessie+instance.
 *  Gebruikt door de NC long-poll loop om te bepalen welke gesprekken open te
 *  houden. */
export function getActiveConversations(yAppSid: string, instanceId: number): Set<string> {
  const out = new Set<string>();
  for (const c of clients) {
    if (c.yAppSid !== yAppSid || c.instanceId !== instanceId) continue;
    for (const conv of c.subscribedConversations) out.add(conv);
  }
  return out;
}
