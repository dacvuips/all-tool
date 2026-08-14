import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiOutlineAnnotation,
  HiOutlineGlobe,
  HiOutlineFilm,
  HiOutlinePhotograph,
  HiRefresh,
} from "react-icons/hi";
import { RiKey2Line, RiLoader4Line } from "react-icons/ri";
import { useToast } from "../../lib/providers/toast-provider";
import { Button } from "../shared/utilities/form";
import type { FilmAiKeysStatus } from "./film-ai-keys";
import {
  FILM_CHARACTER_IMAGE_PROMPT_TEMPLATE,
  resolveFilmCharacterImagePromptTemplate,
} from "./film-character-image-prompt";
import {
  getFilmOutputLanguage,
  getFilmSystemInstruction,
  initFilmDB,
  setFilmOutputLanguage,
  setFilmSystemInstruction,
  updateFilmProject,
  updateFilmProjectImagePromptTemplates,
  updateFilmProjectStoryboardPrompts,
} from "./film-idb";
import {
  FILM_LOCATION_IMAGE_PROMPT_TEMPLATE,
  resolveFilmLocationImagePromptTemplate,
} from "./film-location-image-prompt";
import {
  FILM_PROP_IMAGE_PROMPT_TEMPLATE,
  resolveFilmPropImagePromptTemplate,
} from "./film-prop-image-prompt";
import FilmProjectSettingsFields, {
  filmProjectSettingsFormFromProject,
  filmProjectSettingsFormToInput,
  useFilmArtStyleOptions,
  type FilmProjectSettingsFormState,
} from "./film-project-settings-fields";
import {
  FILM_DEFAULT_LANGUAGE,
  FILM_DEFAULT_SYSTEM_INSTRUCTION,
  FILM_LANGUAGE_OPTIONS,
  isFilmLanguageValue,
  type FilmLanguageValue,
} from "./film-screenplay-system-instruction";
import type { FilmProjectRecord, FilmSceneRecord } from "./film-types";

type Props = {
  project: FilmProjectRecord;
  onProjectUpdated: (project: FilmProjectRecord) => void;
  /** Sau khi ghi prompt storyboard sang scene — refresh list workspace */
  onScenesUpdated?: (scenes: FilmSceneRecord[]) => void;
  aiKeysStatus: FilmAiKeysStatus;
  onOpenApiKey: () => void;
};

type PromptTemplateDraft = {
  character: string;
  prop: string;
  location: string;
};

type StoryboardPromptDraft = {
  image: string;
  video: string;
  audio: string;
};

function draftsFromProject(project: FilmProjectRecord): PromptTemplateDraft {
  return {
    character: resolveFilmCharacterImagePromptTemplate(project.characterImagePromptTemplate),
    prop: resolveFilmPropImagePromptTemplate(project.propImagePromptTemplate),
    location: resolveFilmLocationImagePromptTemplate(project.locationImagePromptTemplate),
  };
}

function storyboardDraftsFromProject(project: FilmProjectRecord): StoryboardPromptDraft {
  return {
    image: project.storyboardImagePrompt || "",
    video: project.storyboardVideoPrompt || "",
    audio: project.storyboardAudioPrompt || "",
  };
}

export default function FilmSettingsPanel({
  project,
  onProjectUpdated,
  onScenesUpdated,
  aiKeysStatus,
  onOpenApiKey,
}: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const artStyleOptions = useFilmArtStyleOptions();

  const [projectForm, setProjectForm] = useState<FilmProjectSettingsFormState>(() =>
    filmProjectSettingsFormFromProject(project)
  );
  const [savedProjectForm, setSavedProjectForm] = useState<FilmProjectSettingsFormState>(() =>
    filmProjectSettingsFormFromProject(project)
  );
  const [projectNameError, setProjectNameError] = useState("");
  const [savingProject, setSavingProject] = useState(false);

  const [promptDraft, setPromptDraft] = useState<PromptTemplateDraft>(() =>
    draftsFromProject(project)
  );
  const [savedPromptDraft, setSavedPromptDraft] = useState<PromptTemplateDraft>(() =>
    draftsFromProject(project)
  );
  const [savingPrompts, setSavingPrompts] = useState(false);

  const [storyboardPromptDraft, setStoryboardPromptDraft] = useState<StoryboardPromptDraft>(() =>
    storyboardDraftsFromProject(project)
  );
  const [savedStoryboardPromptDraft, setSavedStoryboardPromptDraft] =
    useState<StoryboardPromptDraft>(() => storyboardDraftsFromProject(project));
  const [savingStoryboardPrompts, setSavingStoryboardPrompts] = useState(false);

  const [systemInstruction, setSystemInstruction] = useState("");
  const [savedInstruction, setSavedInstruction] = useState("");
  const [language, setLanguage] = useState<FilmLanguageValue>(FILM_DEFAULT_LANGUAGE);
  const [savedLanguage, setSavedLanguage] = useState<FilmLanguageValue>(FILM_DEFAULT_LANGUAGE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingLanguage, setSavingLanguage] = useState(false);

  // Sync form khi project đổi (id hoặc reload)
  useEffect(() => {
    const next = filmProjectSettingsFormFromProject(project);
    setProjectForm(next);
    setSavedProjectForm(next);
    setProjectNameError("");
    const prompts = draftsFromProject(project);
    setPromptDraft(prompts);
    setSavedPromptDraft(prompts);
    const sb = storyboardDraftsFromProject(project);
    setStoryboardPromptDraft(sb);
    setSavedStoryboardPromptDraft(sb);
  }, [project.id, project.updatedAt]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      await initFilmDB();
      const [instruction, lang] = await Promise.all([
        getFilmSystemInstruction(),
        getFilmOutputLanguage(),
      ]);
      setSystemInstruction(instruction);
      setSavedInstruction(instruction);
      setLanguage(lang);
      setSavedLanguage(lang);
    } catch (err) {
      console.error("[Film] load settings failed", err);
      setSystemInstruction(FILM_DEFAULT_SYSTEM_INSTRUCTION);
      setSavedInstruction(FILM_DEFAULT_SYSTEM_INSTRUCTION);
      setLanguage(FILM_DEFAULT_LANGUAGE);
      setSavedLanguage(FILM_DEFAULT_LANGUAGE);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const dirtyProject = useMemo(
    () => JSON.stringify(projectForm) !== JSON.stringify(savedProjectForm),
    [projectForm, savedProjectForm]
  );
  const dirtyPrompts = useMemo(
    () => JSON.stringify(promptDraft) !== JSON.stringify(savedPromptDraft),
    [promptDraft, savedPromptDraft]
  );
  const dirtyStoryboardPrompts = useMemo(
    () =>
      JSON.stringify(storyboardPromptDraft) !== JSON.stringify(savedStoryboardPromptDraft),
    [storyboardPromptDraft, savedStoryboardPromptDraft]
  );
  const dirtyInstruction = systemInstruction !== savedInstruction;
  const dirtyLanguage = language !== savedLanguage;
  const isDefault = systemInstruction.trim() === FILM_DEFAULT_SYSTEM_INSTRUCTION.trim();
  const hasAnyAi = aiKeysStatus.hasAnyAi;

  const isCharacterDefault =
    promptDraft.character.trim() === FILM_CHARACTER_IMAGE_PROMPT_TEMPLATE.trim();
  const isPropDefault = promptDraft.prop.trim() === FILM_PROP_IMAGE_PROMPT_TEMPLATE.trim();
  const isLocationDefault =
    promptDraft.location.trim() === FILM_LOCATION_IMAGE_PROMPT_TEMPLATE.trim();

  const handleSaveProject = async () => {
    const result = filmProjectSettingsFormToInput(projectForm, artStyleOptions);
    if ("error" in result) {
      setProjectNameError(t(result.error));
      return;
    }
    setProjectNameError("");
    setSavingProject(true);
    try {
      const updated = await updateFilmProject(project.id, result);
      onProjectUpdated(updated);
      const next = filmProjectSettingsFormFromProject(updated);
      setProjectForm(next);
      setSavedProjectForm(next);
      toast.success(t("Đã lưu cài đặt dự án."));
    } catch (err: any) {
      toast.error(err?.message || t("Không lưu được cài đặt dự án."));
    } finally {
      setSavingProject(false);
    }
  };

  const handleSavePrompts = async () => {
    if (!promptDraft.character.trim() || !promptDraft.prop.trim() || !promptDraft.location.trim()) {
      toast.warn(t("Prompt mẫu không được để trống."));
      return;
    }
    setSavingPrompts(true);
    try {
      const updated = await updateFilmProjectImagePromptTemplates(
        project.id,
        {
          characterImagePromptTemplate: promptDraft.character,
          propImagePromptTemplate: promptDraft.prop,
          locationImagePromptTemplate: promptDraft.location,
        },
        {
          character: FILM_CHARACTER_IMAGE_PROMPT_TEMPLATE,
          prop: FILM_PROP_IMAGE_PROMPT_TEMPLATE,
          location: FILM_LOCATION_IMAGE_PROMPT_TEMPLATE,
        }
      );
      onProjectUpdated(updated);
      const next = draftsFromProject(updated);
      setPromptDraft(next);
      setSavedPromptDraft(next);
      toast.success(t("Đã lưu prompt mẫu ảnh."));
    } catch (err: any) {
      toast.error(err?.message || t("Không lưu được prompt mẫu."));
    } finally {
      setSavingPrompts(false);
    }
  };

  const handleSaveStoryboardPrompts = async () => {
    setSavingStoryboardPrompts(true);
    try {
      const { project: updated, updatedScenes } = await updateFilmProjectStoryboardPrompts(
        project.id,
        {
          storyboardImagePrompt: storyboardPromptDraft.image,
          storyboardVideoPrompt: storyboardPromptDraft.video,
          storyboardAudioPrompt: storyboardPromptDraft.audio,
        }
      );
      onProjectUpdated(updated);
      if (updatedScenes.length) {
        onScenesUpdated?.(updatedScenes);
      }
      const next = storyboardDraftsFromProject(updated);
      setStoryboardPromptDraft(next);
      setSavedStoryboardPromptDraft(next);
      if (updatedScenes.length) {
        toast.success(
          t("Đã lưu và áp dụng prompt Chuỗi Cảnh quay cho {{count}} phân cảnh.", {
            count: updatedScenes.length,
          })
        );
      } else {
        toast.success(t("Đã lưu prompt Chuỗi Cảnh quay chung."));
      }
    } catch (err: any) {
      toast.error(err?.message || t("Không lưu được prompt Chuỗi Cảnh quay."));
    } finally {
      setSavingStoryboardPrompts(false);
    }
  };

  const handleLanguageChange = async (value: string) => {
    if (!isFilmLanguageValue(value)) return;
    setLanguage(value);
    setSavingLanguage(true);
    try {
      const saved = await setFilmOutputLanguage(value);
      setLanguage(saved);
      setSavedLanguage(saved);
      toast.success(t("Đã lưu ngôn ngữ."));
    } catch (err: any) {
      toast.error(err?.message || t("Không lưu được ngôn ngữ."));
      setLanguage(savedLanguage);
    } finally {
      setSavingLanguage(false);
    }
  };

  const handleSave = async () => {
    const next = systemInstruction.trim();
    if (!next) {
      toast.warn(t("systemInstruction không được để trống."));
      return;
    }
    setSaving(true);
    try {
      await setFilmSystemInstruction(next);
      setSystemInstruction(next);
      setSavedInstruction(next);
      toast.success(t("Đã lưu systemInstruction."));
    } catch (err: any) {
      toast.error(err?.message || t("Không lưu được systemInstruction."));
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefault = () => {
    setSystemInstruction(FILM_DEFAULT_SYSTEM_INSTRUCTION);
  };

  const renderPromptField = (opts: {
    id: keyof PromptTemplateDraft;
    title: string;
    placeholders: string;
    defaultTemplate: string;
    isDefault: boolean;
  }) => (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="m-0 text-sm font-semibold text-gray-800">{opts.title}</h4>
        {opts.isDefault && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-10 font-semibold bg-gray-50 text-gray-500 border border-gray-100">
            {t("Mẫu mặc định")}
          </span>
        )}
      </div>
      <p className="m-0 text-10 text-gray-400 font-mono">{opts.placeholders}</p>
      <textarea
        value={promptDraft[opts.id]}
        onChange={(e) =>
          setPromptDraft((prev) => ({ ...prev, [opts.id]: e.target.value }))
        }
        rows={10}
        spellCheck={false}
        disabled={savingPrompts}
        className="w-full min-h-[180px] px-3 py-2.5 text-xs sm:text-sm font-mono leading-relaxed text-gray-800 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-400 focus:bg-white resize-y disabled:opacity-60"
        placeholder={t("Nhập prompt mẫu...")}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-10 text-gray-400">
          {promptDraft[opts.id].length.toLocaleString()} {t("ký tự")}
        </p>
        <Button
          outline
          small
          text={t("Khôi phục mẫu")}
          icon={<HiRefresh />}
          className="!rounded-lg"
          disabled={opts.isDefault || savingPrompts}
          onClick={() =>
            setPromptDraft((prev) => ({ ...prev, [opts.id]: opts.defaultTemplate }))
          }
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="m-0 text-lg font-bold text-gray-900">{t("Setting")}</h2>
          <p className="m-0 mt-1 text-sm text-gray-500">
            {t(
              "Cấu hình dự án, prompt Chuỗi Cảnh quay chung, prompt mẫu ảnh, API Keys, ngôn ngữ và systemInstruction."
            )}
          </p>
        </div>
        <Button
          outline
          small
          success={hasAnyAi}
          gray={!hasAnyAi}
          text={t("API Key")}
          icon={<RiKey2Line className="text-lg" />}
          className="!rounded-lg px-2.5 flex-shrink-0"
          asyncLoading={false}
          tooltip={
            hasAnyAi
              ? (t("API Key đã sẵn sàng — bấm để quản lý") as string)
              : (t("Thêm API Key") as string)
          }
          onClick={onOpenApiKey}
        />
      </div>

      {/* ── Project metadata (same fields as create dialog) ── */}
      <section className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <HiOutlineFilm className="text-xl text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="m-0 text-sm font-bold text-gray-800">{t("Thông tin dự án")}</h3>
              {dirtyProject && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-10 font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                  {t("Chưa lưu")}
                </span>
              )}
            </div>
            <p className="m-0 mt-1 text-xs text-gray-500 leading-relaxed">
              {t(
                "Tên, số tập, phong cách, tỉ lệ khung hình và ngôi kể — giống form khi tạo dự án. Ảnh bối cảnh / shot theo tỉ lệ này."
              )}
            </p>
          </div>
        </div>

        <FilmProjectSettingsFields
          form={projectForm}
          onChange={(patch) => {
            setProjectForm((prev) => ({ ...prev, ...patch }));
            if (projectNameError) setProjectNameError("");
          }}
          nameError={projectNameError}
          disabled={savingProject}
        />

        <div className="flex justify-end">
          <Button
            primary
            small
            text={savingProject ? t("Đang lưu...") : t("Lưu cài đặt dự án")}
            className="!rounded-lg !bg-blue-600 hover:!bg-blue-700"
            disabled={!dirtyProject || savingProject}
            isLoading={savingProject}
            onClick={() => void handleSaveProject()}
          />
        </div>
      </section>

      {/* ── Storyboard prompts (global → all scenes) ── */}
      <section className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
            <HiOutlineFilm className="text-xl text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="m-0 text-sm font-bold text-gray-800">{t("Prompt Chuỗi Cảnh quay")}</h3>
              {dirtyStoryboardPrompts && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-10 font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                  {t("Chưa lưu")}
                </span>
              )}
            </div>
            <p className="m-0 mt-1 text-xs text-gray-500 leading-relaxed">
              {t(
                "Cấu hình chung: Prompt ảnh gắn thêm sau phần ghép từ Cỡ cảnh / Góc máy / Hình ảnh / Không khí / Hành động mỗi phân cảnh. Video & âm thanh (nếu có) ghi vào mọi scene. Ảnh cảnh quay dùng Prompt ảnh + tham chiếu ảnh đã gắn."
              )}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 p-4 bg-gray-50 space-y-3">
          <div className="flex items-center justify-between mb-0.5">
            <div className="text-sm font-bold text-gray-800">{t("Prompt")}</div>
            <span className="text-10 text-gray-400">
              {t("Cho ảnh, video, nhạc, âm thanh")}
            </span>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-600">
                {t("Prompt ảnh")}
              </label>
              <textarea
                value={storyboardPromptDraft.image}
                onChange={(e) =>
                  setStoryboardPromptDraft((prev) => ({ ...prev, image: e.target.value }))
                }
                rows={3}
                disabled={savingStoryboardPrompts}
                className="w-full px-3 py-2 text-sm text-gray-800 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-400 resize-y disabled:opacity-60"
                placeholder="Wide shot, daylight..."
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-600">
                {t("Prompt video")}
              </label>
              <textarea
                value={storyboardPromptDraft.video}
                onChange={(e) =>
                  setStoryboardPromptDraft((prev) => ({ ...prev, video: e.target.value }))
                }
                rows={4}
                disabled={savingStoryboardPrompts}
                className="w-full px-3 py-2 text-sm text-gray-800 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-400 resize-y disabled:opacity-60"
                placeholder="[MOTION] ... [AUDIO] ..."
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-600">
                {t("Prompt âm thanh")}
              </label>
              <textarea
                value={storyboardPromptDraft.audio}
                onChange={(e) =>
                  setStoryboardPromptDraft((prev) => ({ ...prev, audio: e.target.value }))
                }
                rows={2}
                disabled={savingStoryboardPrompts}
                className="w-full px-3 py-2 text-sm text-gray-800 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-400 resize-y disabled:opacity-60"
                placeholder="Wind and footsteps..."
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            primary
            small
            text={
              savingStoryboardPrompts
                ? t("Đang lưu...")
                : t("Lưu & áp dụng mọi phân cảnh")
            }
            className="!rounded-lg !bg-blue-600 hover:!bg-blue-700"
            disabled={!dirtyStoryboardPrompts || savingStoryboardPrompts}
            isLoading={savingStoryboardPrompts}
            onClick={() => void handleSaveStoryboardPrompts()}
          />
        </div>
      </section>

      {/* ── Image prompt templates (per project) ── */}
      <section className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <HiOutlinePhotograph className="text-xl text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="m-0 text-sm font-bold text-gray-800">{t("Prompt mẫu ảnh")}</h3>
              {dirtyPrompts && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-10 font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                  {t("Chưa lưu")}
                </span>
              )}
            </div>
            <p className="m-0 mt-1 text-xs text-gray-500 leading-relaxed">
              {t(
                "Mẫu khi Tạo AI / Reset template / trích xuất cho Nhân vật, Vật phẩm, Bối cảnh. Placeholder thay khi build prompt."
              )}
            </p>
          </div>
        </div>

        {renderPromptField({
          id: "character",
          title: t("Nhân vật"),
          placeholders: "{name} · {description} · {clothingAccessories}",
          defaultTemplate: FILM_CHARACTER_IMAGE_PROMPT_TEMPLATE,
          isDefault: isCharacterDefault,
        })}
        {renderPromptField({
          id: "prop",
          title: t("Vật phẩm"),
          placeholders: "{name} · {description}",
          defaultTemplate: FILM_PROP_IMAGE_PROMPT_TEMPLATE,
          isDefault: isPropDefault,
        })}
        {renderPromptField({
          id: "location",
          title: t("Bối cảnh"),
          placeholders: "{name} · {timeOfDay} · {description} · {aspectRatio}",
          defaultTemplate: FILM_LOCATION_IMAGE_PROMPT_TEMPLATE,
          isDefault: isLocationDefault,
        })}

        <div className="flex justify-end pt-1">
          <Button
            primary
            small
            text={savingPrompts ? t("Đang lưu...") : t("Lưu prompt mẫu")}
            className="!rounded-lg !bg-blue-600 hover:!bg-blue-700"
            disabled={!dirtyPrompts || savingPrompts}
            isLoading={savingPrompts}
            onClick={() => void handleSavePrompts()}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <HiOutlineGlobe className="text-xl text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="m-0 text-sm font-bold text-gray-800">{t("Ngôn ngữ")}</h3>
              {dirtyLanguage && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-10 font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                  {t("Chưa lưu")}
                </span>
              )}
            </div>
            <p className="m-0 mt-1 text-xs text-gray-500 leading-relaxed">
              {t(
                "Ngôn ngữ dialogue / action trong screenplay khi AI trích xuất. Được gửi kèm API Trích xuất."
              )}
            </p>
            <div className="mt-3 max-w-xs">
              <label htmlFor="film-output-language" className="sr-only">
                {t("Ngôn ngữ")}
              </label>
              <select
                id="film-output-language"
                value={language}
                disabled={loading || savingLanguage}
                onChange={(e) => void handleLanguageChange(e.target.value)}
                className="w-full h-10 px-3 text-sm text-gray-800 bg-white border border-gray-200 rounded-lg outline-none focus:border-blue-400 disabled:opacity-60"
              >
                {FILM_LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.label)}
                  </option>
                ))}
              </select>
              {savingLanguage && (
                <p className="m-0 mt-1.5 text-10 text-gray-400 flex items-center gap-1">
                  <RiLoader4Line className="animate-spin" />
                  {t("Đang lưu...")}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <HiOutlineAnnotation className="text-xl text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="m-0 text-sm font-bold text-gray-800">systemInstruction</h3>
              {dirtyInstruction && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-10 font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                  {t("Chưa lưu")}
                </span>
              )}
              {!dirtyInstruction && isDefault && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-10 font-semibold bg-gray-50 text-gray-500 border border-gray-100">
                  {t("Mẫu mặc định")}
                </span>
              )}
            </div>
            <p className="m-0 mt-1 text-xs text-gray-500 leading-relaxed">
              {t(
                "Prompt system gửi kèm khi AI trích xuất screenplay (Gateway / OpenAI / Gemini). Áp dụng khi bấm Trích xuất ở Nội dung gốc."
              )}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400">
            <RiLoader4Line className="animate-spin text-lg" />
            {t("Đang tải...")}
          </div>
        ) : (
          <>
            <textarea
              value={systemInstruction}
              onChange={(e) => setSystemInstruction(e.target.value)}
              rows={22}
              spellCheck={false}
              className="w-full min-h-[320px] px-3 py-2.5 text-xs sm:text-sm font-mono leading-relaxed text-gray-800 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-400 focus:bg-white resize-y"
              placeholder={t("Nhập systemInstruction...")}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="m-0 text-10 text-gray-400">
                {systemInstruction.length.toLocaleString()} {t("ký tự")}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  outline
                  small
                  text={t("Khôi phục mẫu")}
                  icon={<HiRefresh />}
                  className="!rounded-lg"
                  disabled={isDefault || saving}
                  onClick={handleResetDefault}
                />
                <Button
                  primary
                  small
                  text={saving ? t("Đang lưu...") : t("Lưu")}
                  className="!rounded-lg !bg-blue-600 hover:!bg-blue-700"
                  disabled={!dirtyInstruction || saving}
                  isLoading={saving}
                  onClick={() => void handleSave()}
                />
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
