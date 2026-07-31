/* ─── Types ─── */

export interface Conversation {
  id: string;
  name: string;
  lastMessage: string;
  lastMessageTime: string;
  /**
   * Raw NC id of the conversation's newest message. Used by the client-side
   * read-overlay to tell a stale unread count (NC hasn't propagated our
   * mark-read yet) apart from a genuinely new message: only suppress the badge
   * when `lastMessageId <= what we marked read`.
   */
  lastMessageId?: number;
  unreadCount: number;
  participants: number;
  type: string; // "one-to-one" | "group" | "public" | "bot"
  avatar?: string;
  platform: string;
  pinned?: boolean;
}

export interface Reaction {
  emoji: string;
  count: number;
  userReacted: boolean;
}

export interface Message {
  id: string;
  text: string;
  sender: string;
  senderDisplayName: string;
  timestamp: string;
  isOwn: boolean;
  platform: string;
  messageType?: string;
  reactions?: Reaction[];
  attachments?: Array<{
    id: string;
    name: string;
    mimetype: string;
    size: number;
    link: string;
    previewUrl?: string;
  }>;
  /** M2: Parent message info als dit een NC Talk threaded reply is */
  parent?: {
    id: string;
    text: string;
    sender: string;
  };
  /** Unix-seconds van laatste bewerking; aanwezig als NC Talk het bericht als bewerkt rapporteert */
  lastEditTimestamp?: number;
  /** True als NC Talk dit bericht als verwijderd rapporteert (messageType === "comment_deleted") */
  deleted?: boolean;
}
