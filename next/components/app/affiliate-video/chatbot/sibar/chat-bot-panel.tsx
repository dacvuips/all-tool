/**
 * trending-chat-panel.tsx
 * Chat AI trong panel trending – gọi Gemini qua /api/app/affiliate-trending-chat/
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RiAttachment2,
  RiCloseLine,
  RiDeleteBinLine,
  RiLoader4Line,
  RiSendPlaneFill,
} from "react-icons/ri";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { AFFILIATE_CHAT_KIND } from "../../constants";

import {
  AFFILIATE_CHAT_WELCOME_ID,
  AffiliateChatMediaAttachment,
  AffiliateChatMessage,
} from "../hook/affiliateChatTypes";
import { useAffiliateChatStorage } from "../hook/useAffiliateChatStorage";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";

const CHAT_KIND = AFFILIATE_CHAT_KIND.trendingGymPt;

const MAX_PENDING_ATTACHMENTS = 10;
const MAX_IMAGE_MB = 10;
const MAX_VIDEO_MB = 30;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"];
const FILE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,video/x-msvideo,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mov,.avi";

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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      if (base64) resolve(base64);
      else reject(new Error("Failed to read file as base64"));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function base64ToBlobUrl(base64: string, mimeType: string): string {
  const byteChars = atob(base64);
  const byteNumbers = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  return URL.createObjectURL(new Blob([byteNumbers], { type: mimeType }));
}

function detectMediaKind(file: File): "image" | "video" | null {
  if (ACCEPTED_IMAGE_TYPES.includes(file.type) || /\.(jpe?g|png|webp|gif)$/i.test(file.name)) {
    return "image";
  }
  if (ACCEPTED_VIDEO_TYPES.includes(file.type) || /\.(mp4|webm|mov|avi)$/i.test(file.name)) {
    return "video";
  }
  return null;
}

function ChatMessageMedia({ attachments }: { attachments: AffiliateChatMediaAttachment[] }) {
  if (!attachments.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {attachments.map((att, i) => (
        <ChatMediaThumb key={`${att.kind}-${i}-${att.name || ""}`} attachment={att} />
      ))}
    </div>
  );
}

function ChatMediaThumb({ attachment }: { attachment: AffiliateChatMediaAttachment }) {
  const previewSrc = useMemo(() => {
    if (!attachment.data) return null;
    return base64ToBlobUrl(
      attachment.data,
      attachment.mimeType || (attachment.kind === "video" ? "video/mp4" : "image/png")
    );
  }, [attachment.data, attachment.kind, attachment.mimeType]);

  useEffect(() => {
    return () => {
      if (previewSrc?.startsWith("blob:")) URL.revokeObjectURL(previewSrc);
    };
  }, [previewSrc]);

  if (!previewSrc) return null;

  return (
    <div className="overflow-hidden w-16 h-16 bg-black/20 rounded-lg">
      {attachment.kind === "video" ? (
        <video src={previewSrc} className="object-cover w-full h-full" muted playsInline />
      ) : (
        <img src={previewSrc} alt="" className="object-cover w-full h-full" />
      )}
    </div>
  );
}

function PendingAttachmentThumb({
  attachment,
  onRemove,
}: {
  attachment: AffiliateChatMediaAttachment;
  onRemove: () => void;
}) {
  const previewSrc = useMemo(() => {
    if (!attachment.data) return null;
    return base64ToBlobUrl(
      attachment.data,
      attachment.mimeType || (attachment.kind === "video" ? "video/mp4" : "image/png")
    );
  }, [attachment.data, attachment.kind, attachment.mimeType]);

  useEffect(() => {
    return () => {
      if (previewSrc?.startsWith("blob:")) URL.revokeObjectURL(previewSrc);
    };
  }, [previewSrc]);

  if (!previewSrc) return null;

  return (
    <div className="relative flex-shrink-0 w-14 h-14">
      <div className="overflow-hidden w-full h-full bg-gray-100 rounded-lg border border-gray-200">
        {attachment.kind === "video" ? (
          <video src={previewSrc} className="object-cover w-full h-full" muted playsInline />
        ) : (
          <img src={previewSrc} alt="" className="object-cover w-full h-full" />
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="flex absolute -top-1 -right-1 justify-center items-center w-5 h-5 text-white bg-gray-800 rounded-full hover:bg-gray-900"
        aria-label="Remove"
      >
        <RiCloseLine className="text-sm" />
      </button>
    </div>
  );
}

export function ChatBotSidebar() {
  const { t } = useTranslation();
  const toast = useToast();
  const { affiliateVideoFormConfig, trendingScriptData } = useAffiliateVideoContext();
  const chatBotId = affiliateVideoFormConfig?.promptId;
  const selectedPromptName = affiliateVideoFormConfig?.promptName;

  const { loadMessages, persistMessages, clearStoredMessages, storageKey } =
    useAffiliateChatStorage(CHAT_KIND, chatBotId);

  const welcomeText = t(WELCOME_I18N_KEY);
  const welcomeMessage = useMemo(() => createWelcomeMessage(welcomeText), [welcomeText]);

  const [messages, setMessages] = useState<AffiliateChatMessage[]>(() => [welcomeMessage]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<AffiliateChatMediaAttachment[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const withoutMedia = current.map(({ attachments: _a, ...m }) => m);
      await persistRef.current(withoutMedia);
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
    setInput("");
    setPendingAttachments([]);
    lastPersistedSnapshotRef.current = "";
    persistSeqRef.current += 1;
    if (persistDebounceRef.current) {
      clearTimeout(persistDebounceRef.current);
      persistDebounceRef.current = null;
    }
    setMessages([createWelcomeMessage(t(WELCOME_I18N_KEY))]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ hydrate khi storageKey (chatBotId) đổi
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

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;

      const remaining = MAX_PENDING_ATTACHMENTS - pendingAttachments.length;
      if (remaining <= 0) {
        toast.error(t("Tối đa {{count}} file đính kèm", { count: MAX_PENDING_ATTACHMENTS }));
        return;
      }

      const toAdd: AffiliateChatMediaAttachment[] = [];

      for (const file of list.slice(0, remaining)) {
        const kind = detectMediaKind(file);
        if (!kind) {
          toast.error(t("Chỉ hỗ trợ ảnh (JPG, PNG, WebP, GIF) hoặc video (MP4, WebM, MOV, AVI)"));
          continue;
        }

        const maxMb = kind === "video" ? MAX_VIDEO_MB : MAX_IMAGE_MB;
        const sizeMB = file.size / (1024 * 1024);
        if (sizeMB > maxMb) {
          toast.error(
            `${file.name}: ${t("File quá lớn")}. ${t("Tối đa")} ${maxMb}MB (${sizeMB.toFixed(1)}MB)`
          );
          continue;
        }

        try {
          const data = await fileToBase64(file);
          toAdd.push({
            kind,
            mimeType:
              file.type || (kind === "video" ? "video/mp4" : "image/png"),
            data,
            name: file.name,
          });
        } catch {
          toast.error(t("Không đọc được file: {{name}}", { name: file.name }));
        }
      }

      if (toAdd.length > 0) {
        setPendingAttachments((prev) => [...prev, ...toAdd].slice(0, MAX_PENDING_ATTACHMENTS));
      }
    },
    [pendingAttachments.length, t, toast]
  );

  const onFilesSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files?.length) void processFiles(files);
      e.target.value = "";
    },
    [processFiles]
  );

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    const attachments = pendingAttachments;
    if ((!text && attachments.length === 0) || loading || !chatBotId) return;

    const userMsg: AffiliateChatMessage = {
      id: newId(),
      role: "user",
      content: text,
      ...(attachments.length > 0 ? { attachments } : {}),
    };
    const apiMessages = [
      ...messages.filter((m) => m.id !== AFFILIATE_CHAT_WELCOME_ID),
      userMsg,
    ].map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.attachments?.length ? { attachments: m.attachments } : {}),
    }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setPendingAttachments([]);
    setLoading(true);

    try {
      const res = await fetch("/api/app/affiliate-chat-bot/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          chatKind: CHAT_KIND,
          chatBotId,
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
      setPendingAttachments(attachments);
      schedulePersist();
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [
    input,
    pendingAttachments,
    loading,
    messages,
    chatBotId,
    toast,
    t,
    flushPersist,
    schedulePersist,
  ]);

  const clearChat = useCallback(async () => {
    setMessages([welcomeMessage]);
    setInput("");
    setPendingAttachments([]);
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
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-sm font-semibold text-gray-800">{t("Chat")}</span>
          {selectedPromptName ? (
            <span
              className="text-xs font-medium truncate text-primary"
              title={selectedPromptName}
            >
              {selectedPromptName}
            </span>
          ) : null}
        </div>
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
              {m.attachments?.length ? (
                <ChatMessageMedia attachments={m.attachments} />
              ) : null}
              {m.content ? <span>{m.content}</span> : null}
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

      <div className="bg-white border-t border-gray-200">
        <input
          ref={fileInputRef}
          type="file"
          accept={FILE_ACCEPT}
          multiple
          className="hidden"
          onChange={onFilesSelected}
          disabled={loading || !chatBotId}
        />
        {pendingAttachments.length > 0 ? (
          <div className="flex gap-2 px-3 pt-2 overflow-x-auto">
            {pendingAttachments.map((att, index) => (
              <PendingAttachmentThumb
                key={`${att.kind}-${index}-${att.name || att.data.slice(0, 12)}`}
                attachment={att}
                onRemove={() =>
                  setPendingAttachments((prev) => prev.filter((_, i) => i !== index))
                }
              />
            ))}
          </div>
        ) : null}
        <div className="p-3">
          <div
            className={`relative rounded-xl border border-gray-200 focus-within:ring-2 focus-within:ring-primary/30 ${
              loading || !chatBotId ? "bg-gray-50" : "bg-white"
            }`}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={loading || !chatBotId}
              rows={2}
              placeholder={
                chatBotId
                  ? t("Nhập câu hỏi...")
                  : t("Chọn chatbot (Dùng ngay) để bắt đầu chat")
              }
              className="block w-full px-3 py-2 pr-[5.5rem] pb-11 text-sm bg-transparent rounded-xl border-0 resize-none focus:outline-none disabled:cursor-not-allowed"
            />
            <div className="absolute right-2 bottom-2 flex gap-1 items-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={
                  loading ||
                  !chatBotId ||
                  pendingAttachments.length >= MAX_PENDING_ATTACHMENTS
                }
                className="flex flex-shrink-0 justify-center items-center w-9 h-9 text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                title={t("Đính kèm ảnh / video")}
              >
                <RiAttachment2 />
              </button>
              <button
                type="button"
                onClick={sendMessage}
                disabled={
                  loading ||
                  (!input.trim() && pendingAttachments.length === 0) ||
                  !chatBotId
                }
                className="flex flex-shrink-0 justify-center items-center w-9 h-9 text-white rounded-lg bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
                title={t("Gửi")}
              >
                <RiSendPlaneFill />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
