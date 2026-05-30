/**
 * Types dùng chung cho affiliate AI chat + IndexedDB.
 */

export type AffiliateChatRole = "user" | "assistant";

export type AffiliateChatMediaKind = "image" | "video";

/** Ảnh/video gửi kèm tin nhắn (base64 thuần, không prefix data URI). */
export interface AffiliateChatMediaAttachment {
  kind: AffiliateChatMediaKind;
  mimeType: string;
  data: string;
  name?: string;
}

export interface AffiliateChatMessage {
  id: string;
  role: AffiliateChatRole;
  content: string;
  attachments?: AffiliateChatMediaAttachment[];
}

export interface AffiliateChatStorageRecord {
  messages: AffiliateChatMessage[];
  updatedAt: number;
}

export const AFFILIATE_CHAT_WELCOME_ID = "welcome";
