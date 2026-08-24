import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiCloseLine, RiMoneyDollarCircleLine, RiUserVoiceLine } from "react-icons/ri";
import { useAuth } from "../../../lib/providers/auth-provider";
import { GenerateAiIcon } from "../../../public/assets/svg/generate-ai";
import { Dialog } from "../../shared/utilities/dialog/dialog";
import { createFreeGenAudio } from "./free-voice-api";
import { FREE_GEN_AUDIO_VOICES } from "./free-voice-voices";
import { freeVoiceCreateBlockReason } from "./voice-access";
import {
  createAudioCleanup,
  createSpeechToText,
  createTextToSpeech,
  createVoiceClone,
  createVoiceConversion,
  fetchVoices,
  jobIdOf,
  pollVoiceJob,
} from "./voice-api";
import { VoiceAudioField, VoiceRangeField } from "./voice-audio-field";
import { VoiceCatalogCard } from "./voice-catalog-card";
import {
  VoiceCatalogFilters,
  type VoiceCatalogView,
  type VoiceFilterValue,
} from "./voice-catalog-filters";
import { useVoiceContext } from "./voice-provider";
import { hoistSavedVoices, useSavedVoices } from "./voice-saved";
import { getVoiceTool } from "./voice-tools-config";
import {
  extractJobMedia,
  type MicroxVoice,
  voiceIdOf,
  voicesFromPage,
} from "./voice-types";

const VOICE_PAGE_SIZE = 40;

function mergeVoices(prev: MicroxVoice[], next: MicroxVoice[]) {
  const seen = new Set(prev.map((item) => voiceIdOf(item)).filter(Boolean));
  const extra = next.filter((item) => {
    const id = voiceIdOf(item);
    if (!id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return [...prev, ...extra];
}

export function VoicesCatalogPanel({
  capability,
  onPick,
  layout = "page",
}: {
  capability?: string;
  onPick?: (voice: MicroxVoice) => void;
  layout?: "page" | "modal";
}) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<VoiceFilterValue>({
    capability: capability || "",
    language: "",
    gender: "",
    accent: "",
    engine: "",
    query: "",
    sort: "popular",
    category: "",
  });
  const [view, setView] = useState<VoiceCatalogView>("grid");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [voices, setVoices] = useState<MicroxVoice[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const { saved, isSaved, toggleSave } = useSavedVoices();
  const displayedVoices = useMemo(() => hoistSavedVoices(voices, saved), [voices, saved]);

  useEffect(() => {
    setFilters((prev) => ({ ...prev, capability: capability || "" }));
    setPage(1);
    setVoices([]);
    setHasMore(true);
  }, [capability]);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    if (page === 1) setError("");
    try {
      const data = await fetchVoices({
        query: filters.query.trim() || undefined,
        language: filters.language || undefined,
        gender: filters.gender || undefined,
        category: filters.category || undefined,
        capability: filters.capability || undefined,
        accent: filters.accent || undefined,
        engine: filters.engine || undefined,
        sort: filters.sort || undefined,
        page,
        limit: VOICE_PAGE_SIZE,
      });
      let list = voicesFromPage(data);
      if (filters.sort === "name") {
        list = [...list].sort((a, b) =>
          String(a.name || a.display_name || "").localeCompare(
            String(b.name || b.display_name || "")
          )
        );
      }
      const nextTotal = typeof data.total === "number" ? data.total : null;
      setTotal(nextTotal);
      setVoices((prev) => {
        const next = page === 1 ? list : mergeVoices(prev, list);
        const noNewItems = page > 1 && next.length === prev.length;
        setHasMore(
          !noNewItems &&
            list.length >= VOICE_PAGE_SIZE &&
            (nextTotal == null || next.length < nextTotal)
        );
        return next;
      });
    } catch (err: any) {
      setError(err?.message || t("Không tải được danh sách giọng"));
      setHasMore(false);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [filters, page, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (loadingRef.current) return;
        setPage((p) => p + 1);
      },
      { rootMargin: "240px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, voices.length]);

  return (
    <div className="space-y-4 bg-white p-2 rounded-md">
      <VoiceCatalogFilters
        value={filters}
        view={view}
        total={total}
        loading={loading && page === 1}
        onChange={(next) => {
          setPage(1);
          setVoices([]);
          setHasMore(true);
          setFilters(next);
        }}
        onViewChange={setView}
      />
      {error && <div className="text-sm text-red-600">{t(error)}</div>}
      <div
        className={
          view === "list"
            ? "flex flex-col gap-3"
            : layout === "modal"
              ? "grid grid-cols-1 gap-4 md:grid-cols-2"
              : "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        }
      >
        {displayedVoices.map((voice) => {
          const id = voiceIdOf(voice);
          return (
            <VoiceCatalogCard
              key={id || voice.name}
              voice={voice}
              onPick={onPick}
              variant={view}
              saved={isSaved(id)}
              onToggleSave={toggleSave}
            />
          );
        })}
      </div>
      <div ref={sentinelRef} className="flex justify-center py-3 text-xs text-gray-400">
        {loading && page > 1
          ? t("Đang tải thêm...")
          : hasMore
            ? t("Cuộn xuống để tải thêm")
            : voices.length
              ? t("Hết danh sách")
              : ""}
      </div>
    </div>
  );
}

function VoiceSubmitButton({
  text,
  disabled,
  onClick,
  showCreditIcon = true,
}: {
  text: string;
  disabled?: boolean;
  onClick: () => void;
  showCreditIcon?: boolean;
}) {
  const { running, tool, cancelRun } = useVoiceContext();
  const { t } = useTranslation();
  const { color } = getVoiceTool(tool);
  const dimmed = Boolean(disabled) && !running;
  return (
    <div className="flex flex-shrink-0 gap-2 px-4 pt-2 pb-4 bg-white border-t border-gray-100">
      {running ? (
        <button
          type="button"
          onClick={cancelRun}
          className="flex gap-1.5 justify-center items-center w-full h-10 text-sm font-semibold text-white bg-gray-700 rounded-full border-0"
        >
          <RiCloseLine className="text-lg text-white" />
          <span>{t("Dừng tiến trình")}</span>
        </button>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={onClick}
          className="flex gap-1.5 justify-center items-center w-full h-10 text-sm font-semibold rounded-full border-0 disabled:opacity-100 disabled:cursor-default"
          style={{
            background: dimmed ? "#d1d5db" : color,
            color: "#ffffff",
            cursor: dimmed ? "default" : "pointer",
          }}
        >
          <GenerateAiIcon color="#fff" />
          <span className="text-white">{text}</span>
          {showCreditIcon ? (
            <RiMoneyDollarCircleLine className="text-lg text-white" title="$" />
          ) : null}
        </button>
      )}
    </div>
  );
}

function VoiceFormShell({
  children,
  submitText,
  disabled,
  onSubmit,
  showCreditIcon = true,
  blockedReason,
}: {
  children: React.ReactNode;
  submitText: string;
  disabled?: boolean;
  onSubmit: () => void;
  showCreditIcon?: boolean;
  blockedReason?: string;
}) {
  const { t } = useTranslation();
  const { error, canCreate, createBlockedReason, layout } = useVoiceContext();
  const blocked = blockedReason ?? (!canCreate ? createBlockedReason : "");
  const stacked = layout === "stack";
  return (
    <div className={stacked ? "flex flex-col" : "flex overflow-hidden flex-col flex-1 min-h-0"}>
      <div className={stacked ? "" : "overflow-y-auto flex-1 min-h-0 v-scrollbar"}>
        <div className="px-4 pt-1 pb-3 space-y-4">
          {children}
          {blocked ? (
            <p className="text-xs text-amber-700">{t(blocked)}</p>
          ) : null}
          {error && <div className="text-sm text-red-600">{t(error)}</div>}
        </div>
      </div>
      <VoiceSubmitButton
        text={submitText}
        disabled={disabled || Boolean(blocked)}
        onClick={onSubmit}
        showCreditIcon={showCreditIcon}
      />
    </div>
  );
}

export function VoiceIdPicker({
  value,
  onChange,
  capability,
  label,
}: {
  value: string;
  onChange: (id: string) => void;
  capability?: string;
  label: string;
}) {
  const { t } = useTranslation();
  const { tool } = useVoiceContext();
  const { color } = getVoiceTool(tool);
  const { saved } = useSavedVoices();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<MicroxVoice | null>(null);

  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    const fromSaved = saved.find((item) => item.id === value);
    if (fromSaved) {
      setSelected(fromSaved.voice);
      return;
    }
    if (selected && voiceIdOf(selected) === value) return;
    let cancelled = false;
    fetchVoices({ query: value, limit: 8 })
      .then((data) => {
        if (cancelled) return;
        const list = voicesFromPage(data);
        const found = list.find((item) => voiceIdOf(item) === value) || null;
        setSelected(found || { id: value, voice_id: value, name: value });
      })
      .catch(() => {
        if (!cancelled) setSelected({ id: value, voice_id: value, name: value });
      });
    return () => {
      cancelled = true;
    };
  }, [value, saved]);

  const voice = selected || (value ? { id: value, voice_id: value, name: value } : null);

  return (
    <div className="w-full">
      <div className="flex gap-2 items-center mb-1 h-7">
        <div className="flex-1 text-xs font-medium text-gray-600">{label}</div>
        {voice ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex flex-shrink-0 justify-center items-center w-7 h-7 bg-white rounded-lg border border-gray-200"
            style={{ color }}
            title={t("Chọn danh sách giọng")}
            aria-label={t("Chọn danh sách giọng")}
          >
            <RiUserVoiceLine className="text-lg" />
          </button>
        ) : null}
      </div>
      {voice ? (
        <VoiceCatalogCard
          voice={voice}
          variant="compact"
          showSave={false}
          showBadge={false}
          onClear={() => {
            setSelected(null);
            onChange("");
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex flex-col gap-1.5 justify-center items-center px-4 py-6 w-full rounded-xl border border-dashed bg-gray-50"
          style={{ borderColor: `${color}88` }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = color;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = `${color}88`;
          }}
        >
          <span
            className="flex justify-center items-center w-10 h-10 rounded-full"
            style={{ background: `${color}18` }}
          >
            <RiUserVoiceLine className="text-xl" style={{ color }} />
          </span>
          <span className="text-sm font-medium text-gray-800">{t("Chọn giọng từ danh sách")}</span>
          <span className="text-xs text-center text-gray-500">
            {t("Bấm để mở danh sách và chọn giọng")}
          </span>
        </button>
      )}
      <Dialog
        isOpen={open}
        onClose={() => setOpen(false)}
        title={t("Danh sách giọng")}
        width={760}
        maxWidth="94vw"
        slideFromBottom="none"
      >
        <Dialog.Body>
          <div className="overflow-y-auto pt-2 v-scrollbar" style={{ maxHeight: "70vh" }}>
            {open && (
              <VoicesCatalogPanel
                layout="modal"
                capability={capability}
                onPick={(next) => {
                  setSelected(next);
                  onChange(voiceIdOf(next));
                  setOpen(false);
                }}
              />
            )}
          </div>
        </Dialog.Body>
      </Dialog>
    </div>
  );
}

export function PaidTextToSpeechPanel({ initialVoiceId }: { initialVoiceId?: string } = {}) {
  const { t } = useTranslation();
  const { running, run } = useVoiceContext();
  const [voiceId, setVoiceId] = useState(
    initialVoiceId?.trim() || "voice_67365ff1907f816ddc906026"
  );
  const [text, setText] = useState("Xin chào, đây là bản thử nghiệm VietTheo Voice API.");
  const [speed, setSpeed] = useState(1);
  const [creativity, setCreativity] = useState(0.5);

  useEffect(() => {
    if (initialVoiceId?.trim()) setVoiceId(initialVoiceId.trim());
  }, [initialVoiceId]);

  return (
    <VoiceFormShell
      submitText={t("Tạo giọng nói")}
      onSubmit={() =>
        run(
          () =>
            createTextToSpeech({
              voice_id: voiceId.trim(),
              text: text.trim(),
              speed,
              creativity,
            }),
          { voiceId: voiceId.trim() }
        )
      }
    >
      <VoiceIdPicker label={t("Voice ID")} value={voiceId} onChange={setVoiceId} />
      <div>
        <div className="mb-1 text-xs font-medium text-gray-600">{t("Nội dung")}</div>
        <textarea
          rows={6}
          className="px-3 py-2 w-full text-sm rounded-lg border"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={50000}
        />
      </div>
      <VoiceRangeField label={t("Tốc độ (0.5–1.5)")} min={0.5} max={1.5} step={0.1} value={speed} onChange={setSpeed} />
      <VoiceRangeField
        label={t("Độ sáng tạo (0–1)")}
        min={0}
        max={1}
        step={0.05}
        value={creativity}
        onChange={setCreativity}
      />
    </VoiceFormShell>
  );
}

function FreeVoiceSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-gray-600">{t("Voice")}</div>
      <select
        className="px-3 py-2 w-full text-sm rounded-lg border bg-white"
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

export { FreeVoiceSelect };

export function FreeTextToSpeechPanel({
  initialVoiceId,
  onPickFreeVoice,
}: {
  initialVoiceId?: string;
  onPickFreeVoice?: (voiceId: string, label: string) => void;
}) {
  const { t } = useTranslation();
  const { customer } = useAuth();
  const { runFreeGenAudio } = useVoiceContext();
  const { color } = getVoiceTool("tts");
  const defaultVoice = FREE_GEN_AUDIO_VOICES[0]?.id || "achernar";
  const [voice, setVoice] = useState(initialVoiceId?.trim().toLowerCase() || defaultVoice);
  const [text, setText] = useState("Chào các bạn, tôi là Thái");
  const selectedVoice = FREE_GEN_AUDIO_VOICES.find((item) => item.id === voice);
  const freeBlockedReason = freeVoiceCreateBlockReason(customer);

  useEffect(() => {
    if (!initialVoiceId?.trim()) return;
    setVoice(initialVoiceId.trim().toLowerCase());
  }, [initialVoiceId]);

  return (
    <VoiceFormShell
      submitText={t("Tạo giọng nói")}
      showCreditIcon={false}
      disabled={!text.trim() || !voice}
      blockedReason={freeBlockedReason}
      onSubmit={() =>
        runFreeGenAudio(
          () =>
            createFreeGenAudio({
              text: text.trim(),
              voice,
            }),
          { voiceId: voice, feature: t("Tạo giọng miễn phí") }
        )
      }
    >
      <p className="text-xs text-gray-500" style={{ color }}>
        {t("Miễn phí — không trừ text credit")}
      </p>
      <FreeVoiceSelect value={voice} onChange={setVoice} />
      {onPickFreeVoice ? (
        <button
          type="button"
          onClick={() =>
            onPickFreeVoice(
              voice,
              selectedVoice ? `${selectedVoice.name} — ${selectedVoice.description}` : voice
            )
          }
          className="w-full h-9 text-xs font-semibold rounded-lg border cursor-pointer"
          style={{ color, background: `${color}14`, borderColor: `${color}55` }}
        >
          {t("Dùng giọng này")}
        </button>
      ) : null}
      <div>
        <div className="mb-1 text-xs font-medium text-gray-600">{t("Nội dung")}</div>
        <textarea
          rows={6}
          className="px-3 py-2 w-full text-sm rounded-lg border"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={50000}
        />
      </div>
    </VoiceFormShell>
  );
}

type TtsTier = "free" | "paid";

function TextToSpeechTierTabs({
  tier,
  onChange,
}: {
  tier: TtsTier;
  onChange: (tier: TtsTier) => void;
}) {
  const { t } = useTranslation();
  const { color } = getVoiceTool("tts");
  return (
    <div className="flex gap-1 p-1 mx-4 mt-2 rounded-lg bg-gray-50 border border-gray-100">
      {(
        [
          { id: "free" as const, label: t("Miễn phí") },
          { id: "paid" as const, label: t("Thu phí") },
        ] as const
      ).map((tab) => {
        const selected = tier === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className="flex-1 px-2 py-2 text-xs font-bold rounded-md border-0 cursor-pointer"
            style={{
              color: selected ? color : "#6b7280",
              background: selected ? `${color}14` : "transparent",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export type TextToSpeechPanelProps = {
  defaultTier?: TtsTier;
  onPickFreeVoice?: (voiceId: string, label: string) => void;
};

export function TextToSpeechPanel({
  defaultTier = "free",
  onPickFreeVoice,
}: TextToSpeechPanelProps = {}) {
  const [tier, setTier] = useState<TtsTier>(defaultTier);
  return (
    <div className="flex overflow-hidden flex-col flex-1 min-h-0">
      <TextToSpeechTierTabs tier={tier} onChange={setTier} />
      <div className="flex overflow-hidden flex-col flex-1 min-h-0">
        {tier === "paid" ? (
          <PaidTextToSpeechPanel />
        ) : (
          <FreeTextToSpeechPanel onPickFreeVoice={onPickFreeVoice} />
        )}
      </div>
    </div>
  );
}

export function VoiceConversionPanel() {
  const { t } = useTranslation();
  const { running, run } = useVoiceContext();
  const [file, setFile] = useState<File | null>(null);
  const [voiceId, setVoiceId] = useState("");
  const [stability, setStability] = useState(0.5);
  const [similarity, setSimilarity] = useState(0.75);
  const [style, setStyle] = useState(0);
  const [denoise, setDenoise] = useState(false);

  return (
    <VoiceFormShell
      submitText={t("Chuyển giọng")}
      disabled={!file}
      onSubmit={() =>
        run(async () => {
          if (!file) throw new Error(t("Chọn file audio"));
          return createVoiceConversion({
            audio: file,
            voice_id: voiceId.trim(),
            stability,
            similarity,
            style,
            remove_background_noise: denoise,
          });
        }, { voiceId: voiceId.trim() })
      }
    >
      <p className="text-xs text-gray-500">{t("Giọng đích phải hỗ trợ chuyển giọng.")}</p>
      <VoiceAudioField file={file} onChange={setFile} disabled={running} />
      <VoiceIdPicker
        label={t("Voice ID đích")}
        value={voiceId}
        onChange={setVoiceId}
        capability="voice_conversion"
      />
      <VoiceRangeField label={t("Độ ổn định")} min={0} max={1} step={0.05} value={stability} onChange={setStability} />
      <VoiceRangeField label={t("Độ giống")} min={0} max={1} step={0.05} value={similarity} onChange={setSimilarity} />
      <VoiceRangeField label={t("Phong cách")} min={0} max={1} step={0.05} value={style} onChange={setStyle} />
      <label className="flex gap-2 items-center text-sm">
        <input type="checkbox" checked={denoise} onChange={(e) => setDenoise(e.target.checked)} />
        {t("Xóa tạp âm nền")}
      </label>
    </VoiceFormShell>
  );
}

export function VoiceClonePanel() {
  const { t } = useTranslation();
  const { running, run, setTool } = useVoiceContext();
  const ttsColor = getVoiceTool("tts").color;
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [denoise, setDenoise] = useState(false);

  return (
    <VoiceFormShell
      submitText={t("Nhân bản giọng")}
      disabled={!file}
      onSubmit={() =>
        run(async () => {
          if (!file) throw new Error(t("Chọn file audio"));
          return createVoiceClone({
            audio: file,
            name: name.trim(),
            remove_background_noise: denoise,
          });
        })
      }
    >
      <p className="text-xs text-gray-500">
        {t("Mẫu phải dài 3–30 giây. Job xong trả mã clone.")}{" "}
        <button
          type="button"
          onClick={() => setTool("tts")}
          className="p-0 font-semibold bg-transparent border-0 underline"
          style={{ color: ttsColor }}
        >
          {t("Dùng để tạo giọng nói")}
        </button>
      </p>
      <VoiceAudioField file={file} onChange={setFile} hint={t("Audio mẫu 3–30 giây")} disabled={running} />
      <input
        className="px-3 py-2 w-full text-sm rounded-lg border"
        placeholder={t("Đặt tên giọng nhân bản")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={120}
      />
      <label className="flex gap-2 items-center text-sm">
        <input type="checkbox" checked={denoise} onChange={(e) => setDenoise(e.target.checked)} />
        {t("Xóa tạp âm nền")}
      </label>
    </VoiceFormShell>
  );
}

export function SpeechToTextPanel() {
  const { t } = useTranslation();
  const { running, run } = useVoiceContext();
  const [file, setFile] = useState<File | null>(null);

  return (
    <VoiceFormShell
      submitText={t("Chép lời")}
      disabled={!file}
      onSubmit={() =>
        run(async () => {
          if (!file) throw new Error(t("Chọn file audio"));
          const { prepareSpeechAudioChunksInBrowser } = await import(
            /* webpackChunkName: "ffmpeg-browser" */
            "../../video-affiliate-plus/ffmpeg-browser"
          );
          const chunks = await prepareSpeechAudioChunksInBrowser(file, {
            fileName: file.name,
            mimeType: file.type,
          });
          const first = chunks[0];
          if (!first) throw new Error(t("Không nén được audio"));
          const toFile = (blob: Blob, index: number) =>
            new File(
              [blob],
              chunks.length > 1 ? `stt-${index + 1}.mp3` : file.name.replace(/\.[^.]+$/, "") + ".mp3",
              { type: "audio/mpeg" }
            );
          if (chunks.length === 1) return createSpeechToText(toFile(first.blob, 0));
          let last = await createSpeechToText(toFile(first.blob, 0));
          const texts: string[] = [];
          const collect = async (job: Awaited<ReturnType<typeof createSpeechToText>>) => {
            const id = jobIdOf(job);
            const status = String(job?.status || "").toLowerCase();
            const done =
              id && status !== "completed" && status !== "failed"
                ? await pollVoiceJob(id, undefined, undefined, "stt")
                : job;
            if (String(done?.status || "").toLowerCase() === "failed") {
              throw new Error(t("Job thất bại"));
            }
            last = done;
            const piece =
              extractJobMedia(done).texts.find((row) => row.label === "text")?.value || "";
            if (piece) texts.push(piece);
            return done;
          };
          await collect(last);
          for (let i = 1; i < chunks.length; i += 1) {
            await collect(await createSpeechToText(toFile(chunks[i].blob, i)));
          }
          return {
            ...last,
            result: { ...(last as { result?: object }).result, text: texts.join(" ").trim() },
          };
        }, { sourceFile: file })
      }
    >
      <p className="text-xs text-gray-500">{t("Chuyển audio thành transcript JSON và SRT.")}</p>
      <VoiceAudioField file={file} onChange={setFile} disabled={running} />
    </VoiceFormShell>
  );
}

export function AudioCleanupPanel() {
  const { t } = useTranslation();
  const { running, run } = useVoiceContext();
  const [file, setFile] = useState<File | null>(null);

  return (
    <VoiceFormShell
      submitText={t("Lọc tạp âm")}
      disabled={!file}
      onSubmit={() =>
        run(async () => {
          if (!file) throw new Error(t("Chọn file audio"));
          return createAudioCleanup(file);
        })
      }
    >
      <p className="text-xs text-gray-500">{t("Gỡ tiếng nền, giữ lời nói.")}</p>
      <VoiceAudioField file={file} onChange={setFile} disabled={running} />
    </VoiceFormShell>
  );
}

export function VoicesBrowsePanel() {
  return <VoicesCatalogPanel />;
}
