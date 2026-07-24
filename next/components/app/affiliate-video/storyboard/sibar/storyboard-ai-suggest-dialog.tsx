/**
 * Dialog chat AI gợi ý ảnh storyboard.
 * Frontend chỉ gửi prompt (ý tưởng ngắn) + sceneCount — prompt mẫu ráp ở backend.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RiAttachment2,
  RiCloseLine,
  RiLoader4Line,
  RiMagicFill,
  RiSendPlaneFill,
} from "react-icons/ri";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { Dialog } from "../../../../shared/utilities/dialog/dialog";
import { Button } from "../../../../shared/utilities/form";
import { Img } from "../../../../shared/utilities/misc";
import { ElementFormImage } from "../../constants";
import {
  fileToGenerationImageBase64,
  GENERATION_IMAGE_ACCEPTED_EXTENSIONS,
  GENERATION_IMAGE_ACCEPTED_TYPES,
} from "../../shared/compressGenerationImage";

const SECONDS_PER_SCENE = 8;
const MIN_SCENES = 1;
const MAX_SCENES = 30;
const DEFAULT_SCENES = 5;
const MAX_PENDING_ATTACHMENTS = 10;
const MAX_IMAGE_MB = 10;
const FILE_ACCEPT = GENERATION_IMAGE_ACCEPTED_TYPES.join(",");

type ChatRole = "user" | "assistant";

interface SuggestImage {
  imageBytes: string;
  mimeType: string;
}

interface PendingAttachment {
  data: string;
  mimeType: string;
  name: string;
}

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  images?: SuggestImage[];
  attachments?: PendingAttachment[];
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function base64ToDataUrl(base64: string, mimeType: string): string {
  const cleaned = base64.replace(/^data:[^;]+;base64,/, "");
  return `data:${mimeType || "image/png"};base64,${cleaned}`;
}

/** Bỏ metadata image-gen Flow2/ChatGPT (prompt, referenced_image_ids...) khỏi reply. */
function sanitizeAssistantReply(raw: string): string {
  const text = (raw || "").trim();
  if (!text) return "";
  if (/referenced_image_ids/i.test(text)) return "";
  if (/"prompt"\s*:/.test(text) && (/"n"\s*:\s*\d/.test(text) || /Negative prompt/i.test(text))) {
    return "";
  }
  if (/\d+x\d+"\s*,\s*"n"\s*:/.test(text)) return "";
  return text;
}

type SuggestSSEEvent = {
  type?: string;
  progress?: number;
  message?: string;
  data?: {
    reply?: string;
    images?: SuggestImage[];
    conversationId?: string;
    messageId?: string;
  };
};

function parseSuggestSSELine(line: string): SuggestSSEEvent | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;
  const jsonStr = trimmed.slice(5).trim();
  if (!jsonStr) return null;
  try {
    return JSON.parse(jsonStr) as SuggestSSEEvent;
  } catch {
    return null;
  }
}

async function consumeStoryboardSuggestSSE(
  res: Response,
  onProgress?: (message?: string) => void
): Promise<NonNullable<SuggestSSEEvent["data"]>> {
  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("Không đọc được stream AI gợi ý");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let doneData: SuggestSSEEvent["data"] | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const evt = parseSuggestSSELine(line);
      if (!evt?.type) continue;

      if (evt.type === "progress") {
        onProgress?.(evt.message);
      }
      if (evt.type === "done" && evt.data) {
        doneData = evt.data;
      }
      if (evt.type === "error") {
        throw new Error(evt.message || "Lỗi AI gợi ý storyboard");
      }
    }
  }

  const tail = parseSuggestSSELine(buffer);
  if (tail?.type === "error") {
    throw new Error(tail.message || "Lỗi AI gợi ý storyboard");
  }
  if (tail?.type === "done" && tail.data) {
    doneData = tail.data;
  }

  if (!doneData) {
    throw new Error("Không nhận được kết quả AI gợi ý");
  }

  return doneData;
}

export interface StoryboardAiSuggestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUseText: (text: string) => void;
  onUseImage: (image: ElementFormImage) => void;
}

export function StoryboardAiSuggestDialog({
  isOpen,
  onClose,
  onUseText,
  onUseImage,
}: StoryboardAiSuggestDialogProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { customer } = useAuth();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sceneCount, setSceneCount] = useState(DEFAULT_SCENES);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [parentMessageId, setParentMessageId] = useState<string | undefined>();
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);

  const sceneOptions = useMemo(() => Array.from({ length: MAX_SCENES }, (_, i) => i + 1), []);

  const handleSceneCountChange = useCallback((next: number) => {
    setSceneCount(Math.min(MAX_SCENES, Math.max(MIN_SCENES, next)));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) return;
    setMessages([]);
    setInput("");
    setConversationId(undefined);
    setParentMessageId(undefined);
    setPendingAttachments([]);
    setSceneCount(DEFAULT_SCENES);
    setLoadingMessage("");
  }, [isOpen]);

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (!list.length) return;

      const remaining = MAX_PENDING_ATTACHMENTS - pendingAttachments.length;
      if (remaining <= 0) {
        toast.error(t("Tối đa {{count}} ảnh", { count: MAX_PENDING_ATTACHMENTS }));
        return;
      }

      const toAdd: PendingAttachment[] = [];
      for (const file of list.slice(0, remaining)) {
        const isImage =
          GENERATION_IMAGE_ACCEPTED_TYPES.includes(file.type) ||
          /\.(jpe?g|png|webp|gif)$/i.test(file.name);
        if (!isImage) {
          toast.error(t("Chỉ hỗ trợ file ảnh (JPG, PNG, WebP, GIF)"));
          continue;
        }

        const sizeMB = file.size / (1024 * 1024);
        if (sizeMB > MAX_IMAGE_MB) {
          toast.error(`${file.name}: ${t("File quá lớn")}. ${t("Tối đa")} ${MAX_IMAGE_MB}MB`);
          continue;
        }

        try {
          const { imageBytes, mimeType } = await fileToGenerationImageBase64(file);
          toAdd.push({ data: imageBytes, mimeType, name: file.name });
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

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, loading]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    const attachments = pendingAttachments;
    if (!text || loading || !customer) return;

    const userMsg: ChatMessage = {
      id: newId(),
      role: "user",
      content: text,
      ...(attachments.length > 0 ? { attachments } : {}),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setPendingAttachments([]);
    setLoading(true);
    setLoadingMessage(t("Đang tạo ảnh storyboard..."));

    try {
      const res = await fetch("/api/app/storyboard-ai-suggest/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          sceneCount,
          conversationId,
          parentMessageId,
          ...(attachments.length > 0
            ? {
                images: attachments.map((att) => ({
                  imageBytes: att.data,
                  mimeType: att.mimeType,
                  name: att.name,
                })),
              }
            : {}),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || `Lỗi ${res.status}`);
      }

      const contentType = res.headers.get("content-type") || "";
      let reply = "";
      let images: SuggestImage[] = [];
      let nextConversationId: string | undefined;
      let nextMessageId: string | undefined;

      if (contentType.includes("event-stream")) {
        const data = await consumeStoryboardSuggestSSE(res, (message) => {
          if (message) setLoadingMessage(message);
        });
        reply = sanitizeAssistantReply(data.reply || "");
        images = data.images || [];
        nextConversationId = data.conversationId;
        nextMessageId = data.messageId;
      } else {
        // Fallback JSON sync (nếu proxy không giữ SSE)
        const result = await res.json();
        reply = sanitizeAssistantReply((result?.data?.reply as string) || "");
        images = (result?.data?.images as SuggestImage[]) || [];
        nextConversationId = result?.data?.conversationId as string | undefined;
        nextMessageId = result?.data?.messageId as string | undefined;
      }

      if (!reply && images.length === 0) {
        throw new Error(t("AI không trả lời"));
      }

      if (nextConversationId) setConversationId(nextConversationId);
      if (nextMessageId) setParentMessageId(nextMessageId);

      const assistantMsg: ChatMessage = {
        id: newId(),
        role: "assistant",
        content: reply,
        ...(images.length > 0 ? { images } : {}),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      toast.error(err?.message || t("Gửi tin nhắn thất bại"));
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      setInput(text);
      setPendingAttachments(attachments);
    } finally {
      setLoading(false);
      setLoadingMessage("");
      inputRef.current?.focus();
    }
  }, [
    input,
    loading,
    customer,
    sceneCount,
    conversationId,
    parentMessageId,
    pendingAttachments,
    t,
    toast,
  ]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void sendMessage();
      }
    },
    [sendMessage]
  );

  const handleUseText = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      onUseText(text.trim());
      toast.success(t("Đã gắn vào Nội dung"));
    },
    [onUseText, t, toast]
  );

  const handleUseImage = useCallback(
    (img: SuggestImage, index: number) => {
      onUseImage({
        fifeUrl: "",
        imageBytes: img.imageBytes.replace(/^data:[^;]+;base64,/, ""),
        mimeType: img.mimeType || "image/png",
        name: `storyboard-ai-${Date.now()}-${index + 1}.png`,
      });
      toast.success(t("Đã gắn vào Ảnh Storyboard"));
    },
    [onUseImage, t, toast]
  );

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("AI gợi ý Storyboard")}
      width="720px"
      maxWidth="95vw"
      slideFromBottom="mobile-only"
      extraDialogClass="flex flex-col"
      extraBodyClass="!p-0 flex flex-col flex-1 min-h-0"
    >
      <Dialog.Body>
        <div className="flex flex-col h-min-md min-h-md">
          <div ref={listRef} className="overflow-y-auto flex-1 px-4 py-3 space-y-3 min-h-0">
            {messages.length === 0 && !loading ? (
              <div className="flex flex-col justify-center items-center px-4 h-full text-center text-gray-400 rounded-md">
                <RiMagicFill className="mb-2 text-3xl text-primary/40" />
                <p className="text-sm">
                  {t("VD: Web tạo video AI cho YouTuber, tool Veo 3, làm affiliate")}
                </p>
              </div>
            ) : null}

            {messages.map((m) => (
              <SuggestMessageBubble
                key={m.id}
                message={m}
                onUseText={handleUseText}
                onUseImage={handleUseImage}
              />
            ))}

            {loading ? (
              <div className="flex justify-start">
                <div className="inline-flex gap-2 items-center px-3 py-2 text-sm text-gray-500 bg-gray-100 rounded-2xl rounded-bl-md">
                  <RiLoader4Line className="animate-spin flex-shrink-0" />
                  <span>{loadingMessage || t("Đang tạo ảnh storyboard...")}</span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="bg-white border-gray-200">
            <input
              ref={fileInputRef}
              type="file"
              accept={`${FILE_ACCEPT},${GENERATION_IMAGE_ACCEPTED_EXTENSIONS}`}
              multiple
              className="hidden"
              onChange={onFilesSelected}
              disabled={loading || !customer}
            />
            {pendingAttachments.length > 0 ? (
              <div className="flex overflow-x-auto gap-2 px-3 pt-2">
                {pendingAttachments.map((att, index) => (
                  <PendingAttachmentThumb
                    key={`${att.name}-${index}`}
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
                  loading || !customer ? "bg-gray-50" : "bg-white"
                }`}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  disabled={loading || !customer}
                  rows={3}
                  placeholder={t("Nhập ý tưởng ngắn — AI tạo ảnh storyboard")}
                  className="block px-3 py-2 pr-3 pb-14 w-full text-sm bg-transparent rounded-xl border-0 resize-none focus:outline-none disabled:cursor-not-allowed"
                />
                <div className="flex absolute right-2 bottom-2 gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={
                      loading || !customer || pendingAttachments.length >= MAX_PENDING_ATTACHMENTS
                    }
                    className="flex flex-shrink-0 justify-center items-center w-9 h-9 text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={t("Đính kèm ảnh tham chiếu")}
                  >
                    <RiAttachment2 />
                  </button>
                  <label className="flex gap-1 items-center text-xs text-gray-600">
                    <span className="hidden sm:inline">{t("Phân cảnh")}</span>
                    <select
                      value={sceneCount}
                      onChange={(e) => handleSceneCountChange(Number(e.target.value))}
                      disabled={loading || !customer}
                      className="px-2 h-9 text-sm bg-white rounded-lg border border-gray-200 disabled:opacity-50"
                      title={t("Số phân cảnh (1-30)")}
                    >
                      {sceneOptions.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => void sendMessage()}
                    disabled={loading || !input.trim() || !customer}
                    className="flex flex-shrink-0 justify-center items-center w-9 h-9 text-white rounded-lg bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
                    title={t("Gửi")}
                  >
                    <RiSendPlaneFill />
                  </button>
                </div>
              </div>
              <p className="mt-1.5 text-[11px] text-gray-400">
                {t("Thời lượng")}: {sceneCount * SECONDS_PER_SCENE}s · {sceneCount} {t("phân cảnh")}
              </p>
            </div>
          </div>
        </div>
      </Dialog.Body>
    </Dialog>
  );
}

function SuggestMessageBubble({
  message,
  onUseText,
  onUseImage,
}: {
  message: ChatMessage;
  onUseText: (text: string) => void;
  onUseImage: (img: SuggestImage, index: number) => void;
}) {
  const { t } = useTranslation();
  const isUser = message.role === "user";
  const hasContent = Boolean(message.content?.trim());
  const images = message.images || [];
  const attachments = message.attachments || [];

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
          isUser ? "bg-primary text-white rounded-br-md" : "bg-gray-100 text-gray-800 rounded-bl-md"
        }`}
      >
        {attachments.length > 0 ? (
          <div className={`flex flex-wrap gap-1.5 ${hasContent ? "mb-2" : ""}`}>
            {attachments.map((att, i) => (
              <div
                key={`${message.id}-att-${i}`}
                className="overflow-hidden w-14 h-14 rounded-lg border border-white/30"
              >
                <img
                  src={base64ToDataUrl(att.data, att.mimeType)}
                  alt={att.name}
                  className="object-cover w-full h-full"
                />
              </div>
            ))}
          </div>
        ) : null}

        {hasContent ? <span className="block">{message.content}</span> : null}

        {!isUser && hasContent ? (
          <div className="mt-2">
            <Button
              outline
              info
              className="px-2 h-7 text-xs"
              text={t("Sử dụng ngay")}
              onClick={() => onUseText(message.content)}
            />
          </div>
        ) : null}

        {images.length > 0 ? (
          <div className={`space-y-2 ${hasContent ? "mt-2" : ""}`}>
            {images.map((img, index) => (
              <div
                key={`${message.id}-img-${index}`}
                className="overflow-hidden bg-white rounded-xl border border-gray-200"
              >
                <Img
                  src={base64ToDataUrl(img.imageBytes, img.mimeType)}
                  alt=""
                  contain
                  showImageOnClick
                  lazyload={false}
                  className="w-full bg-gray-50"
                  imageClassName="object-contain w-full "
                  imageDialogClassName="object-contain max-w-full "
                />
                <div className="flex justify-end p-2">
                  <Button
                    outline
                    info
                    className="px-2 h-7 text-xs"
                    text={t("Sử dụng ngay")}
                    onClick={() => onUseImage(img, index)}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {!isUser && !hasContent && images.length === 0 ? (
          <span className="text-gray-500">{t("Không có kết quả")}</span>
        ) : null}
      </div>
    </div>
  );
}

function PendingAttachmentThumb({
  attachment,
  onRemove,
}: {
  attachment: PendingAttachment;
  onRemove: () => void;
}) {
  const previewSrc = base64ToDataUrl(attachment.data, attachment.mimeType);

  return (
    <div className="relative flex-shrink-0">
      <div className="overflow-hidden w-14 h-14 rounded-lg border border-gray-200">
        <img src={previewSrc} alt={attachment.name} className="object-cover w-full h-full" />
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="flex absolute -top-1 -right-1 justify-center items-center w-5 h-5 text-white bg-gray-800 rounded-full hover:bg-gray-900"
      >
        <RiCloseLine className="text-xs" />
      </button>
    </div>
  );
}
