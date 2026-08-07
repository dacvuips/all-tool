import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiAnnotation,
  HiDotsVertical,
  HiShare,
  HiThumbDown,
  HiThumbUp,
} from "react-icons/hi";
import { FilmSceneRecord } from "./film-types";

type Props = {
  scene: FilmSceneRecord | null;
  allCharacterNames?: string[];
  allPropNames?: string[];
  onChange: (patch: Partial<FilmSceneRecord>) => void;
};

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
const textareaClass = `${inputClass} resize-y min-h-18 leading-relaxed`;

function TagInput({
  values,
  options,
  onChange,
  placeholder,
}: {
  values: string[];
  options?: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const remaining = (options || []).filter((o) => !values.includes(o));

  const add = (name: string) => {
    const n = name.trim();
    if (!n || values.includes(n)) return;
    onChange([...values, n]);
    setDraft("");
  };

  return (
    <div className="rounded-xl border border-gray-200 p-2.5 bg-white">
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700"
          >
            {v}
            <button
              type="button"
              className="border-0 bg-transparent text-blue-400 hover:text-blue-700 cursor-pointer p-0 leading-none"
              onClick={() => onChange(values.filter((x) => x !== v))}
            >
              ×
            </button>
          </span>
        ))}
        {values.length === 0 && (
          <span className="text-xs text-gray-400">{placeholder || t("Chưa gắn")}</span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
          }}
          placeholder={t("Thêm...")}
          className="flex-1 text-xs border-0 outline-none bg-transparent text-gray-700 placeholder-gray-400"
        />
      </div>
      {remaining.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-50">
          {remaining.slice(0, 8).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => add(o)}
              className="px-2 py-0.5 rounded-md text-10 text-gray-500 bg-gray-50 hover:bg-gray-100 border-0 cursor-pointer"
            >
              + {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FilmStoryboardSceneDetail({
  scene,
  allCharacterNames = [],
  allPropNames = [],
  onChange,
}: Props) {
  const { t } = useTranslation();

  if (!scene) {
    return (
      <div className="h-full min-h-sm flex items-center justify-center bg-white rounded-2xl border border-gray-100 shadow-sm text-sm text-gray-400">
        {t("Chọn một cảnh quay để chỉnh sửa")}
      </div>
    );
  }

  const headerTitle =
    scene.summary || scene.action
      ? `${(scene.summary || scene.action || "").slice(0, 48)}${
          (scene.summary || scene.action || "").length > 48 ? "…" : ""
        } - ${scene.shotSize || ""}`
      : scene.title || "";

  return (
    <div className="h-full min-h-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
      <div className="px-4 sm:px-5 py-3.5 border-b border-gray-50 flex-shrink-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h3 className="text-base font-bold text-gray-900 m-0">
            {t("Cảnh quay")} #{scene.index}
          </h3>
          <span className="text-sm text-gray-400">{scene.durationSec || 0}s</span>
        </div>
        {headerTitle && (
          <p className="text-xs text-gray-500 m-0 mt-1 line-clamp-1">{headerTitle}</p>
        )}
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
            <div className="w-full xl:w-48 flex-shrink-0 rounded-xl bg-gray-100 border border-gray-200 min-h-28 flex items-center justify-center text-sm text-gray-400">
              {t("Chờ tạo")}
            </div>
          </div>
        </section>

        {/* Structure */}
        <section>
          <div className="text-10 font-bold tracking-wider text-gray-400 uppercase mb-3">
            {t("Cấu trúc Cảnh quay")}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t("Tiêu đề")}>
              <input
                value={scene.title || ""}
                onChange={(e) => onChange({ title: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label={t("Cỡ cảnh")}>
              <input
                value={scene.shotSize || ""}
                onChange={(e) => onChange({ shotSize: e.target.value })}
                className={inputClass}
                placeholder={t("Toàn cảnh / Trung cảnh...")}
              />
            </Field>
            <Field label={t("Góc máy")}>
              <input
                value={scene.cameraAngle || ""}
                onChange={(e) => onChange({ cameraAngle: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label={t("Lia máy")}>
              <input
                value={scene.cameraMovement || ""}
                onChange={(e) => onChange({ cameraMovement: e.target.value })}
                className={inputClass}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t("Gắn Nhân vật")}>
                <TagInput
                  values={scene.characterNames || []}
                  options={allCharacterNames}
                  onChange={(characterNames) => onChange({ characterNames })}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label={t("Gắn Vật phẩm")}>
                <TagInput
                  values={scene.propNames || []}
                  options={allPropNames}
                  onChange={(propNames) => onChange({ propNames })}
                />
              </Field>
            </div>
            <Field label={t("Gắn Cảnh")}>
              <input
                value={scene.sceneTag || ""}
                onChange={(e) => onChange({ sceneTag: e.target.value })}
                className={inputClass}
                placeholder={t("Chọn / nhập cảnh")}
              />
            </Field>
            <Field label={t("Địa điểm")}>
              <input
                value={scene.location || ""}
                onChange={(e) => onChange({ location: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label={t("Thời lượng (giây)")}>
              <input
                type="number"
                min={1}
                value={scene.durationSec ?? 8}
                onChange={(e) =>
                  onChange({ durationSec: Math.max(1, parseInt(e.target.value, 10) || 1) })
                }
                className={inputClass}
              />
            </Field>
          </div>
        </section>

        {/* Semantics */}
        <section>
          <div className="text-10 font-bold tracking-wider text-gray-400 uppercase mb-3">
            {t("Ngữ nghĩa")}
          </div>
          <div className="space-y-3">
            <Field label={t("Hành động")}>
              <textarea
                value={scene.action || ""}
                onChange={(e) => onChange({ action: e.target.value })}
                className={textareaClass}
                rows={3}
              />
            </Field>
            <Field label={t("Mô tả hình ảnh")}>
              <textarea
                value={scene.visualDescription || ""}
                onChange={(e) => onChange({ visualDescription: e.target.value })}
                className={textareaClass}
                rows={3}
              />
            </Field>
          </div>
        </section>

        {/* Dialogue */}
        <section>
          <Field label={t("Thoại / Kể chuyện")}>
            <textarea
              value={scene.dialogue || ""}
              onChange={(e) => onChange({ dialogue: e.target.value })}
              className={textareaClass}
              rows={2}
              placeholder={t("Tên nhân vật: lời thoại...")}
            />
          </Field>
        </section>

        {/* Prompts */}
        <section className="rounded-2xl border border-gray-100 p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold text-gray-800">{t("Prompt")}</div>
            <span className="text-10 text-gray-400">
              {t("Cho ảnh, video, nhạc, âm thanh")}
            </span>
          </div>
          <div className="space-y-3">
            <Field label={t("Prompt ảnh")}>
              <textarea
                value={scene.imagePrompt || ""}
                onChange={(e) => onChange({ imagePrompt: e.target.value })}
                className={textareaClass}
                rows={3}
                placeholder="Wide shot, daylight..."
              />
            </Field>
            <Field label={t("Prompt video")}>
              <textarea
                value={scene.videoPrompt || ""}
                onChange={(e) => onChange({ videoPrompt: e.target.value })}
                className={textareaClass}
                rows={4}
                placeholder="[MOTION] ... [AUDIO] ..."
              />
            </Field>
            <Field label={t("Prompt âm thanh")}>
              <textarea
                value={scene.audioPrompt || ""}
                onChange={(e) => onChange({ audioPrompt: e.target.value })}
                className={textareaClass}
                rows={2}
                placeholder="Wind and footsteps..."
              />
            </Field>
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
