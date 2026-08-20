/**
 * shared/voice-export-dialog.tsx
 * Dialog xuất Voice: Dialogue, Audio và TTS AI – dùng chung cho các batch action bar
 */
import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MdRecordVoiceOver } from "react-icons/md";
import {
  RiCheckLine,
  RiClipboardLine,
  RiCloseLine,
  RiDownloadLine,
  RiLoader4Line,
  RiMagicLine,
  RiSaveLine,
} from "react-icons/ri";
import { useOptionsTranslation } from "../../../../lib/hooks/useOptionsTranslate";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { useToast } from "../../../../lib/providers/toast-provider";
import { Dialog } from "../../../shared/utilities/dialog/dialog";
import { Select } from "../../../shared/utilities/form";
import {
  createFreeGenAudio,
  fetchFreeGenAudioOutputBlobWithRetry,
  pollFreeGenAudioJob,
} from "../../voice/free-voice-api";
import { FREE_GEN_AUDIO_VOICES } from "../../voice/free-voice-voices";
import {
  createTextToSpeech,
  fetchVoiceJobOutputBlobWithRetry,
  jobIdOf,
  pollVoiceJob,
  voiceJobErrorMessage,
} from "../../voice/voice-api";
import { VoiceWaveformPlayer } from "../../voice/voice-catalog-card";
import { VoiceProvider } from "../../voice/voice-provider";
import { VoicesCatalogPanel } from "../../voice/voice-tools";
import { getVoiceTool } from "../../voice/voice-tools-config";
import type { MicroxVoice } from "../../voice/voice-types";
import { voiceIdOf } from "../../voice/voice-types";
import {
  dialogueTextForTts,
  generatedAudioToBlob,
  loadVoiceExportAudio,
  saveVoiceExportAudio,
  voiceDialogueCacheKey,
  voiceMergedCacheKey,
  type GetGeneratedAudioFn,
  type SaveGeneratedAudioFn,
  type VoiceExportAudioRecord,
} from "./voice-export-audio-cache";

const TTS_WAVE_COLOR = getVoiceTool("tts").color;
const VOICE_BATCH_CONCURRENCY = 3;
const DIALOGUE_INPUT_MAX = 450;

function dialogueInputOverLimit(text: string): boolean {
  return text.length > DIALOGUE_INPUT_MAX;
}

function DialogueTextarea({
  value,
  onChange,
  rows = 3,
  className = "",
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  className?: string;
  placeholder?: string;
}) {
  const { t } = useTranslation();
  const overLimit = dialogueInputOverLimit(value);

  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, DIALOGUE_INPUT_MAX))}
        rows={rows}
        placeholder={placeholder}
        className={`w-full px-2.5 py-2 text-xs leading-relaxed text-gray-700 bg-white rounded-lg border outline-none resize-y min-h-[4.5rem] focus:ring-1 ${
          overLimit
            ? "border-red-400 focus:border-red-500 focus:ring-red-200"
            : "border-gray-200 focus:border-purple-400 focus:ring-purple-200"
        } ${className}`}
      />
      <div
        className={`mt-1 text-right text-10 leading-none ${overLimit ? "font-semibold text-red-500" : "text-gray-400"}`}
      >
        {value.length}/{DIALOGUE_INPUT_MAX}
        {overLimit ? ` — ${t("Vượt giới hạn {{max}} ký tự", { max: DIALOGUE_INPUT_MAX })}` : null}
      </div>
    </div>
  );
} 

export type DialogueItem = {
  sceneId: string;
  label: string;
  text: string;
};

type TtsTier = "free" | "paid";

type ItemState = {
  generating: boolean;
  audioUrl: string | null;
  error: string | null;
};

const DEFAULT_ITEM_STATE: ItemState = { generating: false, audioUrl: null, error: null };

export interface VoiceExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  dialogueCopied: boolean;
  dialogueExportText: string;
  /** Individual dialogue items per scene (for split mode) */
  dialogueItems?: DialogueItem[];
  audioExportText: string;
  handleCopyDialogue: () => void;
  ttsGenerating: boolean;
  ttsAudioUrl: string | null;
  ttsVoiceName: string;
  setTtsVoiceName: (val: string) => void;
  ttsAudioRef: RefObject<HTMLAudioElement | null>;
  handleGenerateTTS: () => void;
  handleDownloadTTSAudio: () => void;
  getGeneratedAudio?: GetGeneratedAudioFn;
  saveGeneratedAudio?: SaveGeneratedAudioFn;
  onSaveDialogue?: (updates: { sceneId: string; text: string }[]) => void | Promise<void>;
}

function unwrapQuotedDialogue(line: string): string {
  const trimmed = line.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function collectQuotedDialogueParts(text: string): string[] {
  const quoted: string[] = [];
  const regex = /"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    quoted.push(match[1] || "");
  }
  return quoted;
}

function splitMergedDialogueParts(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const quoted = collectQuotedDialogueParts(trimmed);
  if (quoted.length) return quoted;
  return trimmed.split(",").map((part) => part.trim());
}

function buildMergedDialogueText(items: DialogueItem[]): string {
  return items
    .map((item) => `"${String(item.text || "").replace(/"/g, "")}"`)
    .join(", ");
}

function applyMergedDraftToItems(draft: string, items: DialogueItem[]): DialogueItem[] {
  const parts = splitMergedDialogueParts(draft);
  return items.map((item, i) => ({
    ...item,
    text: unwrapQuotedDialogue(parts[i] ?? ""),
  }));
}

function TierTabs({
  tier,
  onChange,
  textCredits,
}: {
  tier: TtsTier;
  onChange: (t: TtsTier) => void;
  textCredits?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1 p-1 bg-gray-50 rounded-lg border border-gray-100">
        {(["free", "paid"] as TtsTier[]).map((id) => {
          const selected = tier === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className="flex-1 px-2 py-1.5 text-xs font-bold rounded-md border-0 cursor-pointer"
              style={{
                color: selected ? "#8b5cf6" : "#6b7280",
                background: selected ? "#8b5cf614" : "transparent",
              }}
            >
              {id === "free" ? t("Miễn phí") : t("Thu phí")}
            </button>
          );
        })}
      </div>
      {tier === "paid" && textCredits ? (
        <p className="m-0 text-xs text-gray-500">
          {t("Text credit")}: <span className="font-semibold text-gray-700">{textCredits}</span>
        </p>
      ) : null}
    </div>
  );
}

function FreeVoiceSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-gray-600">{t("Giọng (Miễn phí)")}</div>
      <select
        className="px-3 py-2 w-full text-sm bg-white rounded-lg border"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {FREE_GEN_AUDIO_VOICES.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name} — {item.description}
          </option>
        ))}
      </select>
    </div>
  );
}

function PaidVoiceSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  const { BUILTIN_VOICES } = useOptionsTranslation();
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-gray-600">{t("Giọng (Thu phí)")}</div>
      <Select
        menuPosition="fixed"
        menuPlacement="auto"
        value={value}
        onChange={(val: string) => onChange(val)}
        options={BUILTIN_VOICES.map((v) => ({ value: v.value, label: v.label }))}
        className="text-xs"
      />
    </div>
  );
}

function VoiceAssignmentPicker({
  value,
  onChange,
}: {
  value: MicroxVoice | null;
  onChange: (voice: MicroxVoice) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 w-full text-left bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50"
      >
        {value ? (
          <span className="block font-semibold text-gray-800 truncate text-12">
            {String(value.name || value.display_name || voiceIdOf(value))}
          </span>
        ) : (
          <span className="text-sm font-medium text-gray-600">{t("Chọn giọng từ danh sách")}</span>
        )}
      </button>

      <Dialog
        isOpen={open}
        onClose={() => setOpen(false)}
        title={t("Danh sách giọng")}
        width={980}
        maxWidth="95vw"
        slideFromBottom="none"
      >
        <Dialog.Body>
          <div className="overflow-y-auto pt-2 v-scrollbar" style={{ maxHeight: "75vh" }}>
            {open ? (
              <VoiceProvider
                syncUrl={false}
                initialTool="voices"
                allowedTools={["voices"]}
                layout="stack"
              >
                <VoicesCatalogPanel
                  layout="modal"
                  onPick={(voice) => {
                    onChange(voice);
                    setOpen(false);
                  }}
                />
              </VoiceProvider>
            ) : null}
          </div>
        </Dialog.Body>
      </Dialog>
    </>
  );
}

// ─── Merged (gọp thoại) section ──────────────────────────────────────────────

function MergedTtsSection({
  tier,
  isOpen,
  dialogueExportText,
  audioExportText,
  ttsGenerating,
  ttsAudioUrl,
  ttsVoiceName,
  setTtsVoiceName,
  ttsAudioRef,
  handleGenerateTTS,
  handleDownloadTTSAudio,
  getGeneratedAudio,
  saveGeneratedAudio,
}: {
  tier: TtsTier;
  isOpen: boolean;
  dialogueExportText: string;
  audioExportText: string;
  ttsGenerating: boolean;
  ttsAudioUrl: string | null;
  ttsVoiceName: string;
  setTtsVoiceName: (v: string) => void;
  ttsAudioRef: RefObject<HTMLAudioElement | null>;
  handleGenerateTTS: () => void;
  handleDownloadTTSAudio: () => void;
  getGeneratedAudio?: GetGeneratedAudioFn;
  saveGeneratedAudio?: SaveGeneratedAudioFn;
}) {
  const { t } = useTranslation();
  const [freeVoice, setFreeVoice] = useState(FREE_GEN_AUDIO_VOICES[0]?.id || "achernar");
  const [selectedVoice, setSelectedVoice] = useState<MicroxVoice | null>(null);

  const [freeGenerating, setFreeGenerating] = useState(false);
  const [freeAudioUrl, setFreeAudioUrl] = useState<string | null>(null);
  const [paidGenerating, setPaidGenerating] = useState(false);
  const [paidAudioUrl, setPaidAudioUrl] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const freeAudioUrlRef = useRef<string | null>(null);
  const paidAudioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    let loadedUrl: string | null = null;

    (async () => {
      const saved = await loadVoiceExportAudio(
        getGeneratedAudio,
        voiceMergedCacheKey(),
        dialogueExportText
      );
      if (cancelled || !saved) return;
      const blob = generatedAudioToBlob(saved);
      loadedUrl = URL.createObjectURL(blob);

      if (tier === "free" && (saved.tier === "free" || !saved.tier)) {
        freeAudioUrlRef.current = loadedUrl;
        setFreeAudioUrl(loadedUrl);
        if (saved.freeVoiceId) setFreeVoice(saved.freeVoiceId);
        return;
      }

      if (tier === "paid" && saved.tier === "paid") {
        paidAudioUrlRef.current = loadedUrl;
        setPaidAudioUrl(loadedUrl);
        if (saved.paidVoiceId) {
          setSelectedVoice({
            id: saved.paidVoiceId,
            voice_id: saved.paidVoiceId,
            name: saved.paidVoiceName || saved.paidVoiceId,
          });
        }
        return;
      }

      URL.revokeObjectURL(loadedUrl);
      loadedUrl = null;
    })();

    return () => {
      cancelled = true;
      if (loadedUrl) URL.revokeObjectURL(loadedUrl);
    };
  }, [isOpen, tier, dialogueExportText, getGeneratedAudio]);

  useEffect(() => {
    return () => {
      if (freeAudioUrlRef.current) {
        URL.revokeObjectURL(freeAudioUrlRef.current);
        freeAudioUrlRef.current = null;
      }
      if (paidAudioUrlRef.current) {
        URL.revokeObjectURL(paidAudioUrlRef.current);
        paidAudioUrlRef.current = null;
      }
    };
  }, []);

  const handleGenerateFree = useCallback(async () => {
    if (freeGenerating || !dialogueExportText) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setFreeGenerating(true);
    if (freeAudioUrlRef.current) {
      URL.revokeObjectURL(freeAudioUrlRef.current);
      freeAudioUrlRef.current = null;
    }
    setFreeAudioUrl(null);
    try {
      const job = await createFreeGenAudio(
        { text: dialogueTextForTts(dialogueExportText), voice: freeVoice },
        ctrl.signal
      );
      const jobId = jobIdOf(job);
      if (!jobId) throw new Error("Không lấy được jobId");
      const done = await pollFreeGenAudioJob(jobId, undefined, ctrl.signal);
      if (String(done?.status || "").toLowerCase() === "failed") {
        throw new Error(voiceJobErrorMessage(done) || t("Job thất bại"));
      }
      const blob = await fetchFreeGenAudioOutputBlobWithRetry(jobId, 0, ctrl.signal, done);
      if (blob) {
        const url = URL.createObjectURL(blob);
        freeAudioUrlRef.current = url;
        setFreeAudioUrl(url);
        await saveVoiceExportAudio(saveGeneratedAudio, voiceMergedCacheKey(), blob, {
          text: dialogueExportText,
          tier: "free",
          freeVoiceId: freeVoice,
        });
      } else {
        throw new Error(t("Không tạo được audio"));
      }
    } catch {
      // silently
    } finally {
      setFreeGenerating(false);
    }
  }, [freeGenerating, dialogueExportText, freeVoice, saveGeneratedAudio, t]);

  const handleDownloadFree = useCallback(() => {
    if (!freeAudioUrl) return;
    const a = document.createElement("a");
    a.href = freeAudioUrl;
    a.download = "dialogue-voice.mp3";
    a.click();
  }, [freeAudioUrl]);

  const handleGeneratePaid = useCallback(async () => {
    const voiceId = voiceIdOf(selectedVoice);
    if (paidGenerating || !dialogueExportText || !voiceId) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPaidGenerating(true);
    if (paidAudioUrlRef.current) {
      URL.revokeObjectURL(paidAudioUrlRef.current);
      paidAudioUrlRef.current = null;
    }
    setPaidAudioUrl(null);
    try {
      const job = await createTextToSpeech(
        {
          voice_id: voiceId,
          text: dialogueTextForTts(dialogueExportText),
          speed: 1,
          creativity: 0.5,
        },
        ctrl.signal
      );
      const id = jobIdOf(job);
      if (!id) throw new Error("Không lấy được jobId");
      const done = await pollVoiceJob(id, undefined, ctrl.signal, "tts");
      if (String(done?.status || "").toLowerCase() === "failed") {
        throw new Error(voiceJobErrorMessage(done) || t("Job thất bại"));
      }
      const blob = await fetchVoiceJobOutputBlobWithRetry(id, 0, ctrl.signal);
      if (blob) {
        const url = URL.createObjectURL(blob);
        paidAudioUrlRef.current = url;
        setPaidAudioUrl(url);
        await saveVoiceExportAudio(saveGeneratedAudio, voiceMergedCacheKey(), blob, {
          text: dialogueExportText,
          tier: "paid",
          paidVoiceId: voiceId,
          paidVoiceName: String(
            selectedVoice?.name || selectedVoice?.display_name || voiceId
          ),
        });
      } else {
        throw new Error(t("Không tạo được audio"));
      }
    } catch {
      // silently
    } finally {
      setPaidGenerating(false);
    }
  }, [
    paidGenerating,
    dialogueExportText,
    selectedVoice,
    saveGeneratedAudio,
    t,
  ]);

  const handleDownloadPaid = useCallback(() => {
    if (!paidAudioUrl) return;
    const a = document.createElement("a");
    a.href = paidAudioUrl;
    a.download = "dialogue-voice.mp3";
    a.click();
  }, [paidAudioUrl]);

  return (
    <div className="space-y-3">
      {tier === "free" ? (
        <>
          <FreeVoiceSelect value={freeVoice} onChange={setFreeVoice} />
          <button
            type="button"
            disabled={freeGenerating || !dialogueExportText || dialogueInputOverLimit(dialogueExportText)}
            onClick={() => void handleGenerateFree()}
            className="flex gap-1.5 justify-center items-center w-full h-9 text-sm font-semibold text-white rounded-full border-0 cursor-pointer disabled:opacity-60"
            style={{ background: freeGenerating ? "#a78bfa" : "#8b5cf6" }}
          >
            {freeGenerating ? <RiLoader4Line className="animate-spin" /> : <RiMagicLine />}
            {freeGenerating ? t("Đang tạo...") : t("Tạo giọng nói")}
          </button>
          {freeAudioUrl && (
            <div className="pt-2 border-t border-gray-100">
              <VoiceWaveformPlayer
                src={freeAudioUrl}
                color={TTS_WAVE_COLOR}
                onDownload={(e) => {
                  e.stopPropagation();
                  handleDownloadFree();
                }}
              />
            </div>
          )}
          {!freeAudioUrl && !freeGenerating && (
            <div className="py-3 text-xs text-center text-gray-400 rounded-xl border border-gray-200 border-dashed">
              {t("Chọn giọng và nhấn Tạo giọng nói")}
            </div>
          )}
        </>
      ) : (
        <>
          <div>
            <div className="mb-1 text-xs font-medium text-gray-600">
              {t("Giọng cho tất cả thoại")}
            </div>
            <VoiceAssignmentPicker value={selectedVoice} onChange={setSelectedVoice} />
          </div>
          <button
            type="button"
            disabled={paidGenerating || !dialogueExportText || !voiceIdOf(selectedVoice) || dialogueInputOverLimit(dialogueExportText)}
            onClick={() => void handleGeneratePaid()}
            className="flex gap-1.5 justify-center items-center w-full h-9 text-sm font-semibold text-white rounded-full border-0 cursor-pointer disabled:opacity-60"
            style={{ background: paidGenerating ? "#a78bfa" : "#8b5cf6" }}
          >
            {paidGenerating ? <RiLoader4Line className="animate-spin" /> : <RiMagicLine />}
            {paidGenerating ? t("Đang tạo...") : t("Tạo giọng nói")}
          </button>
          {paidAudioUrl && (
            <div className="pt-2 border-t border-gray-100">
              <VoiceWaveformPlayer
                src={paidAudioUrl}
                color={TTS_WAVE_COLOR}
                onDownload={(e) => {
                  e.stopPropagation();
                  handleDownloadPaid();
                }}
              />
            </div>
          )}
          {!paidAudioUrl && !paidGenerating && (
            <div className="py-3 text-xs text-center text-gray-400 rounded-xl border border-gray-200 border-dashed">
              {t("Chọn giọng và nhấn Tạo giọng nói")}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Split (tách thoại) section ───────────────────────────────────────────────

type ItemAudioState = {
  generating: boolean;
  audioBlob: Blob | null;
  audioUrl: string | null;
  error: string | null;
  selectedVoice: MicroxVoice | null;
  selectedFreeVoice: string;
  selectedPaidVoice: MicroxVoice | null;
};

function emptyItemAudioState(): ItemAudioState {
  return {
    generating: false,
    audioBlob: null,
    audioUrl: null,
    error: null,
    selectedVoice: null,
    selectedFreeVoice: FREE_GEN_AUDIO_VOICES[0]?.id || "achernar",
    selectedPaidVoice: null,
  };
}

function resolveItemFreeVoice(row: ItemAudioState): string {
  return row.selectedFreeVoice || FREE_GEN_AUDIO_VOICES[0]?.id || "achernar";
}

function itemStateFromCache(saved: VoiceExportAudioRecord): ItemAudioState {
  const blob = generatedAudioToBlob(saved);
  return {
    ...emptyItemAudioState(),
    audioBlob: blob,
    audioUrl: URL.createObjectURL(blob),
    selectedFreeVoice: saved.freeVoiceId || emptyItemAudioState().selectedFreeVoice,
    selectedPaidVoice: saved.paidVoiceId
      ? {
          id: saved.paidVoiceId,
          voice_id: saved.paidVoiceId,
          name: saved.paidVoiceName || saved.paidVoiceId,
        }
      : null,
  };
}

function SplitDialogueItem({
  item,
  index,
  tier,
  globalPaidVoice,
  itemState,
  onStateChange,
  onChangeText,
  onSaveText,
  isDirty,
  persistItemAudio,
}: {
  item: DialogueItem;
  index: number;
  tier: TtsTier;
  globalPaidVoice: MicroxVoice | null;
  itemState: ItemAudioState;
  onStateChange: (state: Partial<ItemAudioState>) => void;
  onChangeText: (text: string) => void;
  onSaveText: () => void;
  isDirty: boolean;
  persistItemAudio?: (
    item: DialogueItem,
    blob: Blob,
    meta: {
      tier: TtsTier;
      freeVoiceId?: string;
      paidVoiceId?: string;
      paidVoiceName?: string;
    }
  ) => Promise<void>;
}) {
  const { t } = useTranslation();
  const abortRef = useRef<AbortController | null>(null);

  const handleGenerate = useCallback(async () => {
    if (itemState.generating || !item.text) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    onStateChange({ generating: true, audioBlob: null, audioUrl: null, error: null });
    try {
      if (tier === "free") {
        const job = await createFreeGenAudio(
          {
            text: dialogueTextForTts(item.text),
            voice: resolveItemFreeVoice(itemState),
          },
          ctrl.signal
        );
        const jobId = jobIdOf(job);
        if (!jobId) throw new Error("Không lấy được jobId");
        const done = await pollFreeGenAudioJob(jobId, undefined, ctrl.signal);
        if (String(done?.status || "").toLowerCase() === "failed") {
          throw new Error(voiceJobErrorMessage(done) || t("Job thất bại"));
        }
        const blob = await fetchFreeGenAudioOutputBlobWithRetry(jobId, 0, ctrl.signal, done);
        if (blob) {
          const url = URL.createObjectURL(blob);
          onStateChange({ generating: false, audioBlob: blob, audioUrl: url, error: null });
          void persistItemAudio?.(item, blob, {
            tier: "free",
            freeVoiceId: resolveItemFreeVoice(itemState),
          });
          return;
        }
      } else {
        const pickedPaidVoice = itemState.selectedPaidVoice || globalPaidVoice;
        const voiceId = voiceIdOf(pickedPaidVoice);
        if (!voiceId) throw new Error(t("Chọn giọng cho thoại"));
        const job = await createTextToSpeech(
          {
            voice_id: voiceId,
            text: dialogueTextForTts(item.text),
            speed: 1,
            creativity: 0.5,
          },
          ctrl.signal
        );
        const id = jobIdOf(job);
        if (!id) throw new Error("Không lấy được jobId");
        const done = await pollVoiceJob(id, undefined, ctrl.signal, "tts");
        if (String(done?.status || "").toLowerCase() === "failed") {
          throw new Error(voiceJobErrorMessage(done) || t("Job thất bại"));
        }
        const blob = await fetchVoiceJobOutputBlobWithRetry(id, 0, ctrl.signal);
        if (blob) {
          const url = URL.createObjectURL(blob);
          onStateChange({ generating: false, audioBlob: blob, audioUrl: url, error: null });
          void persistItemAudio?.(item, blob, {
            tier: "paid",
            paidVoiceId: voiceId,
            paidVoiceName: String(
              pickedPaidVoice?.name || pickedPaidVoice?.display_name || voiceId
            ),
          });
          return;
        }
      }
      onStateChange({ generating: false, error: t("Không tạo được audio") });
    } catch (e: any) {
      if (e?.name !== "AbortError")
        onStateChange({ generating: false, error: e?.message || t("Lỗi") });
    }
  }, [
    tier,
    item.text,
    itemState.generating,
    itemState.selectedFreeVoice,
    itemState.selectedPaidVoice,
    globalPaidVoice,
    onStateChange,
    persistItemAudio,
    t,
  ]);

  const handleDownload = useCallback(() => {
    if (!itemState.audioUrl) return;
    const a = document.createElement("a");
    a.href = itemState.audioUrl;
    a.download = `${item.label.replace(/\s+/g, "-")}.mp3`;
    a.click();
  }, [itemState.audioUrl, item.label]);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <div className="flex gap-2 items-center px-3 py-2 bg-gray-50 border-b border-gray-100">
        <span className="flex flex-shrink-0 justify-center items-center w-5 h-5 text-xs font-bold text-purple-700 bg-purple-100 rounded-full">
          {index + 1}
        </span>
        <span className="min-w-0 text-xs font-semibold text-gray-700 truncate">{item.label}</span>
        <div className="flex-1 min-w-0">
          {tier === "free" ? (
            <select
              className="w-full px-2 py-1.5 text-xs rounded-lg border bg-white"
              value={itemState.selectedFreeVoice}
              onChange={(e) => onStateChange({ selectedFreeVoice: e.target.value })}
            >
              {FREE_GEN_AUDIO_VOICES.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name} - {voice.description}
                </option>
              ))}
            </select>
          ) : (
            <VoiceAssignmentPicker
              value={itemState.selectedPaidVoice || globalPaidVoice}
              onChange={(voice) => onStateChange({ selectedPaidVoice: voice })}
            />
          )}
        </div>
        <button
          type="button"
          disabled={
            itemState.generating ||
            !item.text ||
            dialogueInputOverLimit(item.text) ||
            (tier === "paid" && !voiceIdOf(itemState.selectedPaidVoice || globalPaidVoice))
          }
          onClick={() => void handleGenerate()}
          className="flex flex-shrink-0 gap-1 items-center px-2 h-6 text-xs font-semibold text-white rounded-lg border-0 cursor-pointer disabled:opacity-60"
          style={{ background: itemState.generating ? "#a78bfa" : "#8b5cf6" }}
        >
          {itemState.generating ? (
            <RiLoader4Line className="text-xs animate-spin" />
          ) : (
            <RiMagicLine className="text-xs" />
          )}
          {itemState.generating ? t("Đang tạo") : t("Tạo")}
        </button>
      </div>
      <div className="px-3 py-2">
        <DialogueTextarea value={item.text} onChange={onChangeText} rows={3} />
        {isDirty ? (
          <div className="flex justify-end mt-1.5">
            <button
              type="button"
              onClick={onSaveText}
              disabled={dialogueInputOverLimit(item.text)}
              className="inline-flex items-center gap-1.5 px-2 h-6 text-10 font-semibold text-white rounded-md border-0 cursor-pointer disabled:opacity-60 bg-primary"
            
            >
              <RiSaveLine className="text-xs shrink-0" />
              <span>{t("Lưu")}</span>
            </button>
          </div>
        ) : null}
      </div>
      {itemState.audioUrl && (
        <div className="px-3 pt-1 pb-2 border-t border-gray-100">
          <VoiceWaveformPlayer
            src={itemState.audioUrl}
            color={TTS_WAVE_COLOR}
            onDownload={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
          />
        </div>
      )}
      {itemState.error ? (
        <div className="px-3 pb-2 text-xs text-red-500">{itemState.error}</div>
      ) : null}
    </div>
  );
}

function SplitDialogueSection({
  tier,
  isOpen,
  items,
  ttsVoiceName,
  setTtsVoiceName,
  ttsGenerating,
  ttsAudioUrl,
  ttsAudioRef,
  handleGenerateTTS,
  handleDownloadTTSAudio,
  dialogueCopied,
  handleCopyDialogue,
  dialogueExportText,
  getGeneratedAudio,
  saveGeneratedAudio,
  onChangeItemText,
  onSaveItemText,
  isItemDirty,
}: {
  tier: TtsTier;
  isOpen: boolean;
  items: DialogueItem[];
  ttsVoiceName: string;
  setTtsVoiceName: (v: string) => void;
  ttsGenerating: boolean;
  ttsAudioUrl: string | null;
  ttsAudioRef: RefObject<HTMLAudioElement | null>;
  handleGenerateTTS: () => void;
  handleDownloadTTSAudio: () => void;
  dialogueCopied: boolean;
  handleCopyDialogue: () => void;
  dialogueExportText: string;
  getGeneratedAudio?: GetGeneratedAudioFn;
  saveGeneratedAudio?: SaveGeneratedAudioFn;
  onChangeItemText: (index: number, text: string) => void;
  onSaveItemText: (item: DialogueItem) => void;
  isItemDirty: (item: DialogueItem) => boolean;
}) {
  const { t } = useTranslation();
  const [globalFreeVoice, setGlobalFreeVoice] = useState(
    FREE_GEN_AUDIO_VOICES[0]?.id || "achernar"
  );
  const [globalPaidVoice, setGlobalPaidVoice] = useState<MicroxVoice | null>(null);
  const [itemStates, setItemStates] = useState<ItemAudioState[]>(() =>
    items.map(() => emptyItemAudioState())
  );

  const [batchRunning, setBatchRunning] = useState(false);
  const [batchDoneCount, setBatchDoneCount] = useState(0);
  const batchAbortRef = useRef<AbortController | null>(null);
  const itemUrlsRef = useRef<string[]>([]);
  const itemStatesRef = useRef(itemStates);
  itemStatesRef.current = itemStates;

  const syncItemStates = useCallback((next: ItemAudioState[]) => {
    itemStatesRef.current = next;
    setItemStates(next);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const createdUrls: string[] = [];

    (async () => {
      if (!getGeneratedAudio) {
        if (!cancelled) syncItemStates(items.map(() => emptyItemAudioState()));
        return;
      }
      const loaded = await Promise.all(
        items.map(async (item) => {
          if (!item.sceneId) return emptyItemAudioState();
          const saved = await loadVoiceExportAudio(
            getGeneratedAudio,
            voiceDialogueCacheKey(item.sceneId),
            item.text
          );
          if (!saved) return emptyItemAudioState();
          const state = itemStateFromCache(saved);
          if (state.audioUrl) createdUrls.push(state.audioUrl);
          return state;
        })
      );
      if (!cancelled) {
        itemUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        itemUrlsRef.current = createdUrls;
        syncItemStates(loaded);
        const firstFree = loaded.find((s) => s.selectedFreeVoice)?.selectedFreeVoice;
        if (firstFree) setGlobalFreeVoice(firstFree);
      } else {
        createdUrls.forEach((url) => URL.revokeObjectURL(url));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, items, getGeneratedAudio, syncItemStates]);

  useEffect(() => {
    return () => {
      itemUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      itemUrlsRef.current = [];
    };
  }, []);

  const persistItemAudio = useCallback(
    async (
      item: DialogueItem,
      blob: Blob,
      meta: {
        tier: TtsTier;
        freeVoiceId?: string;
        paidVoiceId?: string;
        paidVoiceName?: string;
      }
    ) => {
      if (!saveGeneratedAudio || !item.sceneId) return;
      await saveVoiceExportAudio(
        saveGeneratedAudio,
        voiceDialogueCacheKey(item.sceneId),
        blob,
        {
          text: item.text,
          tier: meta.tier,
          freeVoiceId: meta.freeVoiceId,
          paidVoiceId: meta.paidVoiceId,
          paidVoiceName: meta.paidVoiceName,
        }
      );
    },
    [saveGeneratedAudio]
  );

  const updateItem = useCallback((index: number, patch: Partial<ItemAudioState>) => {
    setItemStates((prev) => {
      const next = [...prev];
      next[index] = { ...next[index]!, ...patch };
      itemStatesRef.current = next;
      return next;
    });
  }, []);

  const generateItem = useCallback(
    async (index: number, signal: AbortSignal, stateSnapshot: ItemAudioState[]) => {
      const item = items[index];
      if (!item?.text) return;
      const row = stateSnapshot[index] || emptyItemAudioState();
      updateItem(index, { generating: true, audioBlob: null, audioUrl: null, error: null });
      try {
        if (tier === "free") {
          const voice = resolveItemFreeVoice(row);
          const job = await createFreeGenAudio(
            { text: dialogueTextForTts(item.text), voice },
            signal
          );
          const jobId = jobIdOf(job);
          if (!jobId) throw new Error("No jobId");
          const done = await pollFreeGenAudioJob(jobId, undefined, signal);
          if (String(done?.status || "").toLowerCase() === "failed") {
            throw new Error(voiceJobErrorMessage(done) || t("Job thất bại"));
          }
          const blob = await fetchFreeGenAudioOutputBlobWithRetry(jobId, 0, signal, done);
          if (blob) {
            const url = URL.createObjectURL(blob);
            updateItem(index, { generating: false, audioBlob: blob, audioUrl: url, error: null });
            await persistItemAudio(item, blob, { tier: "free", freeVoiceId: voice });
            return;
          }
        } else {
          const pickedPaidVoice = row.selectedPaidVoice;
          const voiceId = voiceIdOf(pickedPaidVoice);
          if (!voiceId) throw new Error(t("Chọn giọng cho thoại"));
          const job = await createTextToSpeech(
            {
              voice_id: voiceId,
              text: dialogueTextForTts(item.text),
              speed: 1,
              creativity: 0.5,
            },
            signal
          );
          const id = jobIdOf(job);
          if (!id) throw new Error("No jobId");
          const done = await pollVoiceJob(id, undefined, signal, "tts");
          if (String(done?.status || "").toLowerCase() === "failed") {
            throw new Error(voiceJobErrorMessage(done) || t("Job thất bại"));
          }
          const blob = await fetchVoiceJobOutputBlobWithRetry(id, 0, signal);
          if (blob) {
            const url = URL.createObjectURL(blob);
            updateItem(index, { generating: false, audioBlob: blob, audioUrl: url, error: null });
            await persistItemAudio(item, blob, {
              tier: "paid",
              paidVoiceId: voiceId,
              paidVoiceName: String(
                pickedPaidVoice?.name || pickedPaidVoice?.display_name || voiceId
              ),
            });
            return;
          }
        }
        updateItem(index, { generating: false, error: t("Không tạo được audio") });
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          updateItem(index, { generating: false, error: e?.message || t("Lỗi") });
        } else {
          updateItem(index, { generating: false });
        }
      }
    },
    [tier, items, updateItem, persistItemAudio, t]
  );

  const handleBatchGenerate = useCallback(async () => {
    if (batchRunning) {
      batchAbortRef.current?.abort();
      setBatchRunning(false);
      return;
    }
    batchAbortRef.current?.abort();
    const ctrl = new AbortController();
    batchAbortRef.current = ctrl;
    setBatchRunning(true);
    setBatchDoneCount(0);

    const statesSnapshot = itemStatesRef.current;
    let nextIndex = 0;
    let completed = 0;

    const worker = async () => {
      while (!ctrl.signal.aborted) {
        const i = nextIndex++;
        if (i >= items.length) return;
        await generateItem(i, ctrl.signal, statesSnapshot);
        completed += 1;
        setBatchDoneCount(completed);
      }
    };

    const workers = Math.min(VOICE_BATCH_CONCURRENCY, items.length);
    await Promise.all(Array.from({ length: workers }, () => worker()));
    setBatchRunning(false);
  }, [batchRunning, items, generateItem]);

  const handleBatchDownload = useCallback(() => {
    itemStates.forEach((state, i) => {
      if (!state.audioUrl) return;
      const item = items[i];
      const a = document.createElement("a");
      a.href = state.audioUrl;
      a.download = `${(item?.label || `dialogue-${i + 1}`).replace(/\s+/g, "-")}.mp3`;
      a.click();
    });
  }, [itemStates, items]);

  const availableCount = itemStates.filter((s) => s.audioUrl).length;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-shrink-0 space-y-3">
        {tier === "free" ? (
          <div>
            <div className="mb-1 text-xs font-medium text-gray-600">
              {t("Giọng cho tất cả thoại")}
            </div>
            <select
              className="px-3 py-2 w-full text-sm bg-white rounded-lg border"
              value={globalFreeVoice}
              onChange={(e) => {
                const next = e.target.value;
                setGlobalFreeVoice(next);
                setItemStates((prev) => {
                  const updated = prev.map((item) => ({
                    ...item,
                    selectedFreeVoice: next,
                  }));
                  itemStatesRef.current = updated;
                  return updated;
                });
              }}
            >
              {FREE_GEN_AUDIO_VOICES.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name} - {voice.description}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <div className="mb-1 text-xs font-medium text-gray-600">
              {t("Giọng cho tất cả thoại")}
            </div>
            <VoiceAssignmentPicker
              value={globalPaidVoice}
              onChange={(voice) => {
                setGlobalPaidVoice(voice);
                setItemStates((prev) => {
                  const updated = prev.map((item) => ({
                    ...item,
                    selectedPaidVoice: voice,
                  }));
                  itemStatesRef.current = updated;
                  return updated;
                });
              }}
            />
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handleBatchGenerate()}
            disabled={items.length === 0 || items.some((item) => dialogueInputOverLimit(item.text))}
            className="flex flex-1 gap-1.5 justify-center items-center h-9 text-xs font-semibold text-white rounded-full border-0 cursor-pointer disabled:opacity-60"
            style={{ background: batchRunning ? "#dc2626" : "#8b5cf6" }}
          >
            {batchRunning ? (
              <>
                <RiCloseLine />
                {t("Dừng")} ({batchDoneCount}/{items.length})
              </>
            ) : (
              <>
                <RiMagicLine />
                {t("Tạo hàng loạt")}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleBatchDownload}
            disabled={availableCount === 0}
            className="flex flex-1 gap-1.5 justify-center items-center h-9 text-xs font-semibold rounded-full border border-gray-200 bg-white cursor-pointer disabled:opacity-40 text-gray-700 hover:bg-gray-50"
          >
            <RiDownloadLine />
            {t("Tải hàng loạt")} {availableCount > 0 ? `(${availableCount})` : ""}
          </button>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 mt-3 min-h-0 v-scrollbar">
        {items.length === 0 ? (
          <div className="py-4 text-xs text-center text-gray-400 rounded-xl border border-gray-200 border-dashed">
            {t("Không có Dialogue")}
          </div>
        ) : (
          <div className="pr-1 space-y-2">
            {items.map((item, i) => (
              <SplitDialogueItem
                key={item.sceneId || i}
                item={item}
                index={i}
                tier={tier}
                globalPaidVoice={globalPaidVoice}
                itemState={itemStates[i] || emptyItemAudioState()}
                onStateChange={(patch) => updateItem(i, patch)}
                onChangeText={(text) => onChangeItemText(i, text)}
                onSaveText={() => onSaveItemText(item)}
                isDirty={isItemDirty(item)}
                persistItemAudio={persistItemAudio}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

export function VoiceExportDialog({
  isOpen,
  onClose,
  dialogueCopied,
  dialogueExportText,
  dialogueItems,
  audioExportText,
  handleCopyDialogue,
  ttsGenerating,
  ttsAudioUrl,
  ttsVoiceName,
  setTtsVoiceName,
  ttsAudioRef,
  handleGenerateTTS,
  handleDownloadTTSAudio,
  getGeneratedAudio,
  saveGeneratedAudio,
  onSaveDialogue,
}: VoiceExportDialogProps) {
  const { t } = useTranslation();
  const { customer } = useAuth();
  const toast = useToast();
  const [mergeDialogue, setMergeDialogue] = useState(false);
  const [tier, setTier] = useState<TtsTier>("free");
  const [localItems, setLocalItems] = useState<DialogueItem[]>(dialogueItems ?? []);
  const [mergedDraft, setMergedDraft] = useState(dialogueExportText);
  const [savingDialogue, setSavingDialogue] = useState(false);
  const [committedTexts, setCommittedTexts] = useState<Record<string, string>>({});

  const textCredits = useMemo(() => {
    const count = customer?.googlePackage?.textCreditCount ?? 0;
    const limit = customer?.googlePackage?.textCreditLimit ?? 0;
    if (limit === -1) return `${count} / ∞`;
    return `${count} / ${limit}`;
  }, [customer?.googlePackage?.textCreditCount, customer?.googlePackage?.textCreditLimit]);

  useEffect(() => {
    if (!isOpen) return;
    const next = dialogueItems ?? [];
    const saved: Record<string, string> = {};
    next.forEach((item) => {
      saved[item.sceneId] = item.text;
    });
    setLocalItems(next);
    setCommittedTexts(saved);
    setMergedDraft(next.length ? buildMergedDialogueText(next) : dialogueExportText);
  }, [isOpen, dialogueItems, dialogueExportText]);

  const handleToggleMerge = useCallback(() => {
    setMergeDialogue((current) => {
      if (current) {
        setLocalItems((prev) => applyMergedDraftToItems(mergedDraft, prev));
      } else {
        setMergedDraft(buildMergedDialogueText(localItems));
      }
      return !current;
    });
  }, [localItems, mergedDraft]);

  const handleChangeItemText = useCallback((index: number, text: string) => {
    setLocalItems((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index]!, text };
      return next;
    });
  }, []);

  const isItemDirty = useCallback(
    (item: DialogueItem) => item.text !== (committedTexts[item.sceneId] ?? ""),
    [committedTexts]
  );

  const committedMergedText = useMemo(
    () =>
      localItems
        .map((item) => `"${String(committedTexts[item.sceneId] ?? "").replace(/"/g, "")}"`)
        .join(", "),
    [localItems, committedTexts]
  );
  const isMergedDirty = mergedDraft !== committedMergedText;

  const handleSaveItemText = useCallback(
    async (item: DialogueItem) => {
      const latest = localItems.find((row) => row.sceneId === item.sceneId) || item;
      await onSaveDialogue?.([{ sceneId: latest.sceneId, text: latest.text }]);
      setCommittedTexts((prev) => ({ ...prev, [latest.sceneId]: latest.text }));
      toast.success(t("Đã lưu thoại"));
    },
    [onSaveDialogue, localItems, toast, t]
  );

  const handleSaveMerged = useCallback(async () => {
    if (!onSaveDialogue) return;
    setSavingDialogue(true);
    try {
      const nextItems = applyMergedDraftToItems(mergedDraft, localItems);
      setLocalItems(nextItems);
      const saved: Record<string, string> = {};
      nextItems.forEach((row) => {
        saved[row.sceneId] = row.text;
      });
      setCommittedTexts((prev) => ({ ...prev, ...saved }));
      await onSaveDialogue(nextItems.map((row) => ({ sceneId: row.sceneId, text: row.text })));
      toast.success(t("Đã lưu thoại"));
    } finally {
      setSavingDialogue(false);
    }
  }, [onSaveDialogue, mergedDraft, localItems, toast, t]);

  const [copiedLocal, setCopiedLocal] = useState(false);

  const handleCopyLocalDialogue = useCallback(() => {
    const text = mergeDialogue ? mergedDraft : buildMergedDialogueText(localItems);
    if (!text) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedLocal(true);
      setTimeout(() => setCopiedLocal(false), 2000);
    });
  }, [mergeDialogue, mergedDraft, localItems]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      width={620}
      slideFromBottom="none"
      hasCloseIcon={false}
      dialogClass="relative bg-white shadow-2xl rounded-2xl overflow-hidden"
      headerClass=""
      bodyClass=""
      footerClass=""
    >
      <Dialog.Header>
        <div className="px-5 pt-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="flex gap-2 items-center text-base font-bold">
                <MdRecordVoiceOver className="text-blue-500" />
                {t("Xuất Voice")}
              </div>
              <div className="text-gray-500 text-xs mt-0.5">
                {t("Tổng hợp Dialogue & Audio từ tất cả Scene")}
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex justify-center items-center w-7 h-7 text-gray-500 bg-gray-100 rounded-full border-0 transition-colors cursor-pointer hover:bg-gray-200"
            >
              <RiCloseLine className="text-sm" />
            </button>
          </div>
        </div>
      </Dialog.Header>

      <Dialog.Body>
        <div className="flex flex-col px-5 py-3" style={{ maxHeight: "calc(100vh - 20rem)" }}>
          <div className="flex-shrink-0 space-y-4">
            <TierTabs tier={tier} onChange={setTier} textCredits={textCredits} />

            <div>
              <div className="flex justify-between items-center mb-2">
                <div className="flex gap-3 items-center">
                  <span className="text-sm font-semibold text-gray-700">Dialogue</span>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <div
                      onClick={handleToggleMerge}
                      className="relative flex-shrink-0 w-9 h-5 rounded-full transition-colors duration-200 cursor-pointer"
                      style={{ background: mergeDialogue ? "#8b5cf6" : "#d1d5db" }}
                    >
                      <span
                        className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
                        style={{ transform: mergeDialogue ? "translateX(16px)" : "translateX(0)" }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{t("Gọp Thoại")}</span>
                  </label>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCopyLocalDialogue}
                    disabled={!(mergeDialogue ? mergedDraft : localItems.some((item) => item.text))}
                    className="inline-flex items-center gap-1.5 h-6 px-2 text-10 font-semibold text-gray-700 bg-white rounded-md border border-gray-200 cursor-pointer hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {copiedLocal ? (
                      <RiCheckLine className="text-xs shrink-0" />
                    ) : (
                      <RiClipboardLine className="text-xs shrink-0" />
                    )}
                    <span>{copiedLocal ? t("Đã chép") : t("Copy")}</span>
                  </button>
                  {mergeDialogue && isMergedDirty ? (
                    <button
                      type="button"
                      onClick={() => void handleSaveMerged()}
                      disabled={savingDialogue || dialogueInputOverLimit(mergedDraft)}
                      className="inline-flex items-center gap-1.5 h-6 px-2 text-10 font-semibold text-white rounded-md border-0 cursor-pointer disabled:opacity-60"
                      style={{ background: "#8b5cf6" }}
                    >
                      {savingDialogue ? (
                        <RiLoader4Line className="text-xs animate-spin shrink-0" />
                      ) : (
                        <RiSaveLine className="text-xs shrink-0" />
                      )}
                      <span>{savingDialogue ? t("Đang lưu") : t("Lưu")}</span>
                    </button>
                  ) : null}
                </div>
              </div>

              {mergeDialogue ? (
                <DialogueTextarea
                  value={mergedDraft}
                  onChange={setMergedDraft}
                  rows={8}
                  className="px-4 py-3 max-h-40 rounded-xl"
                  placeholder={t("Nhập thoại...")}
                />
              ) : null}
            </div>
          </div>

          <div className="flex flex-col flex-1 py-3 min-h-0 border-t border-gray-100">
            {mergeDialogue ? (
              <MergedTtsSection
                tier={tier}
                isOpen={isOpen}
                dialogueExportText={mergedDraft}
                audioExportText={audioExportText}
                ttsGenerating={ttsGenerating}
                ttsAudioUrl={ttsAudioUrl}
                ttsVoiceName={ttsVoiceName}
                setTtsVoiceName={setTtsVoiceName}
                ttsAudioRef={ttsAudioRef}
                handleGenerateTTS={handleGenerateTTS}
                handleDownloadTTSAudio={handleDownloadTTSAudio}
                getGeneratedAudio={getGeneratedAudio}
                saveGeneratedAudio={saveGeneratedAudio}
              />
            ) : (
              <SplitDialogueSection
                tier={tier}
                isOpen={isOpen}
                items={localItems}
                ttsVoiceName={ttsVoiceName}
                setTtsVoiceName={setTtsVoiceName}
                ttsGenerating={ttsGenerating}
                ttsAudioUrl={ttsAudioUrl}
                ttsAudioRef={ttsAudioRef}
                handleGenerateTTS={handleGenerateTTS}
                handleDownloadTTSAudio={handleDownloadTTSAudio}
                dialogueCopied={dialogueCopied}
                handleCopyDialogue={handleCopyDialogue}
                dialogueExportText={mergedDraft}
                getGeneratedAudio={getGeneratedAudio}
                saveGeneratedAudio={saveGeneratedAudio}
                onChangeItemText={handleChangeItemText}
                onSaveItemText={(item) => void handleSaveItemText(item)}
                isItemDirty={isItemDirty}
              />
            )}
          </div>
        </div>
      </Dialog.Body>
    </Dialog>
  );
}
