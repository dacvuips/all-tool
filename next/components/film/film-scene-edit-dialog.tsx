/**
 * Modal chỉnh sửa toàn bộ thông tin phân cảnh.
 * Sửa trên draft → bấm Lưu mới ghi vào Chuỗi phân cảnh / IDB.
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "../shared/utilities/dialog/dialog";
import { Button } from "../shared/utilities/form";
import type { FilmAttachOption } from "./film-attach-fields";
import {
  FILM_EDIT_DIALOG_BODY_CLASS,
  FILM_EDIT_DIALOG_CLASS,
  FILM_EDIT_DIALOG_FOOTER_CLASS,
  FILM_EDIT_DIALOG_HEADER_CLASS,
  FILM_EDIT_DIALOG_WRAPPER_CLASS,
} from "./film-edit-dialog-shell";
import FilmStoryboardSceneDetail from "./film-storyboard-scene-detail";
import type { FilmSceneRecord } from "./film-types";

type Props = {
  isOpen: boolean;
  scene: FilmSceneRecord | null;
  imagePromptDefault?: string;
  videoPromptDefault?: string;
  audioPromptDefault?: string;
  characterOptions?: FilmAttachOption[];
  propOptions?: FilmAttachOption[];
  sceneLocationOptions?: FilmAttachOption[];
  onClose: () => void;
  /** Lưu full scene → parent cập nhật Chuỗi phân cảnh */
  onSave: (scene: FilmSceneRecord) => void | Promise<void>;
  onOpenAttachEntity?: (
    kind: "character" | "prop" | "location",
    option: FilmAttachOption
  ) => void;
};

export default function FilmSceneEditDialog({
  isOpen,
  scene,
  imagePromptDefault = "",
  videoPromptDefault = "",
  audioPromptDefault = "",
  characterOptions = [],
  propOptions = [],
  sceneLocationOptions = [],
  onClose,
  onSave,
  onOpenAttachEntity,
}: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<FilmSceneRecord | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !scene) {
      setDraft(null);
      setDirty(false);
      setSaving(false);
      return;
    }
    setDraft(scene);
    setDirty(false);
    setSaving(false);
  }, [isOpen, scene?.id]);

  const title = useMemo(() => {
    if (!draft) return t("Sửa phân cảnh");
    const name = draft.title?.trim() || draft.summary?.trim();
    return name ? `${t("Sửa phân cảnh")} · #${draft.index} ${name}` : t("Sửa phân cảnh");
  }, [draft, t]);

  const handlePatch = (patch: Partial<FilmSceneRecord>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!draft || saving || !dirty) return;
    setSaving(true);
    try {
      const next: FilmSceneRecord = {
        ...draft,
        updatedAt: new Date().toISOString(),
      };
      await onSave(next);
      setDirty(false);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (saving) return;
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen && !!draft}
      onClose={handleCancel}
      width="920px"
      maxWidth="96vw"
      slideFromBottom="none"
      wrapperClass={FILM_EDIT_DIALOG_WRAPPER_CLASS}
      dialogClass={FILM_EDIT_DIALOG_CLASS}
      headerClass={FILM_EDIT_DIALOG_HEADER_CLASS}
      bodyClass={FILM_EDIT_DIALOG_BODY_CLASS}
      footerClass={FILM_EDIT_DIALOG_FOOTER_CLASS}
      title={title}
    >
      <Dialog.Body>
        <div
          className="overflow-y-auto overscroll-contain px-1 sm:px-2"
          style={{ maxHeight: "calc(100vh - 12rem)" }}
        >
          <FilmStoryboardSceneDetail
            scene={draft}
            imagePromptDefault={imagePromptDefault}
            videoPromptDefault={videoPromptDefault}
            audioPromptDefault={audioPromptDefault}
            characterOptions={characterOptions}
            propOptions={propOptions}
            sceneLocationOptions={sceneLocationOptions}
            onChange={handlePatch}
            onOpenAttachEntity={onOpenAttachEntity}
          />
        </div>
      </Dialog.Body>
      <Dialog.Footer>
        <Button outline text={t("Hủy")} onClick={handleCancel} disabled={saving} />
        <Button
          primary
          text={t("Lưu")}
          onClick={() => void handleSave()}
          isLoading={saving}
          disabled={!dirty || saving}
        />
      </Dialog.Footer>
    </Dialog>
  );
}
