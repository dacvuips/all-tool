import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiUserVoiceLine } from "react-icons/ri";
import { Dialog } from "../shared/utilities/dialog/dialog";
import { Button } from "../shared/utilities/form";
import { buildFilmCharacterImagePrompt } from "./film-character-image-prompt";
import FilmCharacterVoiceDialog, {
  FilmCharacterVoicePlayButton,
  type FilmCharacterVoicePick,
} from "./film-character-voice-dialog";
import {
  clearFilmCharacterVoice,
  filmCharacterHasVoice,
  FilmCharacterVoiceUnlinkButton,
} from "./film-character-voice-icon";
import FilmEditDialogShell, {
  FILM_EDIT_DIALOG_BODY_CLASS,
  FILM_EDIT_DIALOG_CLASS,
  FILM_EDIT_DIALOG_FOOTER_CLASS,
  FILM_EDIT_DIALOG_HEADER_CLASS,
  FILM_EDIT_DIALOG_WRAPPER_CLASS,
  FILM_EDIT_PROMPT_TEXTAREA_CLASS,
  FILM_EDIT_PROMPT_TEXTAREA_STYLE,
} from "./film-edit-dialog-shell";
import {
  FilmCharacterRecord,
  FilmCharacterRole,
  FilmEpisodeRecord,
  filmCharacterRoleLabel,
} from "./film-types";

const ROLE_OPTIONS: { value: FilmCharacterRole; label: string }[] = [
  { value: "main", label: "Main" },
  { value: "antagonist", label: "Antagonist" },
  { value: "supporting", label: "Supporting" },
  { value: "extra", label: "Extra" },
];

type Props = {
  character: FilmCharacterRecord | null;
  episodes?: FilmEpisodeRecord[];
  promptTemplate?: string | null;
  onClose: () => void;
  onSave: (c: FilmCharacterRecord) => Promise<void>;
};

export default function FilmCharacterEditDialog({
  character,
  episodes = [],
  promptTemplate,
  onClose,
  onSave,
}: Props) {
  const { t } = useTranslation();
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<string>("supporting");
  const [editDesc, setEditDesc] = useState("");
  const [editClothing, setEditClothing] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [editEpisodeIds, setEditEpisodeIds] = useState<string[]>([]);
  const [editVoiceId, setEditVoiceId] = useState("");
  const [editVoiceLabel, setEditVoiceLabel] = useState("");
  const [editVoiceBlob, setEditVoiceBlob] = useState<Blob | undefined>(undefined);
  const [editVoiceResultId, setEditVoiceResultId] = useState("");
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);

  useEffect(() => {
    if (!character) {
      setVoiceModalOpen(false);
      return;
    }
    setEditName(character.name);
    setEditRole(character.role || "supporting");
    setEditDesc(character.description || "");
    setEditClothing(character.clothingAccessories || "");
    setEditEpisodeIds([...(character.episodeIds || [])]);
    setEditVoiceId(character.voiceId || "");
    setEditVoiceLabel(character.voiceLabel || "");
    setEditVoiceBlob(character.voicePreviewBlob);
    setEditVoiceResultId(character.voiceResultId || "");
    setVoiceModalOpen(false);
    setEditPrompt(
      character.imagePrompt?.trim() || buildFilmCharacterImagePrompt(character, promptTemplate)
    );
  }, [character, promptTemplate]);

  const toggleEditEpisode = (episodeId: string) => {
    setEditEpisodeIds((prev) =>
      prev.includes(episodeId) ? prev.filter((id) => id !== episodeId) : [...prev, episodeId]
    );
  };

  const saveEdit = async () => {
    if (!character) return;
    const draft: FilmCharacterRecord = {
      ...character,
      name: editName.trim() || character.name,
      role: editRole,
      description: editDesc.trim(),
      clothingAccessories: editClothing.trim(),
      episodeIds: [...editEpisodeIds],
      voiceId: editVoiceId || undefined,
      voiceLabel: editVoiceLabel || undefined,
      voicePreviewBlob: editVoiceBlob,
      voiceResultId: editVoiceResultId || undefined,
      imagePrompt:
        editPrompt.trim() ||
        buildFilmCharacterImagePrompt(
          {
            name: editName.trim() || character.name,
            description: editDesc.trim(),
            clothingAccessories: editClothing.trim(),
          },
          promptTemplate
        ),
      updatedAt: new Date().toISOString(),
    };
    await onSave(draft);
  };

  const removeVoice = async () => {
    if (!character) return;
    setEditVoiceId("");
    setEditVoiceLabel("");
    setEditVoiceBlob(undefined);
    setEditVoiceResultId("");
    const draft = clearFilmCharacterVoice({
      ...character,
      name: editName.trim() || character.name,
      role: editRole,
      description: editDesc.trim(),
      clothingAccessories: editClothing.trim(),
      episodeIds: [...editEpisodeIds],
      imagePrompt:
        editPrompt.trim() ||
        buildFilmCharacterImagePrompt(
          {
            name: editName.trim() || character.name,
            description: editDesc.trim(),
            clothingAccessories: editClothing.trim(),
          },
          promptTemplate
        ),
    });
    await onSave(draft);
  };

  return (
    <>
      <Dialog
        isOpen={!!character}
        onClose={onClose}
        title={t("Sửa nhân vật")}
        width={560}
        maxWidth="95vw"
        slideFromBottom="none"
        wrapperClass={FILM_EDIT_DIALOG_WRAPPER_CLASS}
        dialogClass={FILM_EDIT_DIALOG_CLASS}
        headerClass={FILM_EDIT_DIALOG_HEADER_CLASS}
        bodyClass={FILM_EDIT_DIALOG_BODY_CLASS}
        footerClass={FILM_EDIT_DIALOG_FOOTER_CLASS}
      >
        <Dialog.Body>
          <FilmEditDialogShell>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{t("Tên")}</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                {t("Vai trò")}
              </label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white"
              >
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {filmCharacterRoleLabel(o.value)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{t("Mô tả")}</label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={3}
                placeholder={t("Ngoại hình, tính cách (không gồm trang phục)…")}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 resize-y"
                style={{ maxHeight: 120 }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                {t("Clothing & Accessories")}
              </label>
              <p className="text-10 text-gray-400 m-0 mb-1.5">
                {t("Trang phục, giày dép, trang sức, phụ kiện — dùng cho image prompt")}
              </p>
              <textarea
                value={editClothing}
                onChange={(e) => setEditClothing(e.target.value)}
                rows={3}
                placeholder={t("vd. Áo sơ mi trắng, đồng hồ da nâu, balo canvas…")}
                className="w-full rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 resize-y"
                style={{ maxHeight: 120 }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{t("Giọng")}</label>
              {editVoiceId || editVoiceLabel || editVoiceBlob ? (
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
                  <span className="flex-1 min-w-0 text-sm font-semibold text-gray-800 truncate">
                    {editVoiceLabel || editVoiceId}
                  </span>
                  <FilmCharacterVoicePlayButton blob={editVoiceBlob} voiceId={editVoiceId} />
                  <button
                    type="button"
                    onClick={() => setVoiceModalOpen(true)}
                    className="text-xs font-semibold text-blue-600 bg-transparent border-0 cursor-pointer p-0 hover:underline flex-shrink-0"
                  >
                    {t("Đổi")}
                  </button>
                  {filmCharacterHasVoice({
                    voiceId: editVoiceId,
                    voiceLabel: editVoiceLabel,
                    voicePreviewBlob: editVoiceBlob,
                  }) ? (
                    <FilmCharacterVoiceUnlinkButton
                      onClick={() => void removeVoice()}
                      className="!w-7 !h-7"
                    />
                  ) : null}
                </div>
              ) : (
                <Button
                  outline
                  text={t("Tạo giọng")}
                  icon={<RiUserVoiceLine />}
                  className="!rounded-xl"
                  onClick={() => setVoiceModalOpen(true)}
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                {t("Gắn tập phim")}
              </label>
              <p className="text-10 text-gray-400 m-0 mb-1.5">
                {t("Ảnh nhân vật chỉ hiện trong Gắn Nhân vật của các tập đã chọn.")}
              </p>
              {episodes.length === 0 ? (
                <p className="text-xs text-gray-400 m-0">{t("Chưa có tập phim.")}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {episodes.map((ep) => {
                    const on = editEpisodeIds.includes(ep.id);
                    const label = ep.title || t("Tập {{n}}", { n: ep.index });
                    return (
                      <button
                        key={ep.id}
                        type="button"
                        onClick={() => toggleEditEpisode(ep.id)}
                        className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer ${
                          on
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                {t("Prompt instruction")}
              </label>
              <textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                rows={5}
                className={FILM_EDIT_PROMPT_TEXTAREA_CLASS}
                style={FILM_EDIT_PROMPT_TEXTAREA_STYLE}
              />
              <button
                type="button"
                className="mt-1.5 text-xs text-blue-600 bg-transparent border-0 cursor-pointer p-0 hover:underline"
                onClick={() =>
                  setEditPrompt(
                    buildFilmCharacterImagePrompt(
                      {
                        name: editName.trim() || character?.name || "",
                        description: editDesc.trim(),
                        clothingAccessories: editClothing.trim(),
                      },
                      promptTemplate
                    )
                  )
                }
              >
                {t("Đặt lại prompt mặc định")}
              </button>
            </div>
          </FilmEditDialogShell>
        </Dialog.Body>
        <Dialog.Footer>
          <Button outline text={t("Hủy")} className="!rounded-xl" onClick={onClose} />
          <Button
            primary
            text={t("Lưu")}
            className="!rounded-xl !bg-blue-600 hover:!bg-blue-700"
            onClick={saveEdit}
          />
        </Dialog.Footer>
      </Dialog>

      <FilmCharacterVoiceDialog
        isOpen={voiceModalOpen}
        characterName={editName.trim() || character?.name}
        onClose={() => setVoiceModalOpen(false)}
        onPick={(voice: FilmCharacterVoicePick) => {
          setEditVoiceId(voice.voiceId);
          setEditVoiceLabel(voice.voiceLabel);
          setEditVoiceBlob(voice.voicePreviewBlob);
          setEditVoiceResultId(voice.voiceResultId || "");
          setVoiceModalOpen(false);
        }}
      />
    </>
  );
}
