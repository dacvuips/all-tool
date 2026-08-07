import { useTranslation } from "react-i18next";
import { HiMicrophone } from "react-icons/hi";
import { FilmSceneRecord } from "./film-types";

type Props = {
  scene: FilmSceneRecord;
  onCreateVoice?: (scene: FilmSceneRecord) => void;
};

export function sceneVoiceReady(scene: FilmSceneRecord): boolean {
  return scene.voiceStatus === "ready" || !!scene.voiceUrl;
}

export function sceneVoiceCreating(scene: FilmSceneRecord): boolean {
  return scene.voiceStatus === "creating";
}

export function sceneDialogueText(scene: FilmSceneRecord): string {
  return (
    scene.dialogue?.trim() ||
    scene.summary?.trim() ||
    scene.action?.trim() ||
    ""
  );
}

export function sceneHasDialogue(scene: FilmSceneRecord): boolean {
  return sceneDialogueText(scene).length > 0;
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

  // soft tone so progress bar moves when playing
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

export default function FilmVoiceCard({ scene, onCreateVoice }: Props) {
  const { t } = useTranslation();
  const indexLabel = `#${String(scene.index).padStart(2, "0")}`;
  const speaker =
    scene.speakerName?.trim() ||
    scene.characterNames?.[0]?.trim() ||
    t("Nhân vật");
  const text = sceneDialogueText(scene) || t("Chưa có thoại");
  const ready = sceneVoiceReady(scene);
  const creating = sceneVoiceCreating(scene);
  const metaParts = [
    scene.shotSize || t("Cảnh quay"),
    `${scene.durationSec ?? 0}s`,
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
          <span className="text-sm font-bold text-gray-800">{indexLabel}</span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-10 font-semibold bg-blue-50 text-blue-600 border border-blue-100">
            {speaker}
          </span>
        </div>
        <span
          className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-10 font-semibold border ${statusBadge.className}`}
        >
          {statusBadge.label}
        </span>
      </div>

      <p className="text-sm text-gray-800 m-0 leading-relaxed">{text}</p>

      <p className="text-xs text-gray-400 m-0">{metaParts.join(" · ")}</p>

      {ready && !creating ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 pt-1 border-t border-gray-50 mt-0.5">
          <audio
            controls
            preload="metadata"
            src={scene.voiceUrl || undefined}
            className="w-full flex-1 min-w-0 h-9"
            style={{ maxHeight: 36 }}
          >
            {t("Trình duyệt không hỗ trợ audio.")}
          </audio>
          <button
            type="button"
            onClick={() => onCreateVoice?.(scene)}
            className="flex-shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors self-end sm:self-auto"
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
          <button
            type="button"
            disabled={creating}
            onClick={() => onCreateVoice?.(scene)}
            className={`flex-shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border-0 cursor-pointer transition-colors ${
              creating
                ? "bg-blue-50 text-blue-600 cursor-wait"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {creating ? (
              t("Đang tạo...")
            ) : (
              <>
                <HiMicrophone className="text-sm" />
                {t("Tạo Giọng")}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
