/**
 * Form fields tạo/sửa metadata dự án (reuse create dialog + Setting workspace).
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArtStyleCategoryService } from "../../lib/repo/list/artStyleCategory.repo";
import { Select } from "../shared/utilities/form";
import {
  FILM_ART_STYLE_FREE,
  FilmAspectRatio,
  FilmNarration,
  FilmProjectCreateInput,
  FilmProjectRecord,
} from "./film-types";

export type FilmProjectSettingsFormState = {
  name: string;
  episodeCount: number;
  scenesPerEpisode: string;
  artStyleId: string;
  aspectRatio: FilmAspectRatio;
  narration: FilmNarration;
};

export function emptyFilmProjectSettingsForm(): FilmProjectSettingsFormState {
  return {
    name: "",
    episodeCount: 1,
    scenesPerEpisode: "",
    artStyleId: FILM_ART_STYLE_FREE,
    aspectRatio: "16:9",
    narration: "dialogue",
  };
}

export function filmProjectSettingsFormFromProject(
  project: FilmProjectRecord
): FilmProjectSettingsFormState {
  return {
    name: project.name || "",
    episodeCount: Math.max(1, project.episodeCount || 1),
    scenesPerEpisode:
      project.scenesPerEpisode != null && project.scenesPerEpisode !== undefined
        ? String(project.scenesPerEpisode)
        : "",
    artStyleId: project.artStyleId || FILM_ART_STYLE_FREE,
    aspectRatio: project.aspectRatio === "9:16" ? "9:16" : "16:9",
    narration: project.narration === "third_person" ? "third_person" : "dialogue",
  };
}

/** Build FilmProjectCreateInput từ form + art style options labels */
export function filmProjectSettingsFormToInput(
  form: FilmProjectSettingsFormState,
  artStyleOptions: { value: string; label: string }[]
): FilmProjectCreateInput | { error: string } {
  const trimmed = form.name.trim();
  if (!trimmed) {
    return { error: "Vui lòng nhập tên dự án" };
  }
  const artStyleId = (form.artStyleId || FILM_ART_STYLE_FREE).trim();
  const style = artStyleOptions.find((o) => o.value === artStyleId);
  const scenes =
    form.scenesPerEpisode.trim() === ""
      ? undefined
      : Math.max(0, parseInt(form.scenesPerEpisode, 10) || 0);
  return {
    name: trimmed,
    episodeCount: Math.max(1, form.episodeCount || 1),
    scenesPerEpisode: scenes,
    artStyleId,
    artStyleLabel: !artStyleId ? "" : style?.label || "",
    aspectRatio: form.aspectRatio,
    narration: form.narration,
  };
}

/** Options phong cách ảnh từ collection GraphQL `artstyles` (không hardcode). */
export function useFilmArtStyleOptions() {
  const { t } = useTranslation();
  const freeOption = {
    value: FILM_ART_STYLE_FREE,
    label: t("Tự do (Không dán đè Style)"),
  };
  const [options, setOptions] = useState<{ value: string; label: string }[]>([freeOption]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // getArtStylesByCategoryId không truyền category → lấy toàn bộ artstyles active
        const result = await ArtStyleCategoryService.getArtStylesByCategoryId(
          undefined,
          1,
          1000
        );
        if (cancelled) return;
        const fromApi = (result.data || [])
          .filter((item) => !!item?.id)
          .map((item) => ({
            value: String(item.id),
            label: String(item.name || item.id).trim() || String(item.id),
          }));
        setOptions([freeOption, ...fromApi]);
      } catch (err) {
        console.error("[Film] load artstyles failed", err);
        if (!cancelled) setOptions([freeOption]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // freeOption.label phụ thuộc t()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  return options;
}

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

type Props = {
  form: FilmProjectSettingsFormState;
  onChange: (patch: Partial<FilmProjectSettingsFormState>) => void;
  nameError?: string;
  disabled?: boolean;
  /** Bỏ qua đổi số tập khi đã có data sản xuất (vẫn cho sửa UI; save metadata only) */
  compact?: boolean;
};

export default function FilmProjectSettingsFields({
  form,
  onChange,
  nameError,
  disabled = false,
}: Props) {
  const { t } = useTranslation();
  const artStyleOptions = useFilmArtStyleOptions();

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t("Tên dự án")} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.name}
          disabled={disabled}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={t("Ví dụ: Phim ngắn tình cảm Nhiệt Huyết")}
          className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-shadow disabled:opacity-60"
        />
        {nameError ? <p className="text-xs text-red-500 mt-1.5 m-0">{nameError}</p> : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t("Số tập dự kiến")}
          </label>
          <input
            type="number"
            min={1}
            disabled={disabled}
            value={form.episodeCount}
            onChange={(e) =>
              onChange({ episodeCount: Math.max(1, parseInt(e.target.value, 10) || 1) })
            }
            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-shadow disabled:opacity-60"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t("Số phân cảnh dự kiến mỗi tập")}
          </label>
          <input
            type="number"
            min={0}
            disabled={disabled}
            value={form.scenesPerEpisode}
            onChange={(e) => onChange({ scenesPerEpisode: e.target.value })}
            placeholder={t("Tự động chia (để trống)")}
            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-shadow placeholder-gray-400 disabled:opacity-60"
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
          value={form.artStyleId}
          onChange={(v: string) => onChange({ artStyleId: v ?? FILM_ART_STYLE_FREE })}
          placeholder={t("Tìm kiếm...")}
          readOnly={disabled}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t("Tỉ lệ khung hình")}
        </label>
        <div className="flex gap-3 flex-col sm:flex-row">
          <OptionCard
            selected={form.aspectRatio === "16:9"}
            title={t("Ngang (16:9)")}
            subtitle={t("Youtube, TV, PC")}
            badge="16:9"
            onClick={() => !disabled && onChange({ aspectRatio: "16:9" })}
          />
          <OptionCard
            selected={form.aspectRatio === "9:16"}
            title={t("Dọc (9:16)")}
            subtitle={t("TikTok, Reels, Shorts")}
            badge="9:16"
            onClick={() => !disabled && onChange({ aspectRatio: "9:16" })}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t("Ngôi kể")}</label>
        <div className="flex gap-3 flex-col sm:flex-row">
          <OptionCard
            selected={form.narration === "dialogue"}
            title={t("Đối thoại")}
            subtitle={t("Tự động tạo thoại của nhân vật")}
            onClick={() => !disabled && onChange({ narration: "dialogue" })}
          />
          <OptionCard
            selected={form.narration === "third_person"}
            title={t("Ngôi 3")}
            subtitle={t("Tự động tạo lời dẫn chuyện")}
            onClick={() => !disabled && onChange({ narration: "third_person" })}
          />
        </div>
      </div>
    </div>
  );
}
