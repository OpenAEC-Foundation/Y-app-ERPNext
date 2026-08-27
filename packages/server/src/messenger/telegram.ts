/* ─── Telegram helpers ─── */

import type { Request } from "express";
import type { Conversation, Message } from "./types.ts";

export function resolveTelegramToken(req: Request): string | null {
  return (req.body?.token || req.query.token) as string || process.env.TELEGRAM_BOT_TOKEN || null;
}

async function tgRequest(botToken: string, method: string, params?: Record<string, any>): Promise<any> {
  const url = `https://api.telegram.org/bot${botToken}/${method}`;
  if (params && Object.keys(params).length > 0) {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(10_000),
    });
    return resp.json();
  }
  const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  return resp.json();
}

export async function tgListConversations(botToken: string): Promise<Conversation[]> {
  const result = await tgRequest(botToken, "getUpdates", { limit: 100 });
  if (!result.ok) throw new Error(result.description || "Telegram API error");

  // Extract unique chats from updates
  const chatMap = new Map<number, any>();
  for (const update of result.result || []) {
    const msg = update.message || update.edited_message || update.channel_post;
    if (msg?.chat) {
      chatMap.set(msg.chat.id, {
        chat: msg.chat,
        lastMessage: msg.text || "",
        date: msg.date || 0,
      });
    }
  }

  return Array.from(chatMap.values()).map((entry) => {
    const c = entry.chat;
    const name = c.title || [c.first_name, c.last_name].filter(Boolean).join(" ") || String(c.id);
    return {
      id: String(c.id),
      name,
      lastMessage: entry.lastMessage,
      lastMessageTime: entry.date ? new Date(entry.date * 1000).toISOString() : "",
      unreadCount: 0,
      participants: c.type === "private" ? 2 : 0,
      type: c.type || "private",
      platform: "telegram",
    };
  });
}

export async function tgGetMessages(botToken: string, chatId: string): Promise<Message[]> {
  // Telegram Bot API doesn't have a "get messages for chat" endpoint.
  // We use getUpdates and filter by chat_id.
  const result = await tgRequest(botToken, "getUpdates", { limit: 100 });
  if (!result.ok) throw new Error(result.description || "Telegram API error");

  const messages: Message[] = [];
  const botInfo = await tgRequest(botToken, "getMe");
  const botId = botInfo.ok ? botInfo.result.id : 0;

  for (const update of result.result || []) {
    const msg = update.message || update.edited_message || update.channel_post;
    if (msg && String(msg.chat.id) === chatId) {
      const senderName = msg.from
        ? [msg.from.first_name, msg.from.last_name].filter(Boolean).join(" ")
        : "Onbekend";
      messages.push({
        id: String(msg.message_id),
        text: msg.text || "",
        sender: String(msg.from?.id || 0),
        senderDisplayName: senderName,
        timestamp: msg.date ? new Date(msg.date * 1000).toISOString() : "",
        isOwn: msg.from?.id === botId,
        platform: "telegram",
      });
    }
  }

  return messages;
}

export async function tgSendMessage(botToken: string, chatId: string, text: string) {
  return tgRequest(botToken, "sendMessage", { chat_id: chatId, text });
}
