/**
 * Modal cấu hình giọng chung — chọn nhân vật + giọng từ dropdown, hoặc tạo giọng mới.
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiLoader4Line } from "react-icons/ri";
import { useAuth } from "../../lib/providers/auth-provider";
import { customerIdOf } from "../app/voice/voice-access";
import { jobIdOf } from "../app/voice/voice-api";
import { listVoiceResults, voiceOwnerIdOf, type VoiceResultRecord } from "../app/voice/voice-idb";
import { VoiceJobResult } from "../app/voice/voice-job-result";
import { VoiceProvider, useVoiceContext } from "../app/voice/voice-provider";
import { getVoiceTool } from "../app/voice/voice-tools-config";
import { Dialog } from "../shared/utilities/dialog/dialog";
import { Button } from "../shared/utilities/form";
import {
  FILM_EDIT_DIALOG_BODY_CLASS,
  FILM_EDIT_DIALOG_CLASS,
  FILM_EDIT_DIALOG_HEADER_CLASS,
  FILM_EDIT_DIALOG_WRAPPER_CLASS,
} from "./film-edit-dialog-shell";
import {
  FILM_CHARACTER_VOICE_TABS,
  FILM_CHARACTER_VOICE_TOOLS,
  recordToPick,
  type FilmCharacterVoicePick,
} from "./film-character-voice-dialog";
import { FilmCharacterVoicePlayButton } from "./film-character-voice-play-button";
import FilmVoiceToolContent from "./film-voice-tool-content";
import { FilmVoiceTierTabs, type FilmVoiceTier } from "./film-voice-tier";
import {
  clearFilmCharacterVoice,
  filmCharacterHasVoice,
  FilmCharacterVoiceUnlinkButton,
} from "./film-character-voice-icon";
import type { FilmCharacterRecord } from "./film-types";

type VoiceOption = FilmCharacterVoicePick & { key: string };

type Props = {
  isOpen: boolean;
  characters: FilmCharacterRecord[];
  onClose: () => void;
  onSave: (character: FilmCharacterRecord) => Promise<void>;
};

function buildVoiceOptions(
  records: VoiceResultRecord[],
  characters: FilmCharacterRecord[]
): VoiceOption[] {
  const seen = new Set<string>();
  const out: VoiceOption[] = [];

  const push = (key: string, pick: FilmCharacterVoicePick) => {
    if (!pick.voiceId && !pick.voiceLabel) return;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ key, ...pick });
  };

  for (const record of records) {
    const pick = recordToPick(record);
    if (!pick) continue;
    push(pick.voiceResultId || pick.voiceId, pick);
  }

  for (const c of characters) {
    const voiceId = c.voiceId?.trim();
    const voiceLabel = c.voiceLabel?.trim();
    if (!voiceId && !voiceLabel) continue;
    push(`char:${c.id}`, {
      voiceId: voiceId || voiceLabel || "",
      voiceLabel: voiceLabel || voiceId || "",
      voicePreviewBlob: c.voicePreviewBlob,
      voiceResultId: c.voiceResultId,
    });
  }

  return out.sort((a, b) => a.voiceLabel.localeCompare(b.voiceLabel, "vi"));
}

function FilmVoiceConfigBody({
  characters,
  onSave,
}: {
  characters: FilmCharacterRecord[];
  onSave: (character: FilmCharacterRecord) => Promise<void>;
}) {
  const { t } = useTranslation();
  const { customer } = useAuth();
  const ownerId = voiceOwnerIdOf(customerIdOf(customer));
  const { tool, setTool, credits, running, job, history, library, removeHistory, cancelRun } =
    useVoiceContext();
  const active = getVoiceTool(tool);
  const listMeta = getVoiceTool("voices");
  const [tier, setTier] = useState<FilmVoiceTier>("paid");
  const currentJobId = jobIdOf(job);
  const currentRecord =
    history.find((item) => item.jobId === currentJobId) ||
    library.find((item) => item.jobId === currentJobId);
  const ttsRecords = useMemo(
    () => library.filter((item) => item.tool === "tts"),
    [library]
  );

  const sortedCharacters = useMemo(
    () => [...characters].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "vi")),
    [characters]
  );

  const [selectedCharId, setSelectedCharId] = useState("");
  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>([]);
  const [selectedVoiceKey, setSelectedVoiceKey] = useState("");
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedCharacter = sortedCharacters.find((c) => c.id === selectedCharId) || null;
  const selectedVoice = voiceOptions.find((v) => v.key === selectedVoiceKey) || null;

  useEffect(() => {
    if (!sortedCharacters.length) {
      setSelectedCharId("");
      return;
    }
    setSelectedCharId((prev) =>
      sortedCharacters.some((c) => c.id === prev) ? prev : sortedCharacters[0].id
    );
  }, [sortedCharacters]);

  useEffect(() => {
    if (!ownerId) {
      setVoiceOptions(buildVoiceOptions([], characters));
      return;
    }
    let cancelled = false;
    setLoadingVoices(true);
    void listVoiceResults(ownerId)
      .then((records) => {
        if (cancelled) return;
        setVoiceOptions(buildVoiceOptions(records, characters));
      })
      .finally(() => {
        if (!cancelled) setLoadingVoices(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ownerId, characters, history.length]);

  useEffect(() => {
    if (!selectedCharacter) {
      setSelectedVoiceKey("");
      return;
    }
    const voiceId = selectedCharacter.voiceId?.trim();
    const voiceLabel = selectedCharacter.voiceLabel?.trim();
    if (!voiceId && !voiceLabel) {
      setSelectedVoiceKey("");
      return;
    }
    const match =
      voiceOptions.find((v) => v.key === `char:${selectedCharacter.id}`) ||
      voiceOptions.find((v) => v.voiceId === voiceId) ||
      voiceOptions.find((v) => v.voiceLabel === voiceLabel);
    setSelectedVoiceKey(match?.key || "");
  }, [selectedCharacter, voiceOptions]);

  const assignVoice = async (pick: FilmCharacterVoicePick) => {
    if (!selectedCharacter) return;
    setSaving(true);
    try {
      const draft: FilmCharacterRecord = {
        ...selectedCharacter,
        voiceId: pick.voiceId,
        voiceLabel: pick.voiceLabel,
        voicePreviewBlob: pick.voicePreviewBlob,
        voiceResultId: pick.voiceResultId || undefined,
        updatedAt: new Date().toISOString(),
      };
      await onSave(draft);
      setSelectedVoiceKey(
        pick.voiceResultId ? pick.voiceResultId : pick.voiceId || selectedVoiceKey
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!selectedVoice) return;
    await assignVoice(selectedVoice);
  };

  const removeVoice = async () => {
    if (!selectedCharacter || !filmCharacterHasVoice(selectedCharacter)) return;
    setSaving(true);
    try {
      await onSave(clearFilmCharacterVoice(selectedCharacter));
      setSelectedVoiceKey("");
    } finally {
      setSaving(false);
    }
  };

  const handleTierChange = (next: FilmVoiceTier) => {
    setTier(next);
    if (next === "free" && tool === "clone") {
      setTool("voices");
    }
  };

  const listFooter =
    tool === "voices" && running && (job || currentRecord) ? (
      <div className="bg-white p-2 rounded-md">
        <VoiceJobResult
          job={currentRecord?.job || job}
          record={currentRecord}
          loading={!currentRecord?.blobs?.length}
          onDelete={currentRecord ? (id) => void removeHistory(id) : undefined}
        />
      </div>
    ) : null;

  return (
    <div
      className="overflow-y-auto overscroll-contain"
      style={{ maxHeight: "calc(100vh - 10rem)" }}
    >
      <div className="px-5 pt-3 pb-4 space-y-3 border-b border-gray-100 bg-gray-50/60">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              {t("Gắn giọng cho")}
            </label>
            <select
              value={selectedCharId}
              onChange={(e) => setSelectedCharId(e.target.value)}
              disabled={!sortedCharacters.length}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white disabled:opacity-60"
            >
              {!sortedCharacters.length ? (
                <option value="">{t("Chưa có nhân vật")}</option>
              ) : (
                sortedCharacters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.voiceLabel ? ` · ${c.voiceLabel}` : ""}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              {t("Giọng")}
            </label>
            <div className="flex items-center gap-2">
              <select
                value={selectedVoiceKey}
                onChange={(e) => setSelectedVoiceKey(e.target.value)}
                disabled={loadingVoices || !voiceOptions.length}
                className="flex-1 min-w-0 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white disabled:opacity-60"
              >
                <option value="">
                  {loadingVoices
                    ? t("Đang tải...")
                    : voiceOptions.length
                      ? t("Chọn giọng")
                      : t("Chưa có giọng — tạo bên dưới")}
                </option>
                {voiceOptions.map((v) => (
                  <option key={v.key} value={v.key}>
                    {v.voiceLabel || v.voiceId}
                  </option>
                ))}
              </select>
              <FilmCharacterVoicePlayButton
                blob={selectedVoice?.voicePreviewBlob}
                voiceId={selectedVoice?.voiceId}
                size="sm"
              />
              {selectedCharacter && filmCharacterHasVoice(selectedCharacter) ? (
                <FilmCharacterVoiceUnlinkButton
                  onClick={() => void removeVoice()}
                  disabled={saving}
                />
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-10 text-gray-400 m-0">
            {t("Voice Credit")}: {credits}
          </p>
          <Button
            primary
            small
            text={t("Gắn giọng")}
            className="!rounded-lg !bg-blue-600 hover:!bg-blue-700"
            onClick={() => void handleSave()}
            isLoading={saving}
            disabled={!selectedCharacter || !selectedVoice || saving}
          />
        </div>
      </div>

      <div className="px-5 pt-3 pb-2 space-y-2">
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
        <p className="text-xs text-gray-500 m-0">
          {tool === "voices"
            ? tier === "free"
              ? t("Chọn giọng miễn phí để gắn cho nhân vật đang chọn.")
              : t("Chọn giọng đã tạo hoặc giọng có sẵn để gắn cho nhân vật đang chọn.")
            : tier === "free"
              ? t("Tạo giọng miễn phí bên dưới, sau đó chọn trong Danh sách giọng.")
              : t("Tạo giọng mới bên dưới, sau đó chọn trong Danh sách giọng.")}
        </p>
      </div>

      <div
        className={`px-5 pb-5 pt-2 space-y-4 border-t border-gray-100 ${
          tool === "voices" ? "bg-amber-50/40" : ""
        }`}
      >
        {tool === "voices" && running ? (
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

        <FilmVoiceToolContent
          tier={tier}
          tool={tool}
          onPick={(pick) => void assignVoice(pick)}
          ttsRecords={ttsRecords}
          listFooter={listFooter}
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
        </div>
      ) : null}
    </div>
  );
}

export default function FilmVoiceConfigDialog({ isOpen, characters, onClose, onSave }: Props) {
  const { t } = useTranslation();

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("Cấu hình Giọng")}
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
            <FilmVoiceConfigBody characters={characters} onSave={onSave} />
          </VoiceProvider>
        ) : null}
      </Dialog.Body>
    </Dialog>
  );
}
