/**
 * Tab Danh sách giọng — chọn giọng theo tier Miễn phí / Thu phí (không tạo).
 */
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FREE_GEN_AUDIO_VOICES,
  freeGenAudioVoiceLabel,
  isFreeGenAudioVoiceId,
} from "../app/voice/free-voice-voices";
import type { VoiceResultRecord } from "../app/voice/voice-idb";
import { MyVoicesPanel } from "../app/voice/voice-my-voices";
import { VoicesCatalogPanel } from "../app/voice/voice-tools";
import type { MicroxVoice } from "../app/voice/voice-types";
import {
  catalogVoiceToPick,
  recordToPick,
  type FilmCharacterVoicePick,
} from "./film-character-voice-dialog";
import { FilmCharacterVoicePlayButton } from "./film-character-voice-play-button";
import type { FilmVoiceTier } from "./film-voice-tier";

function FreeVoicePickList({
  onPick,
  selectedVoiceId,
}: {
  onPick: (voice: FilmCharacterVoicePick) => void;
  selectedVoiceId?: string;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const selectedRef = useRef<HTMLButtonElement | null>(null);
  const activeId = selectedVoiceId?.trim().toLowerCase() || "";

  const filtered = FREE_GEN_AUDIO_VOICES.filter((voice) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      voice.id.includes(q) ||
      voice.name.toLowerCase().includes(q) ||
      voice.description.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    if (!activeId || !isFreeGenAudioVoiceId(activeId)) return;
    selectedRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeId]);

  return (
    <div className="space-y-3 bg-white p-2 rounded-md">
      <p className="text-xs text-gray-500 m-0">
        {t("Chọn giọng miễn phí — không trừ text credit")}
      </p>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("Tìm kiếm giọng...")}
        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:border-blue-400"
      />
      <div className="max-h-72 overflow-y-auto space-y-2 pr-0.5">
        {filtered.map((voice) => {
          const selected = activeId === voice.id;
          return (
            <button
              key={voice.id}
              ref={selected ? selectedRef : undefined}
              type="button"
              onClick={() =>
                onPick({
                  voiceId: voice.id,
                  voiceLabel: freeGenAudioVoiceLabel(voice.id),
                })
              }
              className={`w-full text-left rounded-xl border px-3.5 py-3 cursor-pointer transition-colors ${
                selected
                  ? "border-blue-400 bg-blue-50 ring-1 ring-blue-200"
                  : "border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-gray-900 m-0">{voice.name}</div>
                  <div className="text-xs text-gray-400 m-0 mt-0.5">{voice.description}</div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {selected ? (
                    <span className="text-10 font-bold text-blue-600 uppercase">
                      {t("Đang gắn")}
                    </span>
                  ) : null}
                  <FilmCharacterVoicePlayButton voiceId={voice.id} size="sm" />
                </div>
              </div>
            </button>
          );
        })}
        {!filtered.length ? (
          <p className="text-xs text-gray-400 text-center py-4 m-0">{t("Không có giọng phù hợp")}</p>
        ) : null}
      </div>
    </div>
  );
}

type Props = {
  tier: FilmVoiceTier;
  onPick: (voice: FilmCharacterVoicePick) => void;
  ttsRecords: VoiceResultRecord[];
  selectedVoiceId?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
};

export default function FilmVoiceListPanel({
  tier,
  onPick,
  ttsRecords,
  selectedVoiceId = "",
  header,
  footer,
}: Props) {
  const { t } = useTranslation();
  const activeId = selectedVoiceId.trim();

  const handleSelectRecord = (record: VoiceResultRecord) => {
    const pick = recordToPick(record);
    if (pick) onPick(pick);
  };

  const handleCatalogPick = (voice: MicroxVoice) => {
    const pick = catalogVoiceToPick(voice);
    if (pick) onPick(pick);
  };

  return (
    <div className="space-y-4">
      {header}
      {tier === "free" ? (
        <FreeVoicePickList onPick={onPick} selectedVoiceId={selectedVoiceId} />
      ) : (
        <>
          {activeId && !isFreeGenAudioVoiceId(activeId) ? (
            <div className="px-2 py-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg">
              {t("Giọng đang gắn hiển thị trong danh sách bên dưới.")}
            </div>
          ) : null}
          <MyVoicesPanel
            records={ttsRecords}
            heading={t("Giọng đã tạo")}
            emptyText={t("Chưa có giọng từ tab Tạo giọng. Tạo xong rồi chọn tại đây.")}
            defaultView="grid"
            layout="modal"
            onSelect={handleSelectRecord}
            selectText={t("Dùng giọng này")}
          />
          <VoicesCatalogPanel layout="modal" onPick={handleCatalogPick} />
        </>
      )}
      {footer}
    </div>
  );
}
