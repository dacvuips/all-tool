import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiPencil, HiPlus } from "react-icons/hi";
import { useOptionsTranslation } from "../../lib/hooks/useOptionsTranslate";
import { Dialog } from "../shared/utilities/dialog/dialog";
import { Button, Select } from "../shared/utilities/form";
import {
  FILM_ART_STYLE_FREE,
  FilmAspectRatio,
  FilmNarration,
  FilmProjectCreateInput,
  FilmProjectRecord,
} from "./film-types";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  /** Có project = chế độ sửa; không = tạo mới */
  project?: FilmProjectRecord | null;
  onSubmit: (data: FilmProjectCreateInput) => void | Promise<void>;
};

function OptionCard({
  selected,
  title,
  subtitle,
  badge,
  onClick,
}: {
  selected: boolean;
  title: string;
  subtitle: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 min-w-0 text-left rounded-xl border-2 p-3.5 transition-all cursor-pointer ${
        selected
          ? "border-blue-500 bg-blue-50 shadow-sm"
          : "border-transparent bg-gray-50 hover:bg-gray-100"
      }`}
    >
      <div className="flex items-start gap-3">
        {badge && (
          <div
            className={`flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center text-10 font-bold ${
              selected ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-600"
            }`}
          >
            {badge}
          </div>
        )}
        <div className="min-w-0">
          <div className={`text-sm font-semibold ${selected ? "text-blue-700" : "text-gray-800"}`}>
            {title}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>
        </div>
      </div>
    </button>
  );
}

function emptyForm() {
  return {
    name: "",
    episodeCount: 1,
    scenesPerEpisode: "" as string,
    artStyleId: FILM_ART_STYLE_FREE,
    aspectRatio: "16:9" as FilmAspectRatio,
    narration: "dialogue" as FilmNarration,
  };
}

function formFromProject(project: FilmProjectRecord) {
  return {
    name: project.name || "",
    episodeCount: Math.max(1, project.episodeCount || 1),
    scenesPerEpisode:
      project.scenesPerEpisode != null && project.scenesPerEpisode !== undefined
        ? String(project.scenesPerEpisode)
        : "",
    artStyleId: project.artStyleId || FILM_ART_STYLE_FREE,
    aspectRatio: (project.aspectRatio === "9:16" ? "9:16" : "16:9") as FilmAspectRatio,
    narration: (project.narration === "third_person" ? "third_person" : "dialogue") as FilmNarration,
  };
}

export default function FilmCreateDialog({ isOpen, onClose, project, onSubmit }: Props) {
  const { t } = useTranslation();
  const { ART_STYLE_TRANSLATED_OPTIONS } = useOptionsTranslation();
  const isEdit = !!project;

  const artStyleOptions = useMemo(
    () => [
      { value: FILM_ART_STYLE_FREE, label: t("Tự do (Không dán đè Style)") },
      ...ART_STYLE_TRANSLATED_OPTIONS.filter(
        (opt) => opt.value !== FILM_ART_STYLE_FREE && opt.value !== ""
      ),
    ],
    [ART_STYLE_TRANSLATED_OPTIONS, t]
  );

  const [name, setName] = useState("");
  const [episodeCount, setEpisodeCount] = useState(1);
  const [scenesPerEpisode, setScenesPerEpisode] = useState<string>("");
  const [artStyleId, setArtStyleId] = useState<string>(FILM_ART_STYLE_FREE);
  const [aspectRatio, setAspectRatio] = useState<FilmAspectRatio>("16:9");
  const [narration, setNarration] = useState<FilmNarration>("dialogue");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Load form khi mở dialog / đổi project
  useEffect(() => {
    if (!isOpen) return;
    const next = project ? formFromProject(project) : emptyForm();
    setName(next.name);
    setEpisodeCount(next.episodeCount);
    setScenesPerEpisode(next.scenesPerEpisode);
    setArtStyleId(next.artStyleId);
    setAspectRatio(next.aspectRatio);
    setNarration(next.narration);
    setError("");
    setSaving(false);
  }, [isOpen, project]);

  const reset = () => {
    const next = emptyForm();
    setName(next.name);
    setEpisodeCount(next.episodeCount);
    setScenesPerEpisode(next.scenesPerEpisode);
    setArtStyleId(next.artStyleId);
    setAspectRatio(next.aspectRatio);
    setNarration(next.narration);
    setError("");
    setSaving(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("Vui lòng nhập tên dự án"));
      return;
    }
    const style = artStyleOptions.find((o) => o.value === artStyleId) || artStyleOptions[0];
    const scenes =
      scenesPerEpisode.trim() === "" ? undefined : Math.max(0, parseInt(scenesPerEpisode, 10) || 0);

    setSaving(true);
    try {
      await onSubmit({
        name: trimmed,
        episodeCount: Math.max(1, episodeCount || 1),
        scenesPerEpisode: scenes,
        artStyleId: style.value,
        artStyleLabel: style.value === FILM_ART_STYLE_FREE ? "" : style.label,
        aspectRatio,
        narration,
      });
      reset();
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

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t("Tên dự án")} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError("");
                }}
                placeholder={t("Ví dụ: Phim ngắn tình cảm Nhiệt Huyết")}
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-shadow"
              />
              {error && <p className="text-xs text-red-500 mt-1.5 m-0">{error}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t("Số tập dự kiến")}
                </label>
                <input
                  type="number"
                  min={1}
                  value={episodeCount}
                  onChange={(e) => setEpisodeCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-shadow"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t("Số phân cảnh dự kiến mỗi tập")}
                </label>
                <input
                  type="number"
                  min={0}
                  value={scenesPerEpisode}
                  onChange={(e) => setScenesPerEpisode(e.target.value)}
                  placeholder={t("Tự động chia (để trống)")}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-shadow placeholder-gray-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t("Phong cách hình ảnh")}
              </label>
              <Select
                searchable
                clearable={false}
                menuPlacement="auto"
                menuPosition="fixed"
                className="rounded-xl border-gray-200"
                options={artStyleOptions}
                value={artStyleId}
                onChange={(v: string) => setArtStyleId(v ?? FILM_ART_STYLE_FREE)}
                placeholder={t("Tìm kiếm...")}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("Tỉ lệ khung hình")}
              </label>
              <div className="flex gap-3 flex-col sm:flex-row">
                <OptionCard
                  selected={aspectRatio === "16:9"}
                  title={t("Ngang (16:9)")}
                  subtitle={t("Youtube, TV, PC")}
                  badge="16:9"
                  onClick={() => setAspectRatio("16:9")}
                />
                <OptionCard
                  selected={aspectRatio === "9:16"}
                  title={t("Dọc (9:16)")}
                  subtitle={t("TikTok, Reels, Shorts")}
                  badge="9:16"
                  onClick={() => setAspectRatio("9:16")}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("Ngôi kể")}
              </label>
              <div className="flex gap-3 flex-col sm:flex-row">
                <OptionCard
                  selected={narration === "dialogue"}
                  title={t("Đối thoại")}
                  subtitle={t("Tự động tạo thoại của nhân vật")}
                  onClick={() => setNarration("dialogue")}
                />
                <OptionCard
                  selected={narration === "third_person"}
                  title={t("Ngôi 3")}
                  subtitle={t("Tự động tạo lời dẫn chuyện")}
                  onClick={() => setNarration("third_person")}
                />
              </div>
            </div>
          </div>

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
