import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiPlus, HiRefresh } from "react-icons/hi";
import { useAlert } from "../../lib/providers/alert-provider";
import { Button } from "../shared/utilities/form";
import type { FilmAttachOption } from "./film-attach-fields";
import { withSyncedDialogueLines } from "./film-dialogue";
import {
  hydrateScenesImagePrompts,
  resolveFilmSceneImagePrompt,
  syncFilmPromptShotStructure,
  withBuiltSceneImagePrompt,
} from "./film-scene-image-prompt";
import {
  hydrateScenesAudioPrompts,
  hydrateScenesVideoPrompts,
  resolveFilmSceneAudioPrompt,
  resolveFilmSceneVideoPrompt,
  withBuiltSceneAudioPrompt,
  withBuiltSceneVideoPrompt,
} from "./film-scene-video-prompt";
import {
  FilmCharacterRecord,
  FilmEpisodeRecord,
  FilmPropRecord,
  FilmSceneImageRecord,
  FilmSceneRecord,
  buildStoryboardScenesFromContent,
  createFilmId,
  filmCharacterLinkedToEpisode,
  filmLocationLinkedToEpisode,
  filmPropLinkedToEpisode,
  filmScenesTotalDuration,
} from "./film-types";
import { isFilmCreateVideoScene } from "./film-studio-timeline";
import FilmStoryboardSceneDetail from "./film-storyboard-scene-detail";
import FilmStoryboardSceneList from "./film-storyboard-scene-list";
import { getFilmSceneLocationNames } from "./film-attachment-validate";

export type FilmStoryboardTab = "storyboard" | "voice" | "shot_images" | "create_video";

type Props = {
  projectId: string;
  episode: FilmEpisodeRecord | null;
  scenes: FilmSceneRecord[];
  characters?: FilmCharacterRecord[];
  props?: FilmPropRecord[];
  sceneImages?: FilmSceneImageRecord[];
  /** Style prompt chung từ Setting — gắn thêm vào Prompt ảnh */
  storyboardImagePromptStyle?: string | null;
  /** Style prompt chung từ Setting — gắn thêm vào Prompt video */
  storyboardVideoPromptStyle?: string | null;
  /** Style prompt chung từ Setting — gắn thêm vào Prompt âm thanh */
  storyboardAudioPromptStyle?: string | null;
  onScenesChange: (scenes: FilmSceneRecord[]) => void;
  onSaveScene: (scene: FilmSceneRecord) => Promise<void>;
  onReplaceScenes: (scenes: FilmSceneRecord[]) => Promise<void>;
  onAddScene: () => Promise<void>;
  /** Gắn tên mới → tạo entity trên tab production tương ứng */
  onEnsureCharacters?: (names: string[]) => Promise<void>;
  onEnsureProps?: (names: string[]) => Promise<void>;
  onEnsureLocations?: (names: string[]) => Promise<void>;
  onTabNavigate?: (tab: FilmStoryboardTab) => void;
  /** Chọn phân cảnh khi vào từ tab Ảnh Cảnh quay (click tiêu đề) */
  focusSceneId?: string | null;
  /** Icon gắn → mở card ảnh production (NV / VP / Bối cảnh) */
  onOpenAttachEntity?: (
    kind: "character" | "prop" | "location",
    option: FilmAttachOption
  ) => void;
};

const TABS: { id: FilmStoryboardTab; label: string }[] = [
  { id: "storyboard", label: "Tạo Chuỗi phân cảnh" },
  { id: "voice", label: "Tạo Giọng" },
  { id: "shot_images", label: "Ảnh Cảnh quay" },
  { id: "create_video", label: "Tạo video" },
];

export default function FilmStoryboardPanel({
  projectId,
  episode,
  scenes,
  characters = [],
  props = [],
  sceneImages = [],
  storyboardImagePromptStyle,
  storyboardVideoPromptStyle,
  storyboardAudioPromptStyle,
  onScenesChange,
  onSaveScene,
  onReplaceScenes,
  onAddScene,
  onEnsureCharacters,
  onEnsureProps,
  onEnsureLocations,
  onTabNavigate,
  focusSceneId = null,
  onOpenAttachEntity,
}: Props) {
  const { t } = useTranslation();
  const alert = useAlert();
  const [tab, setTab] = useState<FilmStoryboardTab>("storyboard");
  const [selectedId, setSelectedId] = useState<string | null>(
    () => focusSceneId || null
  );
  /** User đã chọn scene khác — bỏ ưu tiên focusSceneId */
  const [userPickedSelection, setUserPickedSelection] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /** Chỉ hiện phân cảnh gốc — ẩn clip cắt/chèn từ Studio */
  const storyboardScenes = useMemo(
    () => scenes.filter(isFilmCreateVideoScene),
    [scenes]
  );

  useEffect(() => {
    if (!storyboardScenes.length) {
      setSelectedId(null);
      return;
    }
    if (
      !userPickedSelection &&
      focusSceneId &&
      storyboardScenes.some((s) => s.id === focusSceneId)
    ) {
      setSelectedId(focusSceneId);
      return;
    }
    if (!selectedId || !storyboardScenes.find((s) => s.id === selectedId)) {
      setSelectedId(storyboardScenes[0].id);
    }
  }, [storyboardScenes, selectedId, focusSceneId, userPickedSelection]);

  const handleSelectScene = (id: string) => {
    setUserPickedSelection(true);
    setSelectedId(id);
  };

  /** Scene cũ: imagePrompt / videoPrompt rỗng dù đã có field nguồn → ghép & ghi IDB. */
  useEffect(() => {
    if (!scenes.length) return;

    const imageHydrated = hydrateScenesImagePrompts(
      scenes,
      storyboardImagePromptStyle
    );
    const videoHydrated = hydrateScenesVideoPrompts(
      imageHydrated.scenes,
      storyboardVideoPromptStyle
    );
    const audioHydrated = hydrateScenesAudioPrompts(
      videoHydrated.scenes,
      storyboardAudioPromptStyle
    );

    const changedIds = new Set([
      ...imageHydrated.changed.map((s) => s.id),
      ...videoHydrated.changed.map((s) => s.id),
      ...audioHydrated.changed.map((s) => s.id),
    ]);
    if (!changedIds.size) return;

    onScenesChange(audioHydrated.scenes);
    void (async () => {
      for (const s of audioHydrated.scenes) {
        if (!changedIds.has(s.id)) continue;
        try {
          await onSaveScene(s);
        } catch (err) {
          console.error("[FilmStoryboard] prompt hydrate failed:", err);
        }
      }
    })();
  }, [
    // fingerprint gồm nguồn + prompt để sync lại khi sửa field / load scene cũ
    scenes
      .map(
        (s) =>
          `${s.id}|${s.shotSize || ""}|${s.cameraAngle || ""}|${s.cameraMovement || ""}|${s.visualDescription || ""}|${s.atmosphere || ""}|${s.action || ""}|${s.dialogue || ""}|${s.motionPrompt || ""}|${s.audioAmbience || ""}|${s.sfx || ""}|${s.music || ""}|${s.voiceDirection || ""}|${s.imagePrompt || ""}|${s.videoPrompt || ""}|${s.audioPrompt || ""}`
      )
      .join(";;"),
    storyboardImagePromptStyle,
    storyboardVideoPromptStyle,
    storyboardAudioPromptStyle,
    episode?.id,
  ]);

  const selected = useMemo(
    () => storyboardScenes.find((s) => s.id === selectedId) || null,
    [storyboardScenes, selectedId]
  );

  /** Luôn hiện bản ghép từ field (không để textarea trống nếu đã có nguồn). */
  const selectedForDetail = useMemo(() => {
    if (!selected) return null;
    const imagePrompt = resolveFilmSceneImagePrompt(
      selected,
      storyboardImagePromptStyle
    );
    const videoPrompt = resolveFilmSceneVideoPrompt(
      selected,
      storyboardVideoPromptStyle
    );
    const audioPrompt = resolveFilmSceneAudioPrompt(
      selected,
      storyboardAudioPromptStyle
    );
    return {
      ...selected,
      imagePrompt: selected.imagePromptCustom
        ? selected.imagePrompt || ""
        : imagePrompt,
      videoPrompt: selected.videoPromptCustom
        ? selected.videoPrompt || ""
        : videoPrompt,
      audioPrompt: selected.audioPromptCustom
        ? selected.audioPrompt || ""
        : audioPrompt,
    };
  }, [
    selected,
    storyboardImagePromptStyle,
    storyboardVideoPromptStyle,
    storyboardAudioPromptStyle,
  ]);

  const imagePromptDefault = selected
    ? resolveFilmSceneImagePrompt(selected, storyboardImagePromptStyle)
    : "";
  const videoPromptDefault = selected
    ? resolveFilmSceneVideoPrompt(selected, storyboardVideoPromptStyle)
    : "";
  const audioPromptDefault = selected
    ? resolveFilmSceneAudioPrompt(selected, storyboardAudioPromptStyle)
    : "";

  const totalDuration = useMemo(
    () => filmScenesTotalDuration(storyboardScenes),
    [storyboardScenes]
  );

  const characterOptions: FilmAttachOption[] = useMemo(() => {
    const episodeId = episode?.id;
    return characters
      .filter((c) => filmCharacterLinkedToEpisode(c, episodeId))
      .map((c) => ({
        id: c.id,
        name: c.name,
        imageBlob: c.imageBlob,
        imageUrl: c.imageUrl,
        imageUrls: c.imageUrls,
      }));
  }, [characters, episode?.id]);

  const propOptions: FilmAttachOption[] = useMemo(() => {
    const episodeId = episode?.id;
    return props
      .filter((p) => filmPropLinkedToEpisode(p, episodeId))
      .map((p) => ({
        id: p.id,
        name: p.name,
        imageBlob: p.imageBlob,
        imageUrl: p.imageUrl,
        imageUrls: p.imageUrls,
      }));
  }, [props, episode?.id]);

  const sceneLocationOptions: FilmAttachOption[] = useMemo(() => {
    const episodeId = episode?.id;
    return sceneImages
      .filter((s) => filmLocationLinkedToEpisode(s, episodeId))
      .map((s) => ({
        id: s.id,
        name: s.name,
        imageBlob: s.imageBlob,
        imageUrl: s.imageUrl,
        imageUrls: s.imageUrls,
      }));
  }, [sceneImages, episode?.id]);

  const handleTab = (id: FilmStoryboardTab) => {
    setTab(id);
    if (id !== "storyboard" && onTabNavigate) onTabNavigate(id);
  };

  const handlePatch = async (patch: Partial<FilmSceneRecord>) => {
    if (!selected) return;

    const preview = { ...selected, ...patch };
    const attachTouched =
      patch.characterNames !== undefined ||
      patch.propNames !== undefined ||
      patch.locationNames !== undefined ||
      patch.sceneTag !== undefined ||
      patch.location !== undefined;
    if (attachTouched) {
      if (onEnsureCharacters) {
        await onEnsureCharacters(preview.characterNames || []);
      }
      if (onEnsureProps) {
        await onEnsureProps(preview.propNames || []);
      }
      if (onEnsureLocations) {
        await onEnsureLocations(getFilmSceneLocationNames(preview));
      }
    }

    const merged = withSyncedDialogueLines({
      ...selected,
      ...patch,
      updatedAt: new Date().toISOString(),
    });

    // Prompt ảnh: luôn ghép lại từ field nguồn (trừ khi user sửa tay Prompt ảnh).
    // Prompt video: ghép từ Cỡ cảnh / Góc máy / Lia máy / Thoại (trừ sửa tay Prompt video).
    const onlyManualImagePrompt =
      patch.imagePrompt !== undefined &&
      patch.action === undefined &&
      patch.visualDescription === undefined &&
      patch.atmosphere === undefined &&
      patch.shotSize === undefined &&
      patch.cameraAngle === undefined &&
      patch.summary === undefined;

    const onlyManualVideoPrompt =
      patch.videoPrompt !== undefined &&
      patch.shotSize === undefined &&
      patch.cameraAngle === undefined &&
      patch.cameraMovement === undefined &&
      patch.dialogue === undefined &&
      patch.motionPrompt === undefined &&
      patch.audioAmbience === undefined &&
      patch.sfx === undefined &&
      patch.music === undefined &&
      patch.voiceDirection === undefined;

    const onlyManualAudioPrompt =
      patch.audioPrompt !== undefined &&
      patch.audioAmbience === undefined &&
      patch.sfx === undefined &&
      patch.music === undefined &&
      patch.voiceDirection === undefined;

    let next = merged;
    if (!onlyManualImagePrompt) {
      next = withBuiltSceneImagePrompt(next, storyboardImagePromptStyle);
    }
    if (!onlyManualVideoPrompt) {
      next = withBuiltSceneVideoPrompt(next, storyboardVideoPromptStyle);
    }
    if (!onlyManualAudioPrompt) {
      next = withBuiltSceneAudioPrompt(next, storyboardAudioPromptStyle);
    }

    const shotStructureChanged =
      patch.shotSize !== undefined ||
      patch.cameraAngle !== undefined ||
      patch.cameraMovement !== undefined;
    if (shotStructureChanged) {
      if (next.imagePromptCustom) {
        next = {
          ...next,
          imagePrompt: syncFilmPromptShotStructure(next.imagePrompt || "", next, [
            "Cỡ cảnh",
            "Góc máy",
          ]),
        };
      }
      if (next.videoPromptCustom) {
        next = {
          ...next,
          videoPrompt: syncFilmPromptShotStructure(next.videoPrompt || "", next, [
            "Cỡ cảnh",
            "Góc máy",
            "Lia máy",
          ]),
        };
      }
    }

    onScenesChange(scenes.map((s) => (s.id === next.id ? next : s)));
    await onSaveScene(next);
  };

  const handleRecreate = async () => {
    if (!episode || busy) return;
    setBusy(true);
    try {
      const content = episode.originalContent || "";
      const generated = buildStoryboardScenesFromContent(
        projectId,
        episode,
        content,
        episode.sceneCount || undefined
      );
      await onReplaceScenes(generated);
      if (generated[0]) setSelectedId(generated[0].id);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteScene = async (scene: FilmSceneRecord) => {
    if (busy || deletingId) return;
    const title =
      scene.title?.trim() ||
      scene.summary?.trim() ||
      `${t("Cảnh quay")} #${scene.index}`;
    const ok = alert.danger
      ? await alert.danger(
          t("Xóa phân cảnh"),
          t(
            "Xóa “{{name}}” khỏi chuỗi phân cảnh? Thao tác không hoàn tác.",
            { name: title }
          ),
          t("Xóa")
        )
      : window.confirm(
          t("Xóa “{{name}}” khỏi chuỗi phân cảnh?", { name: title })
        );
    if (!ok) return;

    setDeletingId(scene.id);
    setBusy(true);
    try {
      // Giữ nguyên clip Studio (studioDerived) — chỉ bỏ phân cảnh gốc
      const remaining = scenes.filter((s) => s.id !== scene.id);
      await onReplaceScenes(remaining);
      const nextStoryboard = remaining.filter(isFilmCreateVideoScene);
      if (selectedId === scene.id) {
        setSelectedId(nextStoryboard[0]?.id || null);
        setUserPickedSelection(true);
      }
    } finally {
      setDeletingId(null);
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-1 flex-wrap">
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTab(item.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-0 cursor-pointer transition-colors ${
                  active
                    ? "bg-white text-gray-900 shadow-sm"
                    : "bg-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {active && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                {t(item.label)}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {storyboardScenes.length} {t("Cảnh quay")} - {totalDuration}s
          </span>
          <Button
            outline
            small
            text={t("Thêm")}
            icon={<HiPlus />}
            className="!rounded-lg"
            onClick={() => onAddScene()}
            disabled={!episode || busy}
          />
          <Button
            outline
            small
            text={t("Tạo lại")}
            icon={<HiRefresh />}
            className="!rounded-lg"
            onClick={handleRecreate}
            isLoading={busy}
            disabled={!episode}
          />
        </div>
      </div>

      {tab !== "storyboard" ? (
        <div className="flex-1 min-h-sm bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center px-6">
          <p className="text-base font-semibold text-gray-700 m-0">
            {t("Tính năng đang phát triển")}
          </p>
          <p className="text-sm text-gray-400 mt-2 m-0">
            {t("Tab này sẽ sớm được hỗ trợ trong quy trình sản xuất.")}
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3">
          <div className="w-full lg:w-80 flex-shrink-0 min-h-sm lg:min-h-0 lg:max-h-screen">
            <FilmStoryboardSceneList
              scenes={storyboardScenes}
              selectedId={selectedId}
              totalDurationSec={totalDuration}
              onSelect={handleSelectScene}
              onDelete={handleDeleteScene}
              deletingId={deletingId}
            />
          </div>
          <div className="flex-1 min-w-0 min-h-md lg:min-h-0 lg:max-h-screen">
            <FilmStoryboardSceneDetail
              scene={selectedForDetail}
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
        </div>
      )}
    </div>
  );
}

export function createEmptyFilmScene(
  projectId: string,
  episodeId: string,
  index: number
): FilmSceneRecord {
  const now = new Date().toISOString();
  return {
    id: createFilmId("sc"),
    projectId,
    episodeId,
    index,
    title: `Cảnh quay #${index}`,
    summary: "",
    shotSize: "Toàn cảnh",
    cameraAngle: "",
    cameraMovement: "",
    location: "",
    durationSec: 8,
    characterNames: [],
    propNames: [],
    locationNames: [],
    sceneTag: "",
    action: "",
    visualDescription: "",
    atmosphere: "",
    dialogue: "",
    dialogueLines: [],
    imagePrompt: "",
    videoPrompt: "",
    audioPrompt: "",
    mediaStatus: "pending",
    frameStatus: "pending",
    frameImageUrl: "",
    videoStatus: "pending",
    videoUrl: "",
    voiceStatus: "pending",
    voiceUrl: "",
    speakerName: "",
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}
