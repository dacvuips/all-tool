/**
 * Lưu / khôi phục hội thoại chat AI theo chatKind + user + chatbotId trong IndexedDB.
 * Key: `{chatKind}:{userId}:{chatBotId}` — mỗi chatbot một hội thoại riêng.
 */

import { useCallback, useMemo } from "react";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { AffiliateChatKind, DB_NAME, STORE_NAME } from "../../constants";
import { useIndexedDB } from "../../hook/useIndexedDB";
import {
  AFFILIATE_CHAT_WELCOME_ID,
  AffiliateChatMessage,
  AffiliateChatStorageRecord,
} from "./affiliateChatTypes";

export function buildAffiliateChatStorageKey(
  chatKind: AffiliateChatKind,
  userId?: string | null,
  chatBotId?: string | null
): string {
  const uid = (userId && String(userId).trim()) || "guest";
  const botId = (chatBotId && String(chatBotId).trim()) || "__none__";
  return `${chatKind}:${uid}:${botId}`;
}

export function useAffiliateChatStorage(
  chatKind: AffiliateChatKind,
  chatBotId?: string | null
) {
  const { customer } = useAuth();
  const db = useIndexedDB<AffiliateChatStorageRecord>(
    STORE_NAME.affiliateChat,
    DB_NAME.affiliateChat
  );

  const storageKey = useMemo(
    () => buildAffiliateChatStorageKey(chatKind, customer?._id, chatBotId),
    [chatKind, customer?._id, chatBotId]
  );

  const loadMessages = useCallback(async (): Promise<AffiliateChatMessage[]> => {
    const record = await db.get(storageKey);
    if (!record?.messages?.length) return [];
    return record.messages.filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    );
  }, [db, storageKey]);

  const persistMessages = useCallback(
    async (messages: AffiliateChatMessage[]) => {
      const toSave = messages.filter((m) => m.id !== AFFILIATE_CHAT_WELCOME_ID);
      if (toSave.length === 0) {
        await db.remove(storageKey);
        return;
      }
      await db.set(storageKey, {
        messages: toSave,
        updatedAt: Date.now(),
      });
    },
    [db, storageKey]
  );

  const clearStoredMessages = useCallback(async () => {
    await db.remove(storageKey);
  }, [db, storageKey]);

  return {
    storageKey,
    loadMessages,
    persistMessages,
    clearStoredMessages,
  };
}
