import { useTranslation } from "react-i18next";
import { RiCloseLine } from "react-icons/ri";
import { CutVideoPanel } from "./voice-cut-panel";
import { useVoiceContext } from "./voice-provider";
import {
  AudioCleanupPanel,
  SpeechToTextPanel,
  TextToSpeechPanel,
  VoiceClonePanel,
  VoiceConversionPanel,
} from "./voice-tools";
import { getVoiceTool, VOICE_TOOLS } from "./voice-tools-config";

export { VOICE_TOOLS } from "./voice-tools-config";

export function VoiceSidebar({ onClose }: { onClose?: () => void }) {
  const { t } = useTranslation();
  const { tool, credits } = useVoiceContext();
  const active = getVoiceTool(tool);
  const showCredits = tool !== "cut" && tool !== "voices" && tool !== "mine";

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex flex-shrink-0 justify-between items-center px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex gap-2 items-center min-w-0">
          <div
            className="flex flex-shrink-0 justify-center items-center w-8 h-8 rounded-full"
            style={{ background: `${active.color}22` }}
          >
            <active.Icon className="text-base" style={{ color: active.color }} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-base font-bold text-gray-800">{t(active.labelKey)}</span>
            <span className="text-xs text-gray-500 truncate">
              {showCredits ? `${t("Voice Credit")}: ${credits}` : t(active.descKey)}
            </span>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex flex-shrink-0 justify-center items-center w-8 h-8 bg-gray-100 rounded-full border-0 transition-colors cursor-pointer md:hidden hover:bg-gray-200"
          >
            <RiCloseLine className="text-lg text-gray-600" />
          </button>
        )}
      </div>

      <div className="flex overflow-hidden flex-col flex-1 min-h-0">
        {tool === "tts" && <TextToSpeechPanel />}
        {tool === "conversion" && <VoiceConversionPanel />}
        {tool === "clone" && <VoiceClonePanel />}
        {tool === "stt" && <SpeechToTextPanel />}
        {tool === "cleanup" && <AudioCleanupPanel />}
        {tool === "cut" && <CutVideoPanel />}
        {tool === "voices" && (
          <div className="px-4 py-3 text-xs leading-relaxed text-slate-400">
            <p>· {t("Danh sách giọng nằm ở panel bên phải")}</p>
            <p>· {t("Copy voice_id rồi dùng cho Tạo giọng nói hoặc Chuyển giọng")}</p>
          </div>
        )}
        {tool === "mine" && (
          <div className="px-4 py-3 text-xs leading-relaxed text-slate-400">
            <p>· {t("Giọng do bạn tạo được lưu trên máy")}</p>
            <p>· {t("Tải từng giọng hoặc tải tất cả thành file ZIP")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
