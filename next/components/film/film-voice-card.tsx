/**

 * Card 1 lời thoại — tab Tạo giọng (sau khi tách field Thoại).

 */

import { useEffect, useMemo, useState } from "react";

import { useTranslation } from "react-i18next";

import { RiCloseLine, RiUserVoiceLine } from "react-icons/ri";

import { VoiceWaveformPlayer } from "../app/voice/voice-catalog-card";

import { getVoiceTool } from "../app/voice/voice-tools-config";

import { SceneMediaError } from "../app/affiliate-video/shared/scene-media-error";

import { Switch } from "../shared/utilities/form";

import {
  dialogueLineCreating,

  dialogueLineReady,

  normalizeDialogueLineVoiceTakes,

  resolveDialogueLineVoiceLink,

  type FilmVoiceListItem,
} from "./film-dialogue";

import { FilmCharacterVoiceCreateButton } from "./film-character-voice-icon";

import type {
  FilmCharacterRecord,

  FilmDialogueLineRecord,

  FilmDialogueVoiceTakeRecord,

  FilmSceneRecord,
} from "./film-types";

import { FilmVoiceTierSuffix } from "./film-voice-tier";



const TTS_WAVE_COLOR = getVoiceTool("tts").color;



type Props = {

  item: FilmVoiceListItem;

  characters?: FilmCharacterRecord[];

  episodeLabel?: string;

  onCreateVoice?: (item: FilmVoiceListItem) => void;

  onStopVoice?: (item: FilmVoiceListItem) => void;

  onPickLineVoice?: (item: FilmVoiceListItem) => void;

  onSetDefaultVoiceTake?: (item: FilmVoiceListItem, takeId: string) => void | Promise<void>;

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



function DialogueVoiceTakeRow({

  take,

  index,

  isDefault,

  onSetDefault,

}: {

  take: FilmDialogueVoiceTakeRecord;

  index: number;

  isDefault: boolean;

  onSetDefault?: (takeId: string) => void | Promise<void>;

}) {

  const { t } = useTranslation();

  const [audioSrc, setAudioSrc] = useState("");



  useEffect(() => {

    if (take.voiceBlob) {

      const url = URL.createObjectURL(take.voiceBlob);

      setAudioSrc(url);

      return () => URL.revokeObjectURL(url);

    }

    setAudioSrc(take.voiceUrl || "");

  }, [take.voiceBlob, take.voiceUrl]);



  const label = take.voiceLabel || take.voiceId;



  return (

    <div

      className={`flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl border px-3 py-2 ${

        isDefault ? "border-green-200 bg-green-50/40" : "border-gray-100 bg-gray-50/50"

      }`}

    >

      <div className="flex items-center gap-2 min-w-0 flex-shrink-0">

        <span className="text-10 font-bold text-gray-500 tabular-nums">#{index + 1}</span>

        {label ? (

          <span className="text-10 font-medium text-gray-600 truncate max-w-[8rem]">{label}</span>

        ) : null}

      </div>

      <div className="w-full flex-1 min-w-0">

        <VoiceWaveformPlayer src={audioSrc} color={TTS_WAVE_COLOR} />

      </div>

      <Switch

        dependent

        size="sm"

        value={isDefault}

        readOnly={isDefault}

        placeholder={isDefault ? t("Mặc định") : t("Đặt mặc định")}

        className="flex-shrink-0 self-end sm:self-auto text-10"

        onChange={async (next) => {

          if (next && !isDefault) await onSetDefault?.(take.id);

        }}

      />

    </div>

  );

}



export default function FilmVoiceCard({

  item,

  characters = [],

  episodeLabel,

  onCreateVoice,

  onStopVoice,

  onPickLineVoice,

  onSetDefaultVoiceTake,

}: Props) {

  const { t } = useTranslation();

  const { scene, line, lineIndex } = item;

  const sceneLabel = `#${String(scene.index).padStart(2, "0")}`;

  const lineLabel = `${lineIndex}`;

  const speaker = line.character?.trim() || t("Nhân vật");

  const linkedVoice = resolveDialogueLineVoiceLink(line, characters);

  const hasVoiceLink = !!(linkedVoice.voiceId || linkedVoice.voiceLabel);

  const isCustomVoice = !!line.voiceCustom;

  const text = line.line?.trim() || t("Chưa có thoại");

  const ready = dialogueLineReady(line);

  const creating = dialogueLineCreating(line);

  const voiceTakes = useMemo(

    () => normalizeDialogueLineVoiceTakes(line).filter((take) => take.voiceBlob || take.voiceUrl),

    [line]

  );

  const serverDefaultTakeId = useMemo(

    () => voiceTakes.find((t) => t.isDefault)?.id ?? voiceTakes.at(-1)?.id ?? null,

    [voiceTakes]

  );

  const [defaultTakeId, setDefaultTakeId] = useState(serverDefaultTakeId);

  useEffect(() => {

    setDefaultTakeId(serverDefaultTakeId);

  }, [serverDefaultTakeId]);

  const handleSetDefaultVoiceTake = async (takeId: string) => {

    setDefaultTakeId(takeId);

    await onSetDefaultVoiceTake?.(item, takeId);

  };



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



  const createButtonLabel = voiceTakes.length ? t("Tạo thêm") : t("Tạo Giọng");

  const createButtonClass = voiceTakes.length

    ? "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50"

    : "bg-blue-600 hover:bg-blue-700 text-white border-0";



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

            <span

              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-10 font-semibold border max-w-[20rem] ${

                isCustomVoice

                  ? "bg-amber-50 text-amber-800 border-amber-100"

                  : "bg-green-50 text-green-700 border-green-100"

              }`}

            >

              <RiUserVoiceLine className="text-10 flex-shrink-0" />

              <span className="truncate min-w-0">

                {linkedVoice.voiceLabel || linkedVoice.voiceId}

              </span>

              <FilmVoiceTierSuffix voiceId={linkedVoice.voiceId} />

            </span>

          ) : null}

          {onPickLineVoice ? (

            <FilmCharacterVoiceCreateButton

              title={t("Chọn giọng riêng cho câu thoại")}

              onClick={(e) => {

                e.stopPropagation();

                onPickLineVoice(item);

              }}

              className={isCustomVoice ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50" : ""}

            />

          ) : null}

          {isCustomVoice ? (

            <span className="text-10 font-semibold text-amber-700 uppercase tracking-wide">

              {t("Riêng")}

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



      <div className="flex flex-col gap-2 pt-1 border-t border-gray-50 mt-0.5">

        {voiceTakes.length ? (

          <div className="flex flex-col gap-2">

            {voiceTakes.map((take, i) => (

              <DialogueVoiceTakeRow

                key={take.id}

                take={take}

                index={i}

                isDefault={take.id === defaultTakeId}

                onSetDefault={handleSetDefaultVoiceTake}

              />

            ))}

          </div>

        ) : !creating ? (

          <p className="text-xs text-gray-500 m-0">{t("Chưa tạo file âm thanh")}</p>

        ) : null}



        <div className="flex items-center justify-between gap-3">

          <div className="flex items-center gap-1.5 text-xs text-gray-500 min-w-0">

            {creating ? (

              <>

                <span className="w-3.5 h-3.5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin flex-shrink-0" />

                <span className="truncate">{t("Đang tạo giọng...")}</span>

              </>

            ) : voiceTakes.length ? (

              <span className="truncate text-gray-400">

                {t("{{count}} bản audio", { count: voiceTakes.length })}

              </span>

            ) : null}

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

                  ? createButtonLabel

                  : t("Gắn giọng cho nhân vật trước")

              }

              className={`flex-shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${

                hasVoiceLink

                  ? `${createButtonClass} cursor-pointer`

                  : "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed"

              }`}

            >

              {!voiceTakes.length ? <RiUserVoiceLine className="text-xs" /> : null}

              {createButtonLabel}

            </button>

          )}

        </div>

      </div>

    </div>

  );

}



// re-export for consumers still typing line

export type { FilmDialogueLineRecord };

