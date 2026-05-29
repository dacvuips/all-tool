/**
 * trending-chat-panel.tsx
 * Chat AI trong panel trending – gọi Gemini qua /api/app/affiliate-trending-chat/
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiDeleteBinLine, RiLoader4Line, RiSendPlaneFill } from "react-icons/ri";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { AFFILIATE_CHAT_KIND } from "../../constants";
import { getAffiliateChatSystemPrompt } from "../hook/affiliate-chat-prompts";
import { AFFILIATE_CHAT_WELCOME_ID, AffiliateChatMessage } from "../hook/affiliateChatTypes";
import { useAffiliateChatStorage } from "../hook/useAffiliateChatStorage";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";

const CHAT_KIND = AFFILIATE_CHAT_KIND.trendingGymPt;
const TEXT_CONTEXT = getAffiliateChatSystemPrompt(CHAT_KIND);

const WELCOME_I18N_KEY =
  "Xin chào! Tôi có thể gợi ý ý tưởng mẹo vặt, nhân vật, kịch bản scene và prompt cho video của bạn.";

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createWelcomeMessage(content: string): AffiliateChatMessage {
  return {
    id: AFFILIATE_CHAT_WELCOME_ID,
    role: "assistant",
    content,
  };
}

function messagesPersistSnapshot(messages: AffiliateChatMessage[]): string {
  return JSON.stringify(
    messages
      .filter((m) => m.id !== AFFILIATE_CHAT_WELCOME_ID)
      .map((m) => ({ id: m.id, role: m.role, content: m.content }))
  );
}

export function ChatBotSidebar() {
  const { t } = useTranslation();
  const toast = useToast();
  const { affiliateVideoFormConfig, trendingScriptData } = useAffiliateVideoContext();
  const { loadMessages, persistMessages, clearStoredMessages, storageKey } =
    useAffiliateChatStorage(CHAT_KIND);

  const welcomeText = t(WELCOME_I18N_KEY);
  const welcomeMessage = useMemo(() => createWelcomeMessage(welcomeText), [welcomeText]);

  const [messages, setMessages] = useState<AffiliateChatMessage[]>(() => [welcomeMessage]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const hydratedRef = useRef(hydrated);
  hydratedRef.current = hydrated;

  const persistRef = useRef(persistMessages);
  persistRef.current = persistMessages;

  const lastPersistedSnapshotRef = useRef("");
  const persistSeqRef = useRef(0);
  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Ghi IndexedDB theo messages mới nhất; bỏ qua nếu có lần ghi mới hơn đang chờ. */
  const flushPersist = useCallback(async () => {
    if (!hydratedRef.current) return;

    const seq = ++persistSeqRef.current;
    const current = messagesRef.current;
    const snapshot = messagesPersistSnapshot(current);
    if (snapshot === lastPersistedSnapshotRef.current) return;

    try {
      await persistRef.current(current);
    } catch (err) {
      console.warn("[trending-chat] IndexedDB persist failed", err);
      return;
    }

    if (seq !== persistSeqRef.current) {
      await flushPersist();
      return;
    }

    lastPersistedSnapshotRef.current = messagesPersistSnapshot(messagesRef.current);
  }, []);

  const schedulePersist = useCallback(() => {
    if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    persistDebounceRef.current = setTimeout(() => {
      persistDebounceRef.current = null;
      void flushPersist();
    }, 150);
  }, [flushPersist]);

  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    lastPersistedSnapshotRef.current = "";
    persistSeqRef.current += 1;

    (async () => {
      const saved = await loadMessages();
      if (cancelled) return;

      if (saved.length > 0) {
        const restored = [createWelcomeMessage(t(WELCOME_I18N_KEY)), ...saved];
        setMessages(restored);
        lastPersistedSnapshotRef.current = messagesPersistSnapshot(restored);
      } else {
        setMessages([createWelcomeMessage(t(WELCOME_I18N_KEY))]);
        lastPersistedSnapshotRef.current = "";
      }
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ hydrate khi storageKey đổi
  }, [storageKey, loadMessages]);

  useEffect(() => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === AFFILIATE_CHAT_WELCOME_ID);
      if (idx === -1) return prev;
      if (prev[idx].content === welcomeText) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], content: welcomeText };
      return next;
    });
  }, [welcomeText]);

  useEffect(() => {
    if (!hydrated) return;
    schedulePersist();
    return () => {
      if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    };
  }, [messages, hydrated, schedulePersist]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const buildContext = useCallback(
    () => ({
      tipContent: affiliateVideoFormConfig?.tipContent,
      category: affiliateVideoFormConfig?.category,
      mood: affiliateVideoFormConfig?.mood,
      language: affiliateVideoFormConfig?.language,
      artStyle: affiliateVideoFormConfig?.artStyle,
      sceneCount: trendingScriptData?.scenes?.length ?? 0,
    }),
    [affiliateVideoFormConfig, trendingScriptData]
  );

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: AffiliateChatMessage = { id: newId(), role: "user", content: text };
    const apiMessages = [
      ...messages.filter((m) => m.id !== AFFILIATE_CHAT_WELCOME_ID),
      userMsg,
    ].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/app/affiliate-chat-bot/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          context: buildContext(),
          chatKind: CHAT_KIND,
          textContext: TEXT_CONTEXT,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || `Lỗi ${res.status}`);
      }

      const result = await res.json();
      const reply = result?.data?.reply as string;
      if (!reply) throw new Error(t("AI không trả lời"));

      const assistantMsg: AffiliateChatMessage = {
        id: newId(),
        role: "assistant",
        content: reply,
      };

      setMessages((prev) => {
        const next = [...prev, assistantMsg];
        messagesRef.current = next;
        return next;
      });

      // Ghi ngay sau reply — tránh bản ghi chỉ có tin user ghi đè sau khi API chậm
      if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
      persistDebounceRef.current = null;
      await flushPersist();
    } catch (err: any) {
      toast.error(err?.message || t("Gửi tin nhắn thất bại"));
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      setInput(text);
      schedulePersist();
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, messages, buildContext, toast, t, flushPersist, schedulePersist]);

  const clearChat = useCallback(async () => {
    setMessages([welcomeMessage]);
    setInput("");
    lastPersistedSnapshotRef.current = "";
    persistSeqRef.current += 1;
    if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    try {
      await clearStoredMessages();
    } catch (err) {
      console.warn("[trending-chat] IndexedDB clear failed", err);
    }
  }, [welcomeMessage, clearStoredMessages]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white">
      <div className="flex gap-2 justify-between items-center px-3 py-2 bg-gray-50 border-b border-gray-200">
        <span className="text-sm font-semibold text-gray-800">{t("Chat")}</span>
        <button
          type="button"
          onClick={clearChat}
          disabled={loading}
          className="inline-flex gap-1 items-center text-xs text-gray-500 hover:text-gray-800 disabled:opacity-50"
          title={t("Xóa hội thoại")}
        >
          <RiDeleteBinLine />
          {t("Xóa hội thoại")}
        </button>
      </div>

      <div ref={listRef} className="overflow-y-auto flex-1 px-3 py-3 space-y-3 min-h-0">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                m.role === "user"
                  ? "bg-primary text-white rounded-br-md"
                  : "bg-gray-100 text-gray-800 rounded-bl-md"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="inline-flex gap-2 items-center px-3 py-2 text-sm text-gray-500 bg-gray-100 rounded-2xl rounded-bl-md">
              <RiLoader4Line className="animate-spin" />
              {t("Đang trả lời...")}
            </div>
          </div>
        )}
      </div>

      <div className="p-3 bg-white border-t border-gray-200">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={loading}
            rows={2}
            placeholder={t("Nhập câu hỏi...")}
            className="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-gray-50"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="flex flex-shrink-0 justify-center items-center w-10 h-10 text-white rounded-xl bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
            title={t("Gửi")}
          >
            <RiSendPlaneFill />
          </button>
        </div>
      </div>
    </div>
  );
}
