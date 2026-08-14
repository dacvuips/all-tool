import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiPencil, HiPlus } from "react-icons/hi";
import { Dialog } from "../shared/utilities/dialog/dialog";
import { Button } from "../shared/utilities/form";
import FilmProjectSettingsFields, {
  emptyFilmProjectSettingsForm,
  filmProjectSettingsFormFromProject,
  filmProjectSettingsFormToInput,
  useFilmArtStyleOptions,
  type FilmProjectSettingsFormState,
} from "./film-project-settings-fields";
import { FilmProjectCreateInput, FilmProjectRecord } from "./film-types";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  /** Có project = chế độ sửa; không = tạo mới */
  project?: FilmProjectRecord | null;
  onSubmit: (data: FilmProjectCreateInput) => void | Promise<void>;
};

export default function FilmCreateDialog({ isOpen, onClose, project, onSubmit }: Props) {
  const { t } = useTranslation();
  const isEdit = !!project;
  const artStyleOptions = useFilmArtStyleOptions();

  const [form, setForm] = useState<FilmProjectSettingsFormState>(emptyFilmProjectSettingsForm());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(project ? filmProjectSettingsFormFromProject(project) : emptyFilmProjectSettingsForm());
    setError("");
    setSaving(false);
  }, [isOpen, project]);

  const patchForm = (patch: Partial<FilmProjectSettingsFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    if (error) setError("");
  };

  const handleClose = () => {
    setForm(emptyFilmProjectSettingsForm());
    setError("");
    setSaving(false);
    onClose();
  };

  const handleSubmit = async () => {
    const result = filmProjectSettingsFormToInput(form, artStyleOptions);
    if ("error" in result) {
      setError(t(result.error));
      return;
    }
    setSaving(true);
    try {
      await onSubmit(result);
      setForm(emptyFilmProjectSettingsForm());
      setError("");
    } catch {
      // Giữ form nếu lưu IndexedDB thất bại
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      width={560}
      maxWidth="94vw"
      slideFromBottom="none"
      dialogClass="relative overflow-hidden rounded-2xl bg-white shadow-xl"
      bodyClass="relative bg-white"
      hasCloseIcon={false}
    >
      <Dialog.Body>
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-start gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
              {isEdit ? (
                <HiPencil className="text-xl text-blue-600" />
              ) : (
                <HiPlus className="text-xl text-blue-600" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 m-0 leading-tight">
                {isEdit ? t("Sửa Dự án Phim ngắn") : t("Tạo Dự án Phim ngắn")}
              </h2>
              <p className="text-sm text-gray-500 mt-1 m-0">
                {isEdit
                  ? t("Cập nhật thông tin cơ bản của dự án")
                  : t("Nhập thông tin cơ bản của dự án để bắt đầu sản xuất")}
              </p>
            </div>
          </div>

          <FilmProjectSettingsFields
            form={form}
            onChange={patchForm}
            nameError={error}
            disabled={saving}
          />

          <div className="flex items-center justify-end gap-3 mt-7 pt-1">
            <Button
              text={t("Hủy")}
              outline
              className="!rounded-xl !px-5"
              onClick={handleClose}
              disabled={saving}
            />
            <Button
              primary
              text={isEdit ? t("Lưu thay đổi") : t("Tạo dự án")}
              icon={isEdit ? <HiPencil /> : <HiPlus />}
              className="!rounded-xl !px-5 !bg-blue-600 hover:!bg-blue-700"
              onClick={handleSubmit}
              isLoading={saving}
            />
          </div>
        </div>
      </Dialog.Body>
    </Dialog>
  );
}
