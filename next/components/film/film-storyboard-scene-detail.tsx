import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiAnnotation,
  HiDotsVertical,
  HiPencil,
  HiRefresh,
  HiShare,
  HiThumbDown,
  HiThumbUp,
} from "react-icons/hi";
import { FilmEntityAttachField, type FilmAttachOption } from "./film-attach-fields";
import {
  countFilmSceneAttachSlots,
  FILM_SCENE_ATTACH_IMAGE_LIMIT,
  getFilmSceneLocationNames,
} from "./film-attachment-validate";
import {
  FILM_CAMERA_ANGLE_OPTIONS,
  FILM_CAMERA_MOVEMENT_OPTIONS,
  FILM_SHOT_SIZE_OPTIONS,
  filmSelectOptionsWithCurrent,
  resolveFilmCameraAngleValue,
  resolveFilmCameraMovementValue,
  resolveFilmShotSizeValue,
} from "./film-shot-options";
import { FilmSceneRecord } from "./film-types";

type Props = {
  scene: FilmSceneRecord | null;
  imagePromptDefault?: string;
  videoPromptDefault?: string;
  audioPromptDefault?: string;
  characterOptions?: FilmAttachOption[];
  propOptions?: FilmAttachOption[];
  sceneLocationOptions?: FilmAttachOption[];
  onChange: (patch: Partial<FilmSceneRecord>) => void;
  /** Icon Gắn → mở tab production + scroll tới card ảnh entity */
  onOpenAttachEntity?: (
    kind: "character" | "prop" | "location",
    option: FilmAttachOption
  ) => void;
};

function PromptField({
  label,
  value,
  defaultValue,
  rows,
  placeholder,
  hint,
  onChangeValue,
  onReset,
}: {
  label: string;
  value: string;
  defaultValue: string;
  rows: number;
  placeholder: string;
  hint: string;
  onChangeValue: (next: string) => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const canReset = (value || "").trim() !== (defaultValue || "").trim();
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <label className="block text-xs font-medium text-gray-500 m-0">{label}</label>
        <button
          type="button"
          onClick={onReset}
          disabled={!canReset}
          title={t("Reset về prompt mặc định")}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-10 font-semibold border-0 bg-transparent cursor-pointer text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-gray-400 disabled:hover:bg-transparent"
        >
          <HiRefresh className="text-xs" />
          {t("Reset")}
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChangeValue(e.target.value)}
        className={textareaClass}
        rows={rows}
        placeholder={placeholder}
      />
      <p className="text-10 text-gray-400 m-0 mt-1">{hint}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 bg-white";
const selectClass = `${inputClass} cursor-pointer appearance-auto`;
const textareaClass = `${inputClass} resize-y min-h-18 leading-relaxed`;

function ShotSelect({
  value,
  options,
  onChange,
  emptyLabel,
}: {
  value: string;
  options: string[];
  onChange: (next: string) => void;
  emptyLabel: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={selectClass}
    >
      <option value="">{emptyLabel}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

export default function FilmStoryboardSceneDetail({
  scene,
  imagePromptDefault = "",
  videoPromptDefault = "",
  audioPromptDefault = "",
  characterOptions = [],
  propOptions = [],
  sceneLocationOptions = [],
  onChange,
  onOpenAttachEntity,
}: Props) {
  const { t } = useTranslation();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  useEffect(() => {
    setEditingTitle(false);
    setTitleDraft(scene?.title || "");
  }, [scene?.id]);

  if (!scene) {
    return (
      <div className="h-full min-h-sm flex items-center justify-center bg-white rounded-2xl border border-gray-100 shadow-sm text-sm text-gray-400">
        {t("Chọn một cảnh quay để chỉnh sửa")}
      </div>
    );
  }

  const sceneTitle = scene.title?.trim() || "";

  const startEditTitle = () => {
    setTitleDraft(scene.title || "");
    setEditingTitle(true);
  };

  const commitTitle = () => {
    const next = titleDraft.trim();
    if (next !== (scene.title || "").trim()) {
      onChange({ title: next });
    }
    setEditingTitle(false);
  };

  return (
    <div className="h-full min-h-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
      <div className="px-4 sm:px-5 py-3.5 border-b border-gray-50 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-base font-bold text-gray-900 m-0 min-w-0 flex items-center gap-2">
            <span className="flex-shrink-0">#{scene.index}</span>
            {editingTitle ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setTitleDraft(scene.title || "");
                    setEditingTitle(false);
                  }
                }}
                placeholder={t("Tiêu đề")}
                className="m-0 min-w-0 flex-1 px-1.5 py-0.5 text-sm font-semibold text-gray-800 bg-white rounded border border-blue-300 outline-none focus:border-blue-500"
              />
            ) : (
              <button
                type="button"
                onClick={startEditTitle}
                className="min-w-0 flex items-center gap-1.5 border-0 bg-transparent p-0 cursor-pointer group"
                title={t("Nhấp để sửa tiêu đề")}
              >
                <span
                  className={`font-semibold truncate min-w-0 ${
                    sceneTitle
                      ? "text-gray-700 group-hover:text-blue-700"
                      : "text-gray-400 italic"
                  }`}
                >
                  {sceneTitle || t("Tiêu đề")}
                </span>
                <HiPencil className="flex-shrink-0 text-sm text-gray-400 group-hover:text-blue-600" />
              </button>
            )}
          </h3>
          <span className="text-sm text-gray-400 flex-shrink-0 ml-auto">
            {scene.durationSec || 0}s
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-6">
        {/* Overview */}
        <section>
          <div className="text-10 font-bold tracking-wider text-gray-400 uppercase mb-2">
            {t("Tổng quan cảnh quay")}
          </div>
          <div className="flex flex-col xl:flex-row gap-3">
            <div className="flex-1 min-w-0">
              <textarea
                value={scene.summary || ""}
                onChange={(e) => onChange({ summary: e.target.value })}
                rows={3}
                className={textareaClass}
                placeholder={t("Tóm tắt cảnh quay...")}
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {scene.cameraAngle && (
                  <span className="px-2.5 py-1 rounded-full text-10 font-medium bg-blue-50 text-blue-600">
                    {scene.cameraAngle}
                  </span>
                )}
                {scene.cameraMovement && (
                  <span className="px-2.5 py-1 rounded-full text-10 font-medium bg-gray-100 text-gray-600">
                    {scene.cameraMovement}
                  </span>
                )}
                <span className="px-2.5 py-1 rounded-full text-10 font-medium bg-gray-100 text-gray-500">
                  {t("Khung hình")} · {t("Chờ tạo")}
                </span>
              </div>
            </div>
          
          </div>
        </section>

        {/* Structure */}
        <section>
          <div className="text-10 font-bold tracking-wider text-gray-400 uppercase mb-3">
            {t("Cấu trúc Cảnh quay")}
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label={t("Cỡ cảnh")}>
                <ShotSelect
                  value={resolveFilmShotSizeValue(scene.shotSize)}
                  options={filmSelectOptionsWithCurrent(
                    FILM_SHOT_SIZE_OPTIONS,
                    resolveFilmShotSizeValue(scene.shotSize)
                  )}
                  emptyLabel={t("— Chọn cỡ cảnh —")}
                  onChange={(shotSize) => onChange({ shotSize })}
                />
              </Field>
              <Field label={t("Góc máy")}>
                <ShotSelect
                  value={resolveFilmCameraAngleValue(scene.cameraAngle)}
                  options={filmSelectOptionsWithCurrent(
                    FILM_CAMERA_ANGLE_OPTIONS,
                    resolveFilmCameraAngleValue(scene.cameraAngle)
                  )}
                  emptyLabel={t("— Chọn góc máy —")}
                  onChange={(cameraAngle) => onChange({ cameraAngle })}
                />
              </Field>
              <Field label={t("Lia máy")}>
                <ShotSelect
                  value={resolveFilmCameraMovementValue(scene.cameraMovement)}
                  options={filmSelectOptionsWithCurrent(
                    FILM_CAMERA_MOVEMENT_OPTIONS,
                    resolveFilmCameraMovementValue(scene.cameraMovement)
                  )}
                  emptyLabel={t("— Chọn lia máy —")}
                  onChange={(cameraMovement) => onChange({ cameraMovement })}
                />
              </Field>
            </div>
            <div className="space-y-3">
              <Field label={t("Gắn Nhân vật")}>
                <FilmEntityAttachField
                  values={scene.characterNames || []}
                  options={characterOptions}
                  usedSlots={countFilmSceneAttachSlots(scene)}
                  maxSlots={FILM_SCENE_ATTACH_IMAGE_LIMIT}
                  onChange={(characterNames) => onChange({ characterNames })}
                  onOpenOption={
                    onOpenAttachEntity
                      ? (opt) => onOpenAttachEntity("character", opt)
                      : undefined
                  }
                  openOptionTitle={t("Mở ảnh nhân vật")}
                />
              </Field>
              <Field label={t("Gắn Vật phẩm")}>
                <FilmEntityAttachField
                  values={scene.propNames || []}
                  options={propOptions}
                  usedSlots={countFilmSceneAttachSlots(scene)}
                  maxSlots={FILM_SCENE_ATTACH_IMAGE_LIMIT}
                  onChange={(propNames) => onChange({ propNames })}
                  onOpenOption={
                    onOpenAttachEntity
                      ? (opt) => onOpenAttachEntity("prop", opt)
                      : undefined
                  }
                  openOptionTitle={t("Mở ảnh vật phẩm")}
                />
              </Field>
              <Field label={t("Gắn Cảnh")}>
                <FilmEntityAttachField
                  values={getFilmSceneLocationNames(scene).slice(0, 1)}
                  options={sceneLocationOptions}
                  usedSlots={countFilmSceneAttachSlots(scene)}
                  maxSlots={FILM_SCENE_ATTACH_IMAGE_LIMIT}
                  maxItems={1}
                  required
                  emptyLabel={t("Bắt buộc gắn đúng 1 bối cảnh")}
                  onChange={(locationNames) => {
                    const only = (locationNames || [])
                      .map((n) => n.trim())
                      .filter(Boolean)
                      .slice(0, 1);
                    const first = only[0] || "";
                    onChange({
                      locationNames: only,
                      sceneTag: first,
                      location: first,
                    });
                  }}
                  onOpenOption={
                    onOpenAttachEntity
                      ? (opt) => onOpenAttachEntity("location", opt)
                      : undefined
                  }
                  openOptionTitle={t("Mở ảnh bối cảnh")}
                />
              </Field>
            </div>
          </div>
        </section>

        {/* Prompts */}
        <section className="rounded-2xl border border-gray-100 p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold text-gray-800">{t("Prompt")}</div>
            <span className="text-10 text-gray-400">
              {t("Cho ảnh, video, nhạc, âm thanh · cấu hình chung ở Setting")}
            </span>
          </div>
          <div className="space-y-3">
            <PromptField
              label={t("Prompt ảnh")}
              value={scene.imagePrompt || ""}
              defaultValue={imagePromptDefault}
              rows={6}
              placeholder={t(
                "Sẽ tự ghép: Cỡ cảnh · Góc máy · [Hành động nhân vật] · [Hình ảnh cảnh quay] · [Không khí cảnh]"
              )}
              hint={t(
                "Mặc định ghép từ Cỡ cảnh, Góc máy và 3 khối [Hành động nhân vật] / [Hình ảnh cảnh quay] / [Không khí cảnh]. Có thể sửa tay, Reset để lấy lại mặc định."
              )}
              onChangeValue={(imagePrompt) =>
                onChange({ imagePrompt, imagePromptCustom: true })
              }
              onReset={() =>
                onChange({
                  imagePrompt: imagePromptDefault,
                  imagePromptCustom: false,
                })
              }
            />
            <PromptField
              label={t("Prompt video")}
              value={scene.videoPrompt || ""}
              defaultValue={videoPromptDefault}
              rows={10}
              placeholder={t(
                "Sẽ tự ghép: Cỡ cảnh · Góc máy · Lia máy · [Hành động nhân vật] · [Hình ảnh cảnh quay] · [Không khí cảnh] · [MOTION] [AUDIO] [SFX] [MUSIC] [VOICE] [DIALOGUE]"
              )}
              hint={t(
                "Mặc định ghép từ cấu trúc cảnh, 3 khối ngữ nghĩa, rồi [MOTION]/[AUDIO]/[SFX]/[MUSIC]/[VOICE]/[DIALOGUE]. Có thể sửa tay, Reset để lấy lại mặc định."
              )}
              onChangeValue={(videoPrompt) =>
                onChange({ videoPrompt, videoPromptCustom: true })
              }
              onReset={() =>
                onChange({
                  videoPrompt: videoPromptDefault,
                  videoPromptCustom: false,
                })
              }
            />
            <PromptField
              label={t("Prompt âm thanh")}
              value={scene.audioPrompt || ""}
              defaultValue={audioPromptDefault}
              rows={8}
              placeholder={t("Sẽ tự ghép: [AUDIO] [SFX] [MUSIC] [VOICE]")}
              hint={t(
                "Mặc định ghép 4 khối [AUDIO], [SFX], [MUSIC], [VOICE]. Có thể sửa tay, Reset để lấy lại mặc định."
              )}
              onChangeValue={(audioPrompt) =>
                onChange({ audioPrompt, audioPromptCustom: true })
              }
              onReset={() =>
                onChange({
                  audioPrompt: audioPromptDefault,
                  audioPromptCustom: false,
                })
              }
            />
          </div>

          <div className="flex items-center justify-end gap-1 mt-3 pt-2">
            <button
              type="button"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-white hover:text-gray-600 border-0 bg-transparent cursor-pointer"
              title={t("Thích")}
            >
              <HiThumbUp />
            </button>
            <button
              type="button"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-white hover:text-gray-600 border-0 bg-transparent cursor-pointer"
              title={t("Không thích")}
            >
              <HiThumbDown />
            </button>
            <button
              type="button"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-white hover:text-gray-600 border-0 bg-transparent cursor-pointer"
              title={t("Bình luận")}
            >
              <HiAnnotation />
            </button>
            <button
              type="button"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-white hover:text-gray-600 border-0 bg-transparent cursor-pointer"
              title={t("Chia sẻ")}
            >
              <HiShare />
            </button>
            <button
              type="button"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-white hover:text-gray-600 border-0 bg-transparent cursor-pointer"
            >
              <HiDotsVertical />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
