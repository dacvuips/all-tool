import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RiChatVoiceLine,
  RiMicLine,
  RiMusic2Line,
  RiUserVoiceLine,
  RiVoiceprintLine,
  RiFileTextLine,
} from "react-icons/ri";
import { fetchVoiceAccount } from "./voice-api";
import {
  AudioCleanupPanel,
  SpeechToTextPanel,
  TextToSpeechPanel,
  VoiceClonePanel,
  VoiceConversionPanel,
  VoicesBrowsePanel,
} from "./voice-tools";
import type { VoiceToolId } from "./voice-types";

const TOOLS: { id: VoiceToolId; icon: JSX.Element; labelKey: string; descKey: string }[] = [
  { id: "voices", icon: <RiUserVoiceLine />, labelKey: "Voices", descKey: "Danh sách giọng & bộ lọc" },
  { id: "tts", icon: <RiChatVoiceLine />, labelKey: "Text to Speech", descKey: "Tạo audio từ văn bản" },
  { id: "conversion", icon: <RiVoiceprintLine />, labelKey: "Voice Conversion", descKey: "Đổi giọng file thu" },
  { id: "clone", icon: <RiMicLine />, labelKey: "Voice Clone", descKey: "Clone giọng 3–30 giây" },
  { id: "stt", icon: <RiFileTextLine />, labelKey: "Speech to Text", descKey: "Transcript JSON / SRT" },
  { id: "cleanup", icon: <RiMusic2Line />, labelKey: "Audio Cleanup", descKey: "Gỡ tạp âm nền" },
];

export function VoicePage() {
  const { t } = useTranslation();
  const [tool, setTool] = useState<VoiceToolId>("tts");
  const [credits, setCredits] = useState<string>("");

  useEffect(() => {
    fetchVoiceAccount()
      .then((acc) => {
        const value = acc.credits ?? acc.balance;
        setCredits(value == null ? "" : String(value));
      })
      .catch(() => setCredits(""));
  }, []);

  return (
    <div className="flex overflow-hidden flex-1 min-h-0 bg-amber-50">
      <aside className="hidden overflow-y-auto flex-shrink-0 w-64 bg-white border-r md:block">
        <div className="p-4 border-b">
          <div className="text-sm font-bold text-gray-800">{t("Speech | Voice")}</div>
          <div className="mt-1 text-xs text-gray-500">
            {credits ? `${t("Credits")}: ${credits}` : t("MicroX Voice")}
          </div>
        </div>
        <nav className="p-2">
          {TOOLS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTool(item.id)}
              className={`flex gap-2 items-start w-full px-3 py-2.5 mb-1 text-left rounded-lg ${
                tool === item.id ? "bg-primary/10 text-primary" : "hover:bg-gray-50 text-gray-700"
              }`}
            >
              <span className="mt-0.5 text-lg">{item.icon}</span>
              <span>
                <span className="block text-sm font-medium">{t(item.labelKey)}</span>
                <span className="block text-[11px] text-gray-500">{t(item.descKey)}</span>
              </span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex overflow-hidden flex-col flex-1 min-w-0">
        <div className="flex overflow-x-auto gap-2 p-2 bg-white border-b md:hidden">
          {TOOLS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTool(item.id)}
              className={`px-3 py-1.5 text-xs whitespace-nowrap rounded-full border ${
                tool === item.id ? "bg-primary text-white border-primary" : "bg-white"
              }`}
            >
              {t(item.labelKey)}
            </button>
          ))}
        </div>
        <div className="overflow-y-auto flex-1 p-4">
          {tool === "voices" && <VoicesBrowsePanel />}
          {tool === "tts" && <TextToSpeechPanel />}
          {tool === "conversion" && <VoiceConversionPanel />}
          {tool === "clone" && <VoiceClonePanel />}
          {tool === "stt" && <SpeechToTextPanel />}
          {tool === "cleanup" && <AudioCleanupPanel />}
        </div>
      </div>
    </div>
  );
}
