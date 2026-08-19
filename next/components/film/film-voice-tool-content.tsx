/**
 * Nội dung tab con theo tier (Miễn phí / Thu phí) + tool (Danh sách / Tạo / Nhân bản).
 */
import { useTranslation } from "react-i18next";
import { freeGenAudioVoiceLabel } from "../app/voice/free-voice-voices";
import type { VoiceResultRecord } from "../app/voice/voice-idb";
import {
  FreeTextToSpeechPanel,
  PaidTextToSpeechPanel,
  VoiceClonePanel,
} from "../app/voice/voice-tools";
import type { VoiceToolId } from "../app/voice/voice-types";
import type { FilmCharacterVoicePick } from "./film-character-voice-dialog";
import FilmVoiceListPanel from "./film-voice-list-panel";
import type { FilmVoiceTier } from "./film-voice-tier";

type Props = {
  tier: FilmVoiceTier;
  tool: VoiceToolId;
  onPick: (voice: FilmCharacterVoicePick) => void;
  ttsRecords: VoiceResultRecord[];
  selectedVoiceId?: string;
  listHeader?: React.ReactNode;
  listFooter?: React.ReactNode;
};

export default function FilmVoiceToolContent({
  tier,
  tool,
  onPick,
  ttsRecords,
  selectedVoiceId = "",
  listHeader,
  listFooter,
}: Props) {
  const { t } = useTranslation();

  if (tool === "voices") {
    return (
      <FilmVoiceListPanel
        tier={tier}
        onPick={onPick}
        ttsRecords={ttsRecords}
        selectedVoiceId={selectedVoiceId}
        header={listHeader}
        footer={listFooter}
      />
    );
  }

  if (tool === "tts") {
    return (
      <div className="border-t border-gray-100">
        {tier === "free" ? (
          <FreeTextToSpeechPanel
            initialVoiceId={selectedVoiceId}
            onPickFreeVoice={(voiceId, label) =>
              onPick({
                voiceId,
                voiceLabel: label || freeGenAudioVoiceLabel(voiceId),
              })
            }
          />
        ) : (
          <PaidTextToSpeechPanel initialVoiceId={selectedVoiceId} />
        )}
      </div>
    );
  }

  if (tier === "free") {
    return (
      <div className="px-5 py-8 text-center border-t border-gray-100">
        <p className="text-sm text-gray-500 m-0">
          {t("Nhân bản giọng chỉ khả dụng ở tab Thu phí.")}
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-100">
      <VoiceClonePanel />
    </div>
  );
}
