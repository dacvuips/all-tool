/**
 * Modal gắn giọng cho nhân vật — tab Tạo giọng / Nhân bản giọng / Danh sách giọng.
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiLoader4Line, RiUserVoiceLine } from "react-icons/ri";
import { isFreeGenAudioVoiceId } from "../app/voice/free-voice-voices";
import { jobIdOf } from "../app/voice/voice-api";
import { FilmCharacterVoicePlayButton } from "./film-character-voice-play-button";
import type { VoiceResultRecord } from "../app/voice/voice-idb";
import { VoiceJobResult } from "../app/voice/voice-job-result";
import { VoiceProvider, useVoiceContext } from "../app/voice/voice-provider";
import { getVoiceTool } from "../app/voice/voice-tools-config";
import { voiceIdOf, type MicroxVoice, type VoiceToolId } from "../app/voice/voice-types";
import { Dialog } from "../shared/utilities/dialog/dialog";
import {
  FILM_EDIT_DIALOG_BODY_CLASS,
  FILM_EDIT_DIALOG_CLASS,
  FILM_EDIT_DIALOG_HEADER_CLASS,
  FILM_EDIT_DIALOG_WRAPPER_CLASS,
} from "./film-edit-dialog-shell";
import FilmVoiceToolContent from "./film-voice-tool-content";
import { FilmVoiceTierTabs, type FilmVoiceTier } from "./film-voice-tier";

export type FilmCharacterVoicePick = {
  voiceId: string;
  voiceLabel: string;
  voicePreviewBlob?: Blob;
  voiceResultId?: string;
};

type DialogProps = {
  isOpen: boolean;
  characterName?: string;
  attachedVoice?: FilmCharacterVoicePick | null;
  title?: string;
  onClose: () => void;
  onPick: (voice: FilmCharacterVoicePick) => void;
};

export function hasAttachedFilmVoice(
  voice?: Partial<FilmCharacterVoicePick> | null
): boolean {
  if (!voice) return false;
  return Boolean(voice.voiceId?.trim() || voice.voiceLabel?.trim() || voice.voicePreviewBlob);
}

export function filmCharacterToAttachedVoice(
  character?: {
    voiceId?: string;
    voiceLabel?: string;
    voicePreviewBlob?: Blob;
    voiceResultId?: string;
  } | null
): FilmCharacterVoicePick | null {
  if (!character || !hasAttachedFilmVoice(character)) return null;
  return {
    voiceId: character.voiceId?.trim() || "",
    voiceLabel: character.voiceLabel?.trim() || character.voiceId?.trim() || "",
    voicePreviewBlob: character.voicePreviewBlob,
    voiceResultId: character.voiceResultId,
  };
}

export function dialogueLineToAttachedVoice(
  line?: Pick<
    import("./film-types").FilmDialogueLineRecord,
    "voiceCustom" | "voiceId" | "voiceLabel"
  > | null
): FilmCharacterVoicePick | null {
  if (!line?.voiceCustom) return null;
  const voiceId = line.voiceId?.trim() || "";
  const voiceLabel = line.voiceLabel?.trim() || voiceId;
  if (!voiceId && !voiceLabel) return null;
  return { voiceId, voiceLabel };
}

export function resolveFilmVoiceModalState(attached?: FilmCharacterVoicePick | null): {
  tier: FilmVoiceTier;
  tool: VoiceToolId;
  selectedVoiceId: string;
} {
  if (!hasAttachedFilmVoice(attached)) {
    return { tier: "free", tool: "voices", selectedVoiceId: "" };
  }
  const voiceId = attached!.voiceId?.trim() || "";
  const tier: FilmVoiceTier = isFreeGenAudioVoiceId(voiceId) ? "free" : "paid";
  return { tier, tool: "voices", selectedVoiceId: voiceId };
}

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

function FilmAttachedVoiceBanner({ voice }: { voice: FilmCharacterVoicePick }) {
  const { t } = useTranslation();
  const label = voice.voiceLabel?.trim() || voice.voiceId?.trim() || t("Giọng đã gắn");
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-green-200 bg-green-50">
      <RiUserVoiceLine className="text-base text-green-600 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-10 font-semibold text-green-700 m-0 uppercase tracking-wide">
          {t("Giọng đang gắn")}
        </p>
        <p className="text-xs font-bold text-gray-800 m-0 truncate">{label}</p>
      </div>
      <FilmCharacterVoicePlayButton blob={voice.voicePreviewBlob} voiceId={voice.voiceId} />
    </div>
  );
}

function FilmCharacterVoiceBody({
  isOpen,
  characterName,
  attachedVoice,
  onPick,
}: {
  isOpen: boolean;
  characterName?: string;
  attachedVoice?: FilmCharacterVoicePick | null;
  onPick: (voice: FilmCharacterVoicePick) => void;
}) {
  const { t } = useTranslation();
  const { tool, setTool, credits, running, job, history, library, removeHistory, cancelRun } =
    useVoiceContext();
  const active = getVoiceTool(tool);
  const listMeta = getVoiceTool("voices");
  const initial = resolveFilmVoiceModalState(attachedVoice);
  const [tier, setTier] = useState<FilmVoiceTier>(initial.tier);
  const [selectedVoiceId, setSelectedVoiceId] = useState(initial.selectedVoiceId);
  const currentJobId = jobIdOf(job);
  const currentRecord =
    history.find((item) => item.jobId === currentJobId) ||
    library.find((item) => item.jobId === currentJobId);

  const ttsRecords = useMemo(
    () => library.filter((item) => item.tool === "tts"),
    [library]
  );

  useEffect(() => {
    if (!isOpen) return;
    const state = resolveFilmVoiceModalState(attachedVoice);
    setTier(state.tier);
    setSelectedVoiceId(state.selectedVoiceId);
    setTool(state.tool);
  }, [isOpen, attachedVoice, setTool]);

  const handleTierChange = (next: FilmVoiceTier) => {
    setTier(next);
    if (next === "free" && tool === "clone") {
      setTool("voices");
    }
  };

  const handlePick = (voice: FilmCharacterVoicePick) => {
    setSelectedVoiceId(voice.voiceId?.trim() || "");
    onPick(voice);
  };

  const listHeader =
    tool === "voices" ? (
      <>
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
              {tier === "free"
                ? t("Chọn giọng miễn phí để gắn cho nhân vật.")
                : t("Chọn giọng đã tạo hoặc giọng có sẵn để gắn cho nhân vật.")}
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
      </>
    ) : null;

  return (
    <div
      className="overflow-y-auto overscroll-contain v-scrollbar"
      style={{ maxHeight: "calc(100vh - 10rem)" }}
    >
      <div className="px-5 pt-3 pb-2 space-y-2">
        {characterName ? (
          <p className="text-xs text-gray-500 m-0">
            {t("Gắn giọng cho")} <span className="font-semibold text-gray-800">{characterName}</span>
          </p>
        ) : null}

        {hasAttachedFilmVoice(attachedVoice) && attachedVoice ? (
          <FilmAttachedVoiceBanner voice={attachedVoice} />
        ) : null}

        <FilmVoiceTierTabs tier={tier} onChange={handleTierChange} />

        <div className="flex gap-1 p-1 rounded-xl bg-gray-50 border border-gray-100">
          {FILM_CHARACTER_VOICE_TABS.map((tab) => {
            const meta = getVoiceTool(tab.id);
            const selected = tool === tab.id;
            const disabled = tier === "free" && tab.id === "clone";
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTool(tab.id)}
                disabled={disabled}
                className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-bold border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  color: selected ? meta.color : "#6b7280",
                  background: selected ? `${meta.color}14` : "transparent",
                }}
              >
                <meta.Icon
                  className="text-base flex-shrink-0"
                  style={{ color: selected ? meta.color : "#9ca3af" }}
                />
                <span className="truncate">{t(tab.labelKey)}</span>
              </button>
            );
          })}
        </div>

        <p className="text-10 text-gray-400 m-0">
          {tier === "paid" ? (
            <>
              {t("Text credit")}: {credits}
            </>
          ) : (
            t("Miễn phí — không trừ text credit")
          )}
        </p>
      </div>

      <div
        className={`px-5 pb-12 pt-2 space-y-4 border-t border-gray-100 ${
          tool === "voices" ? "bg-amber-50/40" : ""
        }`}
      >
        <FilmVoiceToolContent
          tier={tier}
          tool={tool}
          onPick={handlePick}
          ttsRecords={ttsRecords}
          selectedVoiceId={selectedVoiceId}
          listHeader={listHeader}
        />
      </div>

      {!running && currentRecord?.blobs?.length && tool !== "voices" ? (
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
      ) : running && tool !== "voices" ? (
        <div className="px-5 py-3 border-t border-gray-100">
          <FilmCharacterVoiceRunningBanner color={active.color} onStop={cancelRun} />
        </div>
      ) : null}
    </div>
  );
}

export default function FilmCharacterVoiceDialog({
  isOpen,
  characterName,
  attachedVoice,
  title,
  onClose,
  onPick,
}: DialogProps) {
  const { t } = useTranslation();
  const modalState = resolveFilmVoiceModalState(attachedVoice);

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
            initialTool={modalState.tool}
            allowedTools={FILM_CHARACTER_VOICE_TOOLS}
            layout="stack"
          >
            <FilmCharacterVoiceBody
              isOpen={isOpen}
              characterName={characterName}
              attachedVoice={attachedVoice}
              onPick={onPick}
            />
          </VoiceProvider>
        ) : null}
      </Dialog.Body>
    </Dialog>
  );
}
