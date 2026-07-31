/* ─── MS Teams (Microsoft Graph) helpers ─── */

import type { Request } from "express";
import type { Conversation, Message } from "./types.ts";

/**
 * Get a Graph API token for MS Teams.
 * Uses env vars TEAMS_CLIENT_ID, TEAMS_CLIENT_SECRET, TEAMS_TENANT_ID
 * to obtain a token via client_credentials grant.
 * For delegated (user) access, the frontend should provide a token.
 */
async function getGraphToken(req: Request): Promise<string | null> {
  // Check for token passed directly from frontend
  const directToken = (req.query.teams_token || req.body?.teams_token) as string;
  if (directToken) return directToken;

  // Use env vars for client_credentials flow
  const clientId = process.env.TEAMS_CLIENT_ID;
  const clientSecret = process.env.TEAMS_CLIENT_SECRET;
  const tenantId = process.env.TEAMS_TENANT_ID;
  if (!clientId || !clientSecret || !tenantId) return null;

  const tokenUri = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const tokenResp = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
      scope: "https://graph.microsoft.com/.default",
    }),
  });
  const data = await tokenResp.json() as { access_token?: string };
  return data.access_token || null;
}

async function graphRequest(token: string, path: string, method = "GET", body?: string): Promise<any> {
  const opts: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    signal: AbortSignal.timeout(15000),
  };
  if (body) opts.body = body;
  const resp = await fetch(`https://graph.microsoft.com/v1.0${path}`, opts);
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Graph API ${resp.status}: ${errText.slice(0, 200)}`);
  }
  return resp.json();
}

export async function teamsListConversations(req: Request, email: string): Promise<Conversation[]> {
  const token = await getGraphToken(req);
  if (!token) throw new Error("Geen OAuth2 token beschikbaar voor MS Teams. Stel TEAMS_CLIENT_ID, TEAMS_CLIENT_SECRET, TEAMS_TENANT_ID in.");

  // Get chats (1:1 and group chats)
  const data = await graphRequest(token, "/me/chats?$expand=members&$top=50&$orderby=lastMessagePreview/createdDateTime desc");
  const chats = data.value || [];

  return chats.map((c: any) => {
    const members = c.members || [];
    // For 1:1 chats, use the other person's name
    let name = c.topic || "";
    if (!name && c.chatType === "oneOnOne") {
      const other = members.find((m: any) => m.email?.toLowerCase() !== email.toLowerCase());
      name = other?.displayName || "Chat";
    }
    if (!name) name = members.map((m: any) => m.displayName).filter(Boolean).join(", ") || "Chat";

    return {
      id: c.id,
      name,
      lastMessage: c.lastMessagePreview?.body?.content?.replace(/<[^>]*>/g, "").slice(0, 100) || "",
      lastMessageTime: c.lastMessagePreview?.createdDateTime || "",
      unreadCount: 0,
      participants: members.length,
      type: c.chatType === "oneOnOne" ? "one-to-one" : "group",
      platform: "ms-teams",
    };
  });
}

export async function teamsGetMessages(req: Request, email: string, chatId: string): Promise<Message[]> {
  const token = await getGraphToken(req);
  if (!token) throw new Error("Geen OAuth2 token beschikbaar voor MS Teams");

  const data = await graphRequest(token, `/me/chats/${encodeURIComponent(chatId)}/messages?$top=50&$orderby=createdDateTime desc`);
  const msgs = (data.value || []).reverse(); // oldest first

  return msgs
    .filter((m: any) => m.messageType === "message")
    .map((m: any) => ({
      id: m.id,
      text: m.body?.content?.replace(/<[^>]*>/g, "") || "",
      sender: m.from?.user?.id || "",
      senderDisplayName: m.from?.user?.displayName || "Onbekend",
      timestamp: m.createdDateTime || "",
      isOwn: m.from?.user?.email?.toLowerCase() === email.toLowerCase()
        || m.from?.user?.displayName?.toLowerCase().includes(email.split("@")[0].toLowerCase()),
      platform: "ms-teams",
    }));
}

export async function teamsSendMessage(req: Request, email: string, chatId: string, message: string) {
  const token = await getGraphToken(req);
  if (!token) throw new Error("Geen OAuth2 token beschikbaar voor MS Teams");

  return graphRequest(
    token,
    `/me/chats/${encodeURIComponent(chatId)}/messages`,
    "POST",
    JSON.stringify({ body: { content: message } })
  );
}
