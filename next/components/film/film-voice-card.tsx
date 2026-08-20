/**
 * Card 1 lời thoại — tab Tạo giọng (sau khi tách field Thoại).
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiCloseLine, RiUserVoiceLine } from "react-icons/ri";
import { VoiceWaveformPlayer } from "../app/voice/voice-catalog-card";
import { getVoiceTool } from "../app/voice/voice-tools-config";
import { SceneMediaError } from "../app/affiliate-video/shared/scene-media-error";
import {
  dialogueLineCreating,
  dialogueLineReady,
  resolveDialogueLineVoiceLink,
  type FilmVoiceListItem,
} from "./film-dialogue";
import type { FilmCharacterRecord, FilmDialogueLineRecord, FilmSceneRecord } from "./film-types";

const TTS_WAVE_COLOR = getVoiceTool("tts").color;

type Props = {
  item: FilmVoiceListItem;
  characters?: FilmCharacterRecord[];
  episodeLabel?: string;
  onCreateVoice?: (item: FilmVoiceListItem) => void;
  onStopVoice?: (item: FilmVoiceListItem) => void;
};

/** @deprecated dùng buildFilmVoiceListItems + dialogueLineReady */
export function sceneVoiceReady(scene: FilmSceneRecord): boolean {
  if (scene.dialogueLines?.length) {
    return scene.dialogueLines.every(dialogueLineReady);
  }
  return scene.voiceStatus === "ready" || !!scene.voiceUrl;
}

export function sceneVoiceCreating(scene: FilmSceneRecord): boolean {
  if (scene.dialogueLines?.length) {
    return scene.dialogueLines.some(dialogueLineCreating);
  }
  return scene.voiceStatus === "creating";
}

export function sceneDialogueText(scene: FilmSceneRecord): string {
  return scene.dialogue?.trim() || "";
}

export function sceneHasDialogue(scene: FilmSceneRecord): boolean {
  if (sceneDialogueText(scene)) return true;
  return (scene.dialogueLines?.length || 0) > 0;
}

/** WAV placeholder ngắn để audio player hiển thị được (chưa TTS thật). */
export function buildPlaceholderVoiceUrl(durationSec = 3): string {
  const sampleRate = 22050;
  const duration = Math.max(1, Math.min(durationSec, 12));
  const numSamples = Math.floor(sampleRate * duration);
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.min(1, t * 4) * Math.min(1, (duration - t) * 4);
    const sample = Math.sin(2 * Math.PI * 220 * t) * 0.15 * env;
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 0x7fff, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

export default function FilmVoiceCard({
  item,
  characters = [],
  episodeLabel,
  onCreateVoice,
  onStopVoice,
}: Props) {
  const { t } = useTranslation();
  const { scene, line, lineIndex } = item;
  const sceneLabel = `#${String(scene.index).padStart(2, "0")}`;
  const lineLabel = `${lineIndex}`;
  const speaker = line.character?.trim() || t("Nhân vật");
  const linkedVoice = resolveDialogueLineVoiceLink(line, characters);
  const hasVoiceLink = !!(linkedVoice.voiceId || linkedVoice.voiceLabel);
  const text = line.line?.trim() || t("Chưa có thoại");
  const ready = dialogueLineReady(line);
  const creating = dialogueLineCreating(line);
  const [audioSrc, setAudioSrc] = useState("");

  useEffect(() => {
    if (line.voiceBlob) {
      const url = URL.createObjectURL(line.voiceBlob);
      setAudioSrc(url);
      return () => URL.revokeObjectURL(url);
    }
    setAudioSrc(line.voiceUrl || "");
  }, [line.voiceBlob, line.voiceUrl]);
  const metaParts = [
    episodeLabel || null,
    `${t("Cảnh")} ${sceneLabel}`,
    `${t("Câu")} ${lineLabel}`,
    scene.shotSize || null,
    scene.location?.trim() || null,
  ].filter(Boolean);

  const statusBadge = creating
    ? { label: t("Đang tạo"), className: "bg-blue-50 text-blue-600 border-blue-100" }
    : ready
      ? { label: t("Đã tạo"), className: "bg-green-50 text-green-600 border-green-100" }
      : { label: t("Chờ tạo"), className: "bg-gray-50 text-gray-500 border-gray-100" };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-sm font-bold text-gray-800">
            {sceneLabel}.{lineLabel}
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-10 font-semibold bg-blue-50 text-blue-600 border border-blue-100">
            {speaker}
          </span>
          {linkedVoice.voiceLabel || linkedVoice.voiceId ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-10 font-semibold bg-green-50 text-green-700 border border-green-100 max-w-[12rem]">
              <RiUserVoiceLine className="text-xs flex-shrink-0" />
              <span className="truncate">{linkedVoice.voiceLabel || linkedVoice.voiceId}</span>
            </span>
          ) : null}
        </div>
        <span
          className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-10 font-semibold border ${statusBadge.className}`}
        >
          {statusBadge.label}
        </span>
      </div>

      <p className="text-sm text-gray-800 m-0 leading-relaxed">{text}</p>

      <p className="text-xs text-gray-400 m-0">{metaParts.join(" · ")}</p>

      <SceneMediaError message={line.voiceError} />

      {ready && !creating ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 pt-1 border-t border-gray-50 mt-0.5">
          <div className="w-full flex-1 min-w-0">
            <VoiceWaveformPlayer src={audioSrc} color={TTS_WAVE_COLOR} />
          </div>
          <button
            type="button"
            disabled={!hasVoiceLink}
            onClick={() => onCreateVoice?.(item)}
            title={hasVoiceLink ? t("Tạo lại") : t("Gắn giọng cho nhân vật trước")}
            className={`flex-shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors self-end sm:self-auto ${
              hasVoiceLink
                ? "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                : "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed"
            }`}
          >
            {t("Tạo lại")}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 pt-1 border-t border-gray-50 mt-0.5">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 min-w-0">
            {creating ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin flex-shrink-0" />
                <span className="truncate">{t("Đang tạo giọng...")}</span>
              </>
            ) : (
              <span className="truncate">{t("Chưa tạo file âm thanh")}</span>
            )}
          </div>
          {creating ? (
            <button
              type="button"
              onClick={() => onStopVoice?.(item)}
              disabled={!onStopVoice}
              title={t("Dừng tạo")}
              className="flex-shrink-0 inline-flex items-center justify-center gap-1 px-3.5 py-1.5 rounded-lg text-xs font-semibold border-0 bg-gray-700 hover:bg-gray-800 text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RiCloseLine className="text-sm" />
              {t("Dừng tạo")}
            </button>
          ) : (
            <button
              type="button"
              disabled={!hasVoiceLink}
              onClick={() => onCreateVoice?.(item)}
              title={
                hasVoiceLink
                  ? t("Tạo Giọng")
                  : t("Gắn giọng cho nhân vật trước")
              }
              className={`flex-shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border-0 transition-colors ${
                hasVoiceLink
                  ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                  : "bg-gray-100 text-gray-300 cursor-not-allowed"
              }`}
            >
              <RiUserVoiceLine className="text-sm" />
              {t("Tạo Giọng")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// re-export for consumers still typing line
export type { FilmDialogueLineRecord };
