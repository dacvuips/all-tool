import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiDeleteBinLine, RiFileCopyLine } from "react-icons/ri";
import { VoiceCatalogCard, VoiceWaveformPlayer } from "./voice-catalog-card";
import { fetchVoices, jobIdOf, voiceJobOutputUrl } from "./voice-api";
import { FEATURE_TEXT_LABEL, resultFeatureOf, type VoiceResultRecord } from "./voice-idb";
import { useSavedVoices } from "./voice-saved";
import { useVoiceContext } from "./voice-provider";
import { getVoiceTool } from "./voice-tools-config";
import {
  extractJobMedia,
  voiceIdOf,
  voicesFromPage,
  type MicroxJob,
  type MicroxVoice,
} from "./voice-types";

type Props = {
  job?: MicroxJob | null;
  loading?: boolean;
  record?: VoiceResultRecord;
  onDelete?: (id: string) => void;
};

function fallbackVoice(id: string, name: string): MicroxVoice {
  return { id, voice_id: id, name };
}

function useBlobUrls(blobs: Blob[] | undefined): string[] {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    if (!blobs?.length) {
      setUrls([]);
      return;
    }
    const next = blobs.map((blob) => URL.createObjectURL(blob));
    setUrls(next);
    return () => next.forEach((url) => URL.revokeObjectURL(url));
  }, [blobs]);
  return urls;
}

export function VoiceJobResult({ job, loading, record, onDelete }: Props) {
  const { t } = useTranslation();
  const { tool } = useVoiceContext();
  const active = getVoiceTool(tool);
  const { color } = active;
  const { saved, isSaved, toggleSave } = useSavedVoices();
  const [resolved, setResolved] = useState<MicroxVoice | null>(record?.voice || null);
  const blobUrls = useBlobUrls(record?.blobs);

  const media = useMemo(
    () => extractJobMedia(record?.job || job),
    [job, record?.job]
  );
  const jobId = record?.jobId || jobIdOf(job);
  const fallbackOutput = jobId ? voiceJobOutputUrl(jobId, 0) : "";
  const urls =
    blobUrls.length > 0
      ? blobUrls
      : record?.urls?.length
      ? record.urls
      : tool === "stt"
      ? []
      : media.urls.length
      ? media.urls
      : fallbackOutput && String(job?.status || record?.status || "").toLowerCase() === "completed"
      ? [fallbackOutput]
      : [];
  const texts =
    tool === "stt" && media.texts.length
      ? media.texts
      : record?.texts?.length
      ? record.texts
      : media.texts;
  const voiceId = record?.voiceId || media.voiceIds[0] || "";
  const status = String(
    record?.status || job?.status || (loading ? "processing" : "")
  ).toLowerCase();
  const resultId = record?.id || "";

  useEffect(() => {
    if (record?.voice) {
      setResolved(record.voice);
      return;
    }
    if (!voiceId) {
      setResolved(fallbackVoice("", t(active.labelKey)));
      return;
    }
    const fromSaved = saved.find((item) => item.id === voiceId);
    if (fromSaved) {
      setResolved(fromSaved.voice);
      return;
    }
    let cancelled = false;
    fetchVoices({ query: voiceId, limit: 8 })
      .then((data) => {
        if (cancelled) return;
        const list = voicesFromPage(data);
        const found = list.find((item) => voiceIdOf(item) === voiceId);
        setResolved(found || fallbackVoice(voiceId, voiceId));
      })
      .catch(() => {
        if (!cancelled) setResolved(fallbackVoice(voiceId, voiceId));
      });
    return () => {
      cancelled = true;
    };
  }, [voiceId, saved, active.labelKey, t, record?.voice]);

  if (!job && !loading && !record) {
    return null;
  }

  const voice: MicroxVoice = resolved || fallbackVoice(voiceId, t("Kết quả"));
  const featureTitle = t(resultFeatureOf(record, active.labelKey));
  const fileTitle = record?.voice?.name || voice.name || t("Kết quả");
  const displayVoice: MicroxVoice = { ...voice, name: featureTitle };
  const transcript = texts
    .filter((item) => item.label === "text" || item.label === "transcript" || item.label === "transcription")
    .map((item) => item.value)
    .join("\n\n");
  const extras = texts.filter(
    (item) => item.label === "srt" || item.label === "vtt"
  );
  const detailTexts = texts.filter(
    (item) => item.label !== FEATURE_TEXT_LABEL && item.label !== "ext"
  );

  if (tool === "stt") {
    return (
      <div className="p-3 space-y-3 bg-white rounded-xl border border-gray-200">
        <div className="flex gap-2 justify-between items-center">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-800 truncate">{featureTitle}</div>
            {fileTitle && fileTitle !== featureTitle ? (
              <div className="text-xs text-gray-500 truncate">{fileTitle}</div>
            ) : null}
          </div>
          {onDelete && resultId ? (
            <button
              type="button"
              className="inline-flex gap-1 items-center text-xs text-gray-400 hover:text-red-500"
              onClick={() => onDelete(resultId)}
            >
              <RiDeleteBinLine />
              {t("Xóa")}
            </button>
          ) : null}
        </div>
        {urls[0] ? (
          <VoiceWaveformPlayer src={urls[0]} color={color} />
        ) : loading ? (
          <p className="text-xs text-gray-400">{t("Đang xử lý audio...")}</p>
        ) : (
          <p className="text-xs text-gray-400">{t("Không có file audio")}</p>
        )}
        <div>
          <div className="flex gap-2 justify-between items-center mb-1">
            <div className="text-xs font-medium text-gray-500">{t("Lời thoại")}</div>
            {transcript ? (
              <button
                type="button"
                className="inline-flex gap-1 items-center text-xs text-gray-400 hover:text-gray-700"
                onClick={() => void navigator.clipboard.writeText(transcript)}
              >
                <RiFileCopyLine />
                {t("Sao chép")}
              </button>
            ) : null}
          </div>
          {transcript ? (
            <p className="p-3 text-sm leading-relaxed text-gray-800 whitespace-pre-wrap bg-gray-50 rounded-lg">
              {transcript}
            </p>
          ) : (
            <p className="text-sm text-gray-400">
              {loading ? t("Đang chép lời...") : t("Chưa có lời thoại")}
            </p>
          )}
        </div>
        {extras.map((item) => (
          <div key={item.label}>
            <div className="mb-1 text-xs font-medium text-gray-500 uppercase">{t(item.label)}</div>
            <pre className="overflow-auto p-3 max-h-40 text-xs whitespace-pre-wrap bg-gray-50 rounded-lg">
              {item.value}
            </pre>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {urls.length > 0 ? (
        urls.map((url, index) => (
          <div key={`${resultId}-${index}-${url}`} className="overflow-hidden bg-white rounded-xl border border-gray-200">
            <VoiceCatalogCard
              voice={displayVoice}
              variant="compact"
              audioSrc={url}
              saved={isSaved(voiceIdOf(voice))}
              onToggleSave={toggleSave}
              tag={fileTitle !== featureTitle ? fileTitle : undefined}
            />
            <div className="flex flex-wrap gap-x-3 gap-y-1 items-center px-2 pb-2 text-xs text-gray-400">
              {status === "completed" ? (
                <span className="text-emerald-600">{t("Đã lưu")}</span>
              ) : status === "processing" ? (
                <span>{t("Đang xử lý")}</span>
              ) : status === "failed" ? (
                <span>{t("Thất bại")}</span>
              ) : status ? (
                <span>{t(status)}</span>
              ) : null}
              {onDelete && resultId ? (
                <button
                  type="button"
                  className="inline-flex gap-1 items-center ml-auto text-gray-400 hover:text-red-500"
                  onClick={() => onDelete(resultId)}
                >
                  <RiDeleteBinLine />
                  {t("Xóa")}
                </button>
              ) : null}
            </div>
          </div>
        ))
      ) : (
        <div className="overflow-hidden bg-white rounded-xl border border-gray-200">
          <VoiceCatalogCard
            voice={displayVoice}
            variant="compact"
            saved={isSaved(voiceIdOf(voice))}
            onToggleSave={toggleSave}
            tag={fileTitle !== featureTitle ? fileTitle : undefined}
          />
        </div>
      )}

      {detailTexts.map((item) => (
        <div key={item.label} className="p-3 bg-white rounded-xl border border-gray-200">
          <div className="mb-1 text-xs font-medium text-gray-500 uppercase">{item.label}</div>
          <pre className="overflow-auto p-3 max-h-64 text-xs whitespace-pre-wrap bg-gray-50 rounded-lg">
            {item.value}
          </pre>
        </div>
      ))}
    </div>
  );
}
