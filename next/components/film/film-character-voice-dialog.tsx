/**
 * Modal gắn giọng cho nhân vật — tab Tạo giọng / Nhân bản giọng xếp dọc
 * (tái dùng form + kết quả của Voice, không sidebar trái-phải).
 */
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiLoader4Line, RiPauseFill, RiVolumeUpLine } from "react-icons/ri";
import { Dialog } from "../shared/utilities/dialog/dialog";
import { jobIdOf, voicePreviewUrl } from "../app/voice/voice-api";
import type { VoiceResultRecord } from "../app/voice/voice-idb";
import { VoiceJobResult } from "../app/voice/voice-job-result";
import { MyVoicesPanel } from "../app/voice/voice-my-voices";
import { VoiceProvider, useVoiceContext } from "../app/voice/voice-provider";
import { TextToSpeechPanel, VoiceClonePanel } from "../app/voice/voice-tools";
import { getVoiceTool } from "../app/voice/voice-tools-config";
import { voiceIdOf, type VoiceToolId } from "../app/voice/voice-types";
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

const FILM_CHARACTER_VOICE_TOOLS: VoiceToolId[] = ["tts", "clone"];

const MODAL_TABS = [
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

function FilmCharacterVoiceBody({
  characterName,
  onPick,
}: {
  characterName?: string;
  onPick: (voice: FilmCharacterVoicePick) => void;
}) {
  const { t } = useTranslation();
  const { tool, setTool, credits, running, job, history, removeHistory, cancelRun } =
    useVoiceContext();
  const active = getVoiceTool(tool);
  const currentJobId = jobIdOf(job);
  const currentRecord = history.find((item) => item.jobId === currentJobId);

  const handleSelect = (record: VoiceResultRecord) => {
    const pick = recordToPick(record);
    if (pick) onPick(pick);
  };

  return (
    <div
      className="overflow-y-auto overscroll-contain"
      style={{ maxHeight: "calc(100vh - 10rem)" }}
    >
      <div className="px-5 pt-3 pb-2">
        {characterName ? (
          <p className="text-xs text-gray-500 m-0 mb-2">
            {t("Gắn giọng cho")} <span className="font-semibold text-gray-800">{characterName}</span>
          </p>
        ) : null}
        <div className="flex gap-1 p-1 rounded-xl bg-gray-50 border border-gray-100">
          {MODAL_TABS.map((tab) => {
            const meta = getVoiceTool(tab.id);
            const selected = tool === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTool(tab.id)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border-0 cursor-pointer"
                style={{
                  color: selected ? meta.color : "#6b7280",
                  background: selected ? `${meta.color}14` : "transparent",
                }}
              >
                <meta.Icon className="text-base" style={{ color: selected ? meta.color : "#9ca3af" }} />
                {t(tab.labelKey)}
              </button>
            );
          })}
        </div>
        <p className="text-10 text-gray-400 m-0 mt-1.5">
          {t("Text credit")}: {credits}
        </p>
      </div>

      <div className="border-t border-gray-100">
        {tool === "tts" ? <TextToSpeechPanel /> : <VoiceClonePanel />}
      </div>

      <div className="px-5 pb-5 pt-2 space-y-3 border-t border-gray-100 bg-amber-50/40">
        <div className="flex gap-2 items-center pt-2">
          <div
            className="flex justify-center items-center w-8 h-8 rounded-full"
            style={{ background: `${active.color}22` }}
          >
            <active.Icon className="text-lg" style={{ color: active.color }} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800 m-0">{t(active.resultTitleKey)}</h2>
            <p className="text-xs text-slate-500 m-0">{t("Chọn một giọng bên dưới để gắn cho nhân vật.")}</p>
          </div>
        </div>

        {running ? (
          <div
            className="flex gap-2 items-center px-3 py-2 text-sm rounded-xl border"
            style={{
              color: active.color,
              background: `${active.color}14`,
              borderColor: `${active.color}55`,
            }}
          >
            <RiLoader4Line className="text-lg animate-spin" style={{ color: active.color }} />
            <span className="flex-1">{t("Đang xử lý job...")}</span>
            <button
              type="button"
              onClick={cancelRun}
              className="flex-shrink-0 px-2.5 h-7 text-xs font-semibold text-white bg-gray-700 rounded-lg border-0 cursor-pointer"
            >
              {t("Dừng")}
            </button>
          </div>
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
          records={history}
          heading={t(active.resultTitleKey)}
          emptyText={t("Chưa có kết quả. Điền form phía trên rồi chạy để lưu giọng vào đây.")}
          defaultView="list"
          onSelect={handleSelect}
          selectText={t("Dùng giọng này")}
        />
      </div>
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
            initialTool="tts"
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
      {playing ? <RiPauseFill className="text-lg" /> : <RiVolumeUpLine className="text-lg" />}
    </button>
  );
}
