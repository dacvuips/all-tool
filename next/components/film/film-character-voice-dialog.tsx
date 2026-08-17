/**
 * Modal gắn giọng cho nhân vật — tab Tạo giọng / Nhân bản giọng / Danh sách giọng.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiSpeakerWave } from "react-icons/hi2";
import { RiLoader4Line, RiPauseFill } from "react-icons/ri";
import { jobIdOf, voicePreviewUrl } from "../app/voice/voice-api";
import type { VoiceResultRecord } from "../app/voice/voice-idb";
import { VoiceJobResult } from "../app/voice/voice-job-result";
import { MyVoicesPanel } from "../app/voice/voice-my-voices";
import { VoiceProvider, useVoiceContext } from "../app/voice/voice-provider";
import { TextToSpeechPanel, VoiceClonePanel, VoicesCatalogPanel } from "../app/voice/voice-tools";
import { getVoiceTool } from "../app/voice/voice-tools-config";
import { voiceIdOf, type MicroxVoice, type VoiceToolId } from "../app/voice/voice-types";
import { Dialog } from "../shared/utilities/dialog/dialog";
import {
  FILM_EDIT_DIALOG_BODY_CLASS,
  FILM_EDIT_DIALOG_CLASS,
  FILM_EDIT_DIALOG_HEADER_CLASS,
  FILM_EDIT_DIALOG_WRAPPER_CLASS,
} from "./film-edit-dialog-shell";

export type FilmCharacterVoicePick = {
  voiceId: string;
  voiceLabel: string;
  voicePreviewBlob?: Blob;
  voiceResultId?: string;
};

type DialogProps = {
  isOpen: boolean;
  characterName?: string;
  title?: string;
  onClose: () => void;
  onPick: (voice: FilmCharacterVoicePick) => void;
};

export const FILM_CHARACTER_VOICE_TOOLS: VoiceToolId[] = ["voices", "tts", "clone"];

export const FILM_CHARACTER_VOICE_TABS = [
  { id: "voices" as const, labelKey: "Danh sách giọng" },
  { id: "tts" as const, labelKey: "Tạo giọng" },
  { id: "clone" as const, labelKey: "Nhân bản giọng" },
];

export function recordToPick(record: VoiceResultRecord): FilmCharacterVoicePick | null {
  const voiceId =
    String(record.voiceId || voiceIdOf(record.voice) || record.jobId || "").trim();
  if (!voiceId && !record.blobs?.[0]) return null;
  const voiceLabel =
    String(record.voice?.name || record.voice?.display_name || record.voiceId || voiceId).trim() ||
    voiceId;
  return {
    voiceId: voiceId || record.id,
    voiceLabel,
    voicePreviewBlob: record.blobs?.[0],
    voiceResultId: record.id,
  };
}

export function catalogVoiceToPick(voice: MicroxVoice): FilmCharacterVoicePick | null {
  const voiceId = voiceIdOf(voice);
  if (!voiceId) return null;
  const voiceLabel =
    String(voice.name || voice.display_name || voiceId).trim() || voiceId;
  return { voiceId, voiceLabel };
}

function FilmCharacterVoiceRunningBanner({
  color,
  onStop,
}: {
  color: string;
  onStop: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="flex gap-2 items-center px-3 py-2 text-sm rounded-xl border"
      style={{
        color,
        background: `${color}14`,
        borderColor: `${color}55`,
      }}
    >
      <RiLoader4Line className="text-lg animate-spin" style={{ color }} />
      <span className="flex-1">{t("Đang xử lý job...")}</span>
      <button
        type="button"
        onClick={onStop}
        className="flex-shrink-0 px-2.5 h-7 text-xs font-semibold text-white bg-gray-700 rounded-lg border-0 cursor-pointer"
      >
        {t("Dừng")}
      </button>
    </div>
  );
}

function FilmCharacterVoiceBody({
  characterName,
  onPick,
}: {
  characterName?: string;
  onPick: (voice: FilmCharacterVoicePick) => void;
}) {
  const { t } = useTranslation();
  const { tool, setTool, credits, running, job, history, library, removeHistory, cancelRun } =
    useVoiceContext();
  const active = getVoiceTool(tool);
  const listMeta = getVoiceTool("voices");
  const listTab = tool === "voices";
  const currentJobId = jobIdOf(job);
  const currentRecord =
    history.find((item) => item.jobId === currentJobId) ||
    library.find((item) => item.jobId === currentJobId);

  const ttsRecords = useMemo(
    () => library.filter((item) => item.tool === "tts"),
    [library]
  );

  const handleSelect = (record: VoiceResultRecord) => {
    const pick = recordToPick(record);
    if (pick) onPick(pick);
  };

  const handleCatalogPick = (voice: MicroxVoice) => {
    const pick = catalogVoiceToPick(voice);
    if (pick) onPick(pick);
  };

  return (
    <div
      className="overflow-y-auto overscroll-contain v-scrollbar"
      style={{ maxHeight: "calc(100vh - 10rem)" }}
    >
      <div className="px-5 pt-3 pb-2">
        {characterName ? (
          <p className="text-xs text-gray-500 m-0 mb-2">
            {t("Gắn giọng cho")} <span className="font-semibold text-gray-800">{characterName}</span>
          </p>
        ) : null}
        <div className="flex gap-1 p-1 rounded-xl bg-gray-50 border border-gray-100">
          {FILM_CHARACTER_VOICE_TABS.map((tab) => {
            const meta = getVoiceTool(tab.id);
            const selected = tool === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTool(tab.id)}
                className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-bold border-0 cursor-pointer"
                style={{
                  color: selected ? meta.color : "#6b7280",
                  background: selected ? `${meta.color}14` : "transparent",
                }}
              >
                <meta.Icon className="text-base flex-shrink-0" style={{ color: selected ? meta.color : "#9ca3af" }} />
                <span className="truncate">{t(tab.labelKey)}</span>
              </button>
            );
          })}
        </div>
        <p className="text-10 text-gray-400 m-0 mt-1.5">
          {t("Text credit")}: {credits}
        </p>
      </div>

      {!listTab ? (
        <>
          <div className="border-t border-gray-100">
            {tool === "tts" ? <TextToSpeechPanel /> : <VoiceClonePanel />}
          </div>
          {running ? (
            <div className="px-5 py-3 border-t border-gray-100">
              <FilmCharacterVoiceRunningBanner color={active.color} onStop={cancelRun} />
            </div>
          ) : currentRecord?.blobs?.length ? (
            <div className="px-5 py-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setTool("voices")}
                className="w-full h-9 text-xs font-semibold rounded-lg border-0 cursor-pointer"
                style={{ color: listMeta.color, background: `${listMeta.color}14` }}
              >
                {t("Giọng đã tạo — chọn trong Danh sách giọng")}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="px-5 pb-12 pt-2 space-y-4 border-t border-gray-100 bg-amber-50/40">
          <div className="flex gap-2 items-center pt-2">
            <div
              className="flex justify-center items-center w-8 h-8 rounded-full"
              style={{ background: `${listMeta.color}22` }}
            >
              <listMeta.Icon className="text-lg" style={{ color: listMeta.color }} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 m-0">{t("Danh sách giọng")}</h2>
              <p className="text-xs text-slate-500 m-0">
                {t("Chọn giọng đã tạo hoặc giọng có sẵn để gắn cho nhân vật.")}
              </p>
            </div>
          </div>

          {running ? (
            <FilmCharacterVoiceRunningBanner color={active.color} onStop={cancelRun} />
          ) : null}

          {running && (job || currentRecord) ? (
            <div className="bg-white p-2 rounded-md">
              <VoiceJobResult
                job={currentRecord?.job || job}
                record={currentRecord}
                loading={!currentRecord?.blobs?.length}
                onDelete={currentRecord ? (id) => void removeHistory(id) : undefined}
              />
            </div>
          ) : null}

          <MyVoicesPanel
            records={ttsRecords}
            heading={t("Giọng đã tạo")}
            emptyText={t("Chưa có giọng từ tab Tạo giọng. Tạo xong rồi chọn tại đây.")}
            defaultView="grid"
            layout="modal"
            onSelect={handleSelect}
            selectText={t("Dùng giọng này")}
          />

          <VoicesCatalogPanel layout="modal" onPick={handleCatalogPick} />
        </div>
      )}
    </div>
  );
}

export default function FilmCharacterVoiceDialog({
  isOpen,
  characterName,
  title,
  onClose,
  onPick,
}: DialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={title || t("Tạo giọng")}
      width={640}
      maxWidth="95vw"
      slideFromBottom="none"
      wrapperClass={FILM_EDIT_DIALOG_WRAPPER_CLASS}
      dialogClass={FILM_EDIT_DIALOG_CLASS}
      headerClass={FILM_EDIT_DIALOG_HEADER_CLASS}
      bodyClass={FILM_EDIT_DIALOG_BODY_CLASS}
      
    >
      <Dialog.Body>
        {isOpen ? (
          <VoiceProvider
            syncUrl={false}
            initialTool="voices"
            allowedTools={FILM_CHARACTER_VOICE_TOOLS}
            layout="stack"
          >
            <FilmCharacterVoiceBody characterName={characterName} onPick={onPick} />
          </VoiceProvider>
        ) : null}
      </Dialog.Body>
    </Dialog>
  );
}

export function FilmCharacterVoicePlayButton({
  blob,
  voiceId,
}: {
  blob?: Blob;
  voiceId?: string;
}) {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [src, setSrc] = useState("");

  useEffect(() => {
    let objectUrl = "";
    if (blob) {
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    } else if (voiceId) {
      setSrc(voicePreviewUrl(voiceId));
    } else {
      setSrc("");
    }
    return () => {
      audioRef.current?.pause();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [blob, voiceId]);

  const toggle = async () => {
    if (!src) return;
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio(src);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.onpause = () => setPlaying(false);
    } else if (audio.src !== src) {
      audio.src = src;
    }
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={!src}
      title={t("Nghe thử")}
      aria-label={t("Nghe thử")}
      className="inline-flex items-center justify-center w-8 h-8 rounded-lg border-0 bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer disabled:opacity-40 disabled:cursor-default flex-shrink-0"
    >
      {playing ? <RiPauseFill className="text-lg" /> : <HiSpeakerWave className="text-lg" />}
    </button>
  );
}
