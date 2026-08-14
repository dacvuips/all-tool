import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../shared/utilities/form";
import { VoiceAudioField, VoiceRangeField } from "./voice-audio-field";
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
import { VoiceJobResult } from "./voice-job-result";
import {
  type MicroxJob,
  type MicroxVoice,
  voiceIdOf,
  voicesFromPage,
} from "./voice-types";

function useVoiceJobRunner() {
  const [running, setRunning] = useState(false);
  const [job, setJob] = useState<MicroxJob | null>(null);
  const [error, setError] = useState("");

  const run = useCallback(async (start: () => Promise<MicroxJob>) => {
    setRunning(true);
    setError("");
    try {
      const created = await start();
      setJob(created);
      const id = jobIdOf(created);
      const status = String(created?.status || "").toLowerCase();
      if (!id || status === "completed" || status === "failed") {
        return created;
      }
      const done = await pollVoiceJob(id, setJob);
      setJob(done);
      if (String(done?.status || "").toLowerCase() === "failed") {
        throw new Error("Job thất bại");
      }
      return done;
    } catch (err: any) {
      setError(err?.message || "Lỗi");
      return null;
    } finally {
      setRunning(false);
    }
  }, []);

  return { running, job, error, run, setJob };
}

export function VoicesCatalogPanel({
  capability,
  onPick,
}: {
  capability?: string;
  onPick?: (voice: MicroxVoice) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("");
  const [gender, setGender] = useState("");
  const [category, setCategory] = useState("");
  const [cap, setCap] = useState(capability || "");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [voices, setVoices] = useState<MicroxVoice[]>([]);
  const [total, setTotal] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchVoices({
        query: search.trim() || undefined,
        language: language || undefined,
        gender: gender || undefined,
        category: category || undefined,
        capability: cap || undefined,
        page,
        limit: 12,
      });
      setVoices(voicesFromPage(data));
      setTotal(typeof data.total === "number" ? data.total : null);
    } catch (err: any) {
      setError(err?.message || t("Không tải được danh sách giọng"));
    } finally {
      setLoading(false);
    }
  }, [search, language, gender, category, cap, page, t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <div className="flex gap-2 lg:col-span-2">
          <input
            className="px-3 py-2 w-full text-sm rounded-lg border"
            placeholder={t("Tìm giọng...")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPage(1);
                setSearch(query);
              }
            }}
          />
          <Button
            small
            primary
            outline
            text={t("Tìm")}
            onClick={() => {
              setPage(1);
              setSearch(query);
            }}
          />
        </div>
        <input
          className="px-3 py-2 text-sm rounded-lg border"
          placeholder={t("language (vd: vie, eng)")}
          value={language}
          onChange={(e) => {
            setPage(1);
            setLanguage(e.target.value);
          }}
        />
        <input
          className="px-3 py-2 text-sm rounded-lg border"
          placeholder={t("gender")}
          value={gender}
          onChange={(e) => {
            setPage(1);
            setGender(e.target.value);
          }}
        />
        <input
          className="px-3 py-2 text-sm rounded-lg border"
          placeholder={t("category")}
          value={category}
          onChange={(e) => {
            setPage(1);
            setCategory(e.target.value);
          }}
        />
        <input
          className="px-3 py-2 text-sm rounded-lg border"
          placeholder={t("capability")}
          value={cap}
          onChange={(e) => {
            setPage(1);
            setCap(e.target.value);
          }}
        />
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {loading && <div className="text-sm text-gray-500">{t("Đang tải giọng...")}</div>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {voices.map((voice) => {
          const id = voiceIdOf(voice);
          return (
            <div key={id || voice.name} className="p-3 bg-white rounded-xl border border-gray-200">
              <div className="text-sm font-semibold text-gray-800">{voice.name || id}</div>
              <div className="mt-1 text-xs text-gray-500 break-all">{id}</div>
              <div className="flex flex-wrap gap-1 mt-2">
                {voice.language && (
                  <span className="px-1.5 py-0.5 text-[10px] bg-gray-100 rounded">
                    {String(voice.language)}
                  </span>
                )}
                {voice.gender && (
                  <span className="px-1.5 py-0.5 text-[10px] bg-gray-100 rounded">
                    {String(voice.gender)}
                  </span>
                )}
                {(voice.capabilities || []).map((c) => (
                  <span key={c} className="px-1.5 py-0.5 text-[10px] bg-primary/10 text-primary rounded">
                    {c}
                  </span>
                ))}
              </div>
              {(voice.preview_url || voice.sample_url) && (
                <audio
                  controls
                  className="mt-2 w-full"
                  src={String(voice.preview_url || voice.sample_url)}
                />
              )}
              {onPick && (
                <Button
                  small
                  primary
                  outline
                  className="mt-2"
                  text={t("Chọn giọng này")}
                  onClick={() => onPick(voice)}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 items-center">
        <Button
          small
          outline
          text={t("Trước")}
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        />
        <span className="text-xs text-gray-500">
          {t("Trang")} {page}
          {total != null ? ` · ${total}` : ""}
        </span>
        <Button
          small
          outline
          text={t("Sau")}
          disabled={loading || voices.length < 12}
          onClick={() => setPage((p) => p + 1)}
        />
      </div>
    </div>
  );
}

function VoiceIdPicker({
  value,
  onChange,
  capability,
}: {
  value: string;
  onChange: (id: string) => void;
  capability?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <input
        className="px-3 py-2 w-full text-sm rounded-lg border"
        placeholder={t("voice_id (voice_...)")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <Button small outline text={open ? t("Ẩn danh sách") : t("Chọn từ catalog")} onClick={() => setOpen((v) => !v)} />
      {open && (
        <VoicesCatalogPanel
          capability={capability}
          onPick={(voice) => {
            onChange(voiceIdOf(voice));
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

export function TextToSpeechPanel() {
  const { t } = useTranslation();
  const { running, job, error, run } = useVoiceJobRunner();
  const [voiceId, setVoiceId] = useState("voice_67365ff1907f816ddc906026");
  const [text, setText] = useState("Xin chào, đây là bản thử nghiệm MicroX Voice API.");
  const [speed, setSpeed] = useState(1);
  const [creativity, setCreativity] = useState(0.5);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="p-4 space-y-4 bg-white rounded-xl border border-gray-200">
        <div>
          <div className="mb-1 text-xs font-medium text-gray-600">{t("Voice ID")}</div>
          <VoiceIdPicker value={voiceId} onChange={setVoiceId} />
        </div>
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
        <VoiceRangeField label={t("Speed (0.5–1.5)")} min={0.5} max={1.5} step={0.1} value={speed} onChange={setSpeed} />
        <VoiceRangeField
          label={t("Creativity (0–1)")}
          min={0}
          max={1}
          step={0.05}
          value={creativity}
          onChange={setCreativity}
        />
        {error && <div className="text-sm text-red-600">{error}</div>}
        <Button
          primary
          text={t("Tạo giọng nói")}
          isLoading={running}
          onClick={() =>
            run(() =>
              createTextToSpeech({
                voice_id: voiceId.trim(),
                text: text.trim(),
                speed,
                creativity,
              })
            )
          }
        />
      </div>
      <VoiceJobResult job={job} loading={running} />
    </div>
  );
}

export function VoiceConversionPanel() {
  const { t } = useTranslation();
  const { running, job, error, run } = useVoiceJobRunner();
  const [file, setFile] = useState<File | null>(null);
  const [voiceId, setVoiceId] = useState("");
  const [stability, setStability] = useState(0.5);
  const [similarity, setSimilarity] = useState(0.75);
  const [style, setStyle] = useState(0);
  const [denoise, setDenoise] = useState(false);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="p-4 space-y-4 bg-white rounded-xl border border-gray-200">
        <p className="text-xs text-gray-500">
          {t("Giọng đích phải có capability voice_conversion.")}
        </p>
        <VoiceAudioField file={file} onChange={setFile} disabled={running} />
        <div>
          <div className="mb-1 text-xs font-medium text-gray-600">{t("Voice ID đích")}</div>
          <VoiceIdPicker value={voiceId} onChange={setVoiceId} capability="voice_conversion" />
        </div>
        <VoiceRangeField label={t("Stability")} min={0} max={1} step={0.05} value={stability} onChange={setStability} />
        <VoiceRangeField label={t("Similarity")} min={0} max={1} step={0.05} value={similarity} onChange={setSimilarity} />
        <VoiceRangeField label={t("Style")} min={0} max={1} step={0.05} value={style} onChange={setStyle} />
        <label className="flex gap-2 items-center text-sm">
          <input type="checkbox" checked={denoise} onChange={(e) => setDenoise(e.target.checked)} />
          {t("Xóa tạp âm nền")}
        </label>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <Button
          primary
          text={t("Chuyển giọng")}
          isLoading={running}
          onClick={() =>
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
            })
          }
        />
      </div>
      <VoiceJobResult job={job} loading={running} />
    </div>
  );
}

export function VoiceClonePanel() {
  const { t } = useTranslation();
  const { running, job, error, run } = useVoiceJobRunner();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [denoise, setDenoise] = useState(false);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="p-4 space-y-4 bg-white rounded-xl border border-gray-200">
        <p className="text-xs text-gray-500">{t("Sample phải dài 3–30 giây. Job xong trả clone_... dùng cho TTS.")}</p>
        <VoiceAudioField file={file} onChange={setFile} hint={t("Audio mẫu 3–30 giây")} disabled={running} />
        <input
          className="px-3 py-2 w-full text-sm rounded-lg border"
          placeholder={t("Tên giọng clone")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
        />
        <label className="flex gap-2 items-center text-sm">
          <input type="checkbox" checked={denoise} onChange={(e) => setDenoise(e.target.checked)} />
          {t("Xóa tạp âm nền")}
        </label>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <Button
          primary
          text={t("Clone giọng")}
          isLoading={running}
          onClick={() =>
            run(async () => {
              if (!file) throw new Error(t("Chọn file audio"));
              return createVoiceClone({
                audio: file,
                name: name.trim(),
                remove_background_noise: denoise,
              });
            })
          }
        />
      </div>
      <VoiceJobResult job={job} loading={running} />
    </div>
  );
}

export function SpeechToTextPanel() {
  const { t } = useTranslation();
  const { running, job, error, run } = useVoiceJobRunner();
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="p-4 space-y-4 bg-white rounded-xl border border-gray-200">
        <p className="text-xs text-gray-500">{t("Chuyển audio thành transcript JSON và SRT.")}</p>
        <VoiceAudioField file={file} onChange={setFile} disabled={running} />
        {error && <div className="text-sm text-red-600">{error}</div>}
        <Button
          primary
          text={t("Speech to text")}
          isLoading={running}
          onClick={() =>
            run(async () => {
              if (!file) throw new Error(t("Chọn file audio"));
              return createSpeechToText(file);
            })
          }
        />
      </div>
      <VoiceJobResult job={job} loading={running} />
    </div>
  );
}

export function AudioCleanupPanel() {
  const { t } = useTranslation();
  const { running, job, error, run } = useVoiceJobRunner();
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="p-4 space-y-4 bg-white rounded-xl border border-gray-200">
        <p className="text-xs text-gray-500">{t("Gỡ tiếng nền, giữ lời nói.")}</p>
        <VoiceAudioField file={file} onChange={setFile} disabled={running} />
        {error && <div className="text-sm text-red-600">{error}</div>}
        <Button
          primary
          text={t("Làm sạch audio")}
          isLoading={running}
          onClick={() =>
            run(async () => {
              if (!file) throw new Error(t("Chọn file audio"));
              return createAudioCleanup(file);
            })
          }
        />
      </div>
      <VoiceJobResult job={job} loading={running} />
    </div>
  );
}

export function VoicesBrowsePanel() {
  const { t } = useTranslation();
  const caps = useMemo(
    () => [
      { id: "", label: t("Tất cả") },
      { id: "voice_conversion", label: "voice_conversion" },
    ],
    [t]
  );
  const [capability, setCapability] = useState("");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {caps.map((c) => (
          <button
            key={c.id || "all"}
            type="button"
            className={`px-3 py-1.5 text-xs rounded-full border ${
              capability === c.id ? "bg-primary text-white border-primary" : "bg-white"
            }`}
            onClick={() => setCapability(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <VoicesCatalogPanel capability={capability || undefined} />
    </div>
  );
}
