/**
 * Shared mail types, extracted verbatim from pages/Webmail.tsx so the mail
 * components (ReadingPane, ComposeWindow, FolderTree, …) and the Webmail page
 * can share one definition instead of re-declaring them.
 *
 * The base types MailMessage / MailAddress / ImapConfig / SharedMailbox stay in
 * lib/webmail-prefetch; these are the richer/composed types layered on top.
 */

import type { MailMessage, MailAddress } from "./webmail-prefetch";

export interface AttachmentMeta {
  filename: string;
  contentType: string;
  size: number;
  cid?: string;
  contentDisposition?: string;
}

export interface MailMessageFull extends MailMessage {
  cc: MailAddress[];
  textBody: string;
  htmlBody: string;
  attachments?: AttachmentMeta[];
  messageId?: string;
  inReplyTo?: string;
  references?: string;
  /** Server-set bij /api/mail/conversation: positie t.o.v. de bron-mail. */
  relation?: "current" | "ancestor" | "descendant";
  /** Folder waarin deze message zit volgens de server. ConversationResult bevat dit; */
  /** voor losse messages buiten thread blijft het undefined. */
  folder?: string;
}

export interface MailFolder {
  path: string;
  name: string;
  delimiter?: string;
  specialUse: string | null;
  unseen?: number | null;
}

export interface ForwardedAttachment {
  url: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface ComposeState {
  mode: "new" | "reply" | "replyAll" | "forward";
  from: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
  /** UID + folder of original message being replied to (for reply tracking) */
  replyToUid?: number;
  replyToFolder?: string;
  /** Original HTML body for reply/forward quote rendering (W3) */
  quoteHtml?: string;
  /** Bijlages uit het oorspronkelijke bericht bij forward (W2) */
  forwardedAttachments?: ForwardedAttachment[];
}

export interface SendPayload {
  email: string; from: string;
  to: string[]; cc?: string[]; bcc?: string[];
  subject: string; html: string; text: string;
  inReplyTo?: string; references?: string;
  attachments?: { filename: string; content: string; contentType: string }[];
  /** Reply tracking: UID and folder of the original message being replied to */
  _replyToUid?: number;
  _replyToFolder?: string;
}
