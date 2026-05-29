/**
 * Types dùng chung cho affiliate AI chat + IndexedDB.
 */

export type AffiliateChatRole = "user" | "assistant";

export interface AffiliateChatMessage {
  id: string;
  role: AffiliateChatRole;
  content: string;
}

export interface AffiliateChatStorageRecord {
  messages: AffiliateChatMessage[];
  updatedAt: number;
}

export const AFFILIATE_CHAT_WELCOME_ID = "welcome";
