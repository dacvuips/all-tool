import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiArrowLeft, HiPencil, HiPlus, HiRefresh, HiTrash } from "react-icons/hi";
import { RiKey2Line } from "react-icons/ri";
import { useAlert } from "../../lib/providers/alert-provider";
import { useAuth } from "../../lib/providers/auth-provider";
import { useGlobalContext } from "../../lib/providers/global-provider";
import { useToast } from "../../lib/providers/toast-provider";
import type { GeneratedImageData } from "../app/affiliate-video/copy-video/hook/useCopyVideoApi";
import { isVoiceAbortError } from "../app/voice/voice-api";
import {
  TrainingGuidePopover,
  TrainingTopicSlug,
} from "../shared/common/training-guide-popover";
import { Button } from "../shared/utilities/form";
import {
  applyFilmExtractResult,
  buildFilmPreviousEpisodeScenes,
  extractFilmScreenplay,
} from "./api/extract-screenplay";
import {
  cancelFilmMediaJob,
  enqueueFilmImage,
  enqueueFilmVideo,
  isFilmMediaJobWatching,
  materializeFilmImageFromJobResult,
  materializeFilmVideoFromJobResult,
  waitFilmMediaJob,
} from "./api/generate-film-media";
import { rewriteFilmShotFramePrompt } from "./api/rewrite-shot-frame-prompt";
import { suggestFilmCharacterProps } from "./api/suggest-character-props";
import { suggestFilmEntityProps } from "./api/suggest-entity-props";
import {
  EMPTY_FILM_AI_KEYS_STATUS,
  fetchFilmAiKeysStatus,
  migrateFilmAiKeysFromLocalStorage,
  type FilmAiKeysStatus,
} from "./film-ai-keys";
import FilmAiKeysDialog from "./film-ai-keys-dialog";
import {
  FILM_CHARACTER_PROP_ASPECT_RATIO,
  resolveFilmProjectAspectRatio,
} from "./film-aspect";
import {
  checkFilmSceneAttachmentsForMedia,
  collectFilmSceneAttachImageEntities,
  detachFilmSceneAttachName,
  FILM_SCENE_ATTACH_IMAGE_LIMIT,
  isFilmAttachErrorMessage,
} from "./film-attachment-validate";
import {
  type FilmCatalogKind,
  type FilmCatalogPickItem,
} from "./film-catalog-pick-dialog";
import { buildFilmCharacterImagePrompt } from "./film-character-image-prompt";
import FilmCharacterImagesPanel from "./film-character-images-panel";
import FilmCreateVideoPanel from "./film-create-video-panel";
import {
  applyCharacterVoiceLinksToScenes,
  buildAppendDialogueVoiceTakePatch,
  buildFilmVoiceListItems,
  buildSetDefaultDialogueVoiceTakePatch,
  dialogueLineCreating,
  dialogueLineHasAudio,
  dialogueLineReady,
  hydrateScenesDialogueLines,
  patchSceneDialogueLine,
  resolveDialogueLineVoiceLink,
  resolveFilmSceneVideoVoice,
  stopSceneDialogueVoice,
  stripCharacterVoiceLinksFromScenes,
  withDialogueLineOnScene,
  withSyncedDialogueLines,
  type FilmVoiceListItem,
} from "./film-dialogue";
import {
  countScenesReferencingName,
  indexFilmSceneAttachNames,
  renameEntityNameInCharacters,
  renameEntityNameInEpisodes,
  renameEntityNameInLocations,
  renameEntityNameInProject,
  renameEntityNameInProps,
  renameEntityNameInScenes,
  stripEntityNameFromScenes,
} from "./film-entity-sync";
import {
  collectFilmMediaImageRefs,
  collectFilmVideoRefSlotImageRefs,
  generatedImageDataToFilmStored,
  generatedVideoDataToFilmStored,
} from "./film-entity-to-generated-image";
import {
  addFilmEpisode,
  addFilmScene,
  deleteFilmCharacter,
  deleteFilmEpisode,
  deleteFilmProject,
  deleteFilmProp,
  deleteFilmSceneImage,
  getFilmCharactersByProject,
  getFilmEpisodesByProject,
  getFilmOutputLanguage,
  getFilmProject,
  getFilmPropsByProject,
  getFilmSceneImagesByProject,
  getFilmScenesByEpisode,
  getFilmScenesByProject,
  getFilmSystemInstruction,
  initFilmDB,
  loadOrSeedFilmStudioTimeline,
  purgeStudioArtifactsFromEpisodeScenes,
  putFilmCharacter,
  putFilmEpisode,
  putFilmProject,
  putFilmProp,
  putFilmScene,
  putFilmSceneImage,
  putFilmStudioTimeline,
  replaceFilmCharactersForProject,
  replaceFilmPropsForProject,
  replaceFilmSceneImagesForProject,
  replaceFilmScenesForEpisode,
  saveFilmEpisodeOriginalContent,
} from "./film-idb";
import type { FilmLocationImageGenerateInput } from "./film-location-image-dialog";
import { buildFilmLocationImagePrompt } from "./film-location-image-prompt";
import FilmOriginalContentPanel from "./film-original-content-panel";
import type { FilmPropImageGenerateInput } from "./film-prop-image-dialog";
import { buildFilmPropImagePrompt } from "./film-prop-image-prompt";
import FilmPropsPanel from "./film-props-panel";
import {
  appendFilmSingleFrameImageConstraint,
  buildFilmSceneImagePrompt,
  hydrateScenesImagePrompts,
  withBuiltSceneImagePrompt,
} from "./film-scene-image-prompt";
import FilmSceneImagesPanel from "./film-scene-images-panel";
import {
  buildFilmSceneAudioPrompt,
  buildFilmSceneVideoPrompt,
  hydrateScenesAudioPrompts,
  hydrateScenesVideoPrompts,
  resolveFilmSceneVideoPrompt,
  withBuiltSceneAudioPrompt,
  withBuiltSceneVideoPrompt,
} from "./film-scene-video-prompt";
import { FILM_DEFAULT_SYSTEM_INSTRUCTION } from "./film-screenplay-system-instruction";
import FilmSettingsPanel from "./film-settings-panel";
import type { FilmShotFrameGenerateInput } from "./film-shot-frame-dialog";
import {
  resolveFilmShotFrameActivePrompt
} from "./film-shot-frame-dialog";
import {
  sceneFrameReady,
} from "./film-shot-image-card";
import FilmShotImagesPanel from "./film-shot-images-panel";
import FilmStoryboardPanel, { createEmptyFilmScene } from "./film-storyboard-panel";
import FilmStudioPanel from "./film-studio-panel";
import { isFilmCreateVideoScene } from "./film-studio-timeline";
import {
  buildFilmCharactersFromNames,
  buildFilmPropsFromNames,
  buildFilmSceneImagesFromLocations,
  collectCharacterNamesFromScenes,
  collectLocationsFromScenes,
  collectPropNamesFromScenes,
  createEmptyFilmCharacter,
  createEmptyFilmProp,
  createEmptyFilmSceneImage,
  createFilmId,
  extractCharacterNamesFromText,
  FilmCharacterRecord,
  FilmEpisodeRecord,
  FilmProjectRecord,
  FilmPropRecord,
  FilmSceneImageRecord,
  FilmSceneRecord,
  FilmWorkspaceStepId,
  nextFilmCharacterCloneName,
  nextFilmLocationCloneName,
  nextFilmPropCloneName,
} from "./film-types";
import { sceneVideoReady } from "./film-video-card";
import {
  buildDefaultVideoRefSlots,
  ensureVideoRefSlotsFromFrame,
  FILM_VIDEO_REF_MODE_DEFAULT,
  FILM_VIDEO_REF_SLOT_COUNT,
  filmVideoRefModeToFlow2,
  filmVideoRefModeToServiceImageType,
  padVideoRefSlots,
  scenesNeedVideoRefSlotSeed,
  videoRefSlotsEqual,
  type FilmVideoRefMode,
  type FilmVideoRefSlot,
} from "./film-video-ref-mode";
import {
  FILM_VOICE_BULK_CONCURRENCY,
  generateFilmDialogueVoiceBlob,
  type FilmVoiceGenerateInput,
} from "./film-voice-generate";
import FilmVoicePanel from "./film-voice-panel";
import FilmWorkspaceSidebar from "./film-workspace-sidebar";
import {
  FILM_STEP_QUERY_KEY,
  filmStepFromLocation,
  parseFilmWorkspaceStepId,
} from "./film-workspace-steps";

type Props = {
  projectId: string;
};

/** Query `ep` = số tập 1-based; trả index 0-based (mặc định 0). */
function filmEpisodeIndexFromQuery(
  ep: string | string[] | null | undefined,
  episodeCount: number
): number {
  if (episodeCount <= 0) return 0;
  const raw = Array.isArray(ep) ? ep[0] : ep;
  if (raw == null || raw === "") return 0;
  const n = parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 1) return 0;
  const idx = n - 1;
  return idx < episodeCount ? idx : 0;
}

function filmEpisodeQueryFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("ep");
}

export default function FilmWorkspace({ projectId }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const alert = useAlert();
  const { customer, loadCustomer } = useAuth();
  const { setOpenCustomerLoginDialog } = useGlobalContext();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<FilmProjectRecord | null>(null);
  const [episodes, setEpisodes] = useState<FilmEpisodeRecord[]>([]);
  const [activeEpisodeIndex, setActiveEpisodeIndex] = useState(0);
  const [activeStep, setActiveStep] = useState<FilmWorkspaceStepId>(
    () => filmStepFromLocation() || "original_content"
  );
  /** Click tiêu đề Ảnh Cảnh quay → chọn phân cảnh khi mở Chuỗi Cảnh quay */
  const [storyboardFocusSceneId, setStoryboardFocusSceneId] = useState<string | null>(null);
  /** Card production focus (từ icon Gắn storyboard) */
  const [productionFocusEntityId, setProductionFocusEntityId] = useState<string | null>(
    null
  );
  const [characterCount, setCharacterCount] = useState(0);
  const [sceneCount, setSceneCount] = useState(0);
  const [scenes, setScenes] = useState<FilmSceneRecord[]>([]);
  /** Timeline Studio — IndexedDB riêng theo tập, không đụng `scenes` gốc */
  const [studioScenes, setStudioScenes] = useState<FilmSceneRecord[]>([]);
  const [studioLoading, setStudioLoading] = useState(false);
  const [characters, setCharacters] = useState<FilmCharacterRecord[]>([]);
  const [propsList, setPropsList] = useState<FilmPropRecord[]>([]);
  const [sceneImages, setSceneImages] = useState<FilmSceneImageRecord[]>([]);
  const [hasOriginalContent, setHasOriginalContent] = useState(false);
  /** ID entity đang cancel job (spinner nút Dừng) */
  const [stopPendingIds, setStopPendingIds] = useState<Record<string, true>>({});
  const voiceAbortRef = useRef(new Map<string, AbortController>());
  const voiceBulkAbortRef = useRef<AbortController | null>(null);
  const voiceBulkRunningRef = useRef(false);
  const [voiceSceneOverlay, setVoiceSceneOverlay] = useState<FilmSceneRecord[] | null>(null);

  useEffect(() => {
    return () => {
      voiceBulkAbortRef.current?.abort();
      voiceAbortRef.current.forEach((ac) => ac.abort());
      voiceAbortRef.current.clear();
    };
  }, []);
  /** Mode ảnh tham chiếu Tạo video (Start / Start-End / Thành Phần) */
  const [videoRefMode, setVideoRefMode] = useState<FilmVideoRefMode>(
    FILM_VIDEO_REF_MODE_DEFAULT
  );

  const markStopPending = useCallback((id: string, pending: boolean) => {
    setStopPendingIds((prev) => {
      if (pending) {
        if (prev[id]) return prev;
        return { ...prev, [id]: true };
      }
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const [aiKeysDialogOpen, setAiKeysDialogOpen] = useState(false);
  const [aiKeysStatus, setAiKeysStatus] = useState<FilmAiKeysStatus>(
    EMPTY_FILM_AI_KEYS_STATUS
  );
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [editingEpisodeId, setEditingEpisodeId] = useState<string | null>(null);
  const [episodeTitleDraft, setEpisodeTitleDraft] = useState("");
  const [hoveredEpisodeId, setHoveredEpisodeId] = useState<string | null>(null);

  const refreshAiKeysStatus = useCallback(async () => {
    try {
      const status = await fetchFilmAiKeysStatus();
      setAiKeysStatus(status);
      return status;
    } catch {
      setAiKeysStatus(EMPTY_FILM_AI_KEYS_STATUS);
      return EMPTY_FILM_AI_KEYS_STATUS;
    }
  }, []);

  /** Hết thời gian focus khi rời Chuỗi Cảnh quay */
  useEffect(() => {
    if (activeStep !== "storyboard") {
      setStoryboardFocusSceneId(null);
    }
  }, [activeStep]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const migrated = await migrateFilmAiKeysFromLocalStorage();
        if (cancelled) return;
        if (migrated) {
          setAiKeysStatus(migrated);
          return;
        }
      } catch {
        /* ignore */
      }
      if (cancelled) return;
      await refreshAiKeysStatus();
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshAiKeysStatus, customer?.id]);

  const openAiKeysDialog = () => {
    void refreshAiKeysStatus();
    setAiKeysDialogOpen(true);
  };

  const hasAnyAi = aiKeysStatus.hasAnyAi;

  const activeEpisode = episodes[activeEpisodeIndex] || null;

  const loadEpisodeScenes = useCallback(async (episodeId: string) => {
    const p = await getFilmProject(projectId).catch(() => null);
    // Gỡ clip/line Studio khỏi store scenes gốc (nếu còn sót từ bản cũ)
    let rows = await purgeStudioArtifactsFromEpisodeScenes(projectId, episodeId).catch(async () => {
      const raw = await getFilmScenesByEpisode(episodeId);
      return raw.filter((s) => !s.studioDerived);
    });
    rows = rows.filter(isFilmCreateVideoScene);

    const imageStyle = p?.storyboardImagePrompt;
    const videoStyle = p?.storyboardVideoPrompt;
    const audioStyle = p?.storyboardAudioPrompt;
    let next = rows;
    const dialogue = hydrateScenesDialogueLines(next);
    next = dialogue.scenes;
    const images = hydrateScenesImagePrompts(next, imageStyle);
    next = images.scenes;
    const videos = hydrateScenesVideoPrompts(next, videoStyle);
    next = videos.scenes;
    const audios = hydrateScenesAudioPrompts(next, audioStyle);
    next = audios.scenes;
    setScenes(next);
    const changedMap = new Map(
      [...dialogue.changed, ...images.changed, ...videos.changed, ...audios.changed].map(
        (s) => [s.id, s]
      )
    );
    for (const s of Array.from(changedMap.values())) {
      try {
        await putFilmScene(s);
      } catch (e) {
        console.error("[FilmWorkspace] scene hydrate put failed:", e);
      }
    }
  }, [projectId]);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      await initFilmDB();
      // Load project first — related stores failing must NOT wipe a valid project.
      const p = await getFilmProject(projectId);
      if (!p) {
        setProject(null);
        setEpisodes([]);
        setCharacters([]);
        setPropsList([]);
        setSceneImages([]);
        setScenes([]);
        setHasOriginalContent(false);
        setCharacterCount(0);
        setSceneCount(0);
        return;
      }

      const [eps, chars, allScenes, projectProps, locs] = await Promise.all([
        getFilmEpisodesByProject(projectId).catch((e) => {
          console.error("[FilmWorkspace] episodes load failed:", e);
          return [] as FilmEpisodeRecord[];
        }),
        getFilmCharactersByProject(projectId).catch((e) => {
          console.error("[FilmWorkspace] characters load failed:", e);
          return [] as FilmCharacterRecord[];
        }),
        getFilmScenesByProject(projectId).catch((e) => {
          console.error("[FilmWorkspace] scenes load failed:", e);
          return [] as FilmSceneRecord[];
        }),
        getFilmPropsByProject(projectId).catch((e) => {
          console.error("[FilmWorkspace] props load failed:", e);
          return [] as FilmPropRecord[];
        }),
        getFilmSceneImagesByProject(projectId).catch((e) => {
          console.error("[FilmWorkspace] sceneImages load failed:", e);
          return [] as FilmSceneImageRecord[];
        }),
      ]);

      setProject(p);
      setEpisodes(eps);

      // NV cũ chưa gán tập → gắn tất cả tập hiện có (không mất attach cũ)
      const allEpIds = eps.map((e) => e.id).filter(Boolean);
      let charsHydrated = chars;
      if (allEpIds.length) {
        const now = new Date().toISOString();
        const fixed: FilmCharacterRecord[] = [];
        let anyFixed = false;
        for (const c of chars) {
          if (c.episodeIds && c.episodeIds.length) {
            fixed.push(c);
            continue;
          }
          anyFixed = true;
          const nextC: FilmCharacterRecord = {
            ...c,
            episodeIds: [...allEpIds],
            updatedAt: now,
          };
          fixed.push(nextC);
          try {
            await putFilmCharacter(nextC);
          } catch (e) {
            console.error("[FilmWorkspace] character episode migrate failed:", e);
          }
        }
        if (anyFixed) charsHydrated = fixed;
      }

      setCharacters(charsHydrated);

      // VP / Bối cảnh cũ chưa gán tập → gắn tất cả tập
      let propsHydrated = projectProps;
      let locsHydrated = locs;
      if (allEpIds.length) {
        const nowEp = new Date().toISOString();
        const fixProps: FilmPropRecord[] = [];
        let anyPropFixed = false;
        for (const p of projectProps) {
          if (p.episodeIds && p.episodeIds.length) {
            fixProps.push(p);
            continue;
          }
          anyPropFixed = true;
          const nextP: FilmPropRecord = {
            ...p,
            episodeIds: [...allEpIds],
            propNames: p.propNames || [],
            updatedAt: nowEp,
          };
          fixProps.push(nextP);
          try {
            await putFilmProp(nextP);
          } catch (e) {
            console.error("[FilmWorkspace] prop episode migrate failed:", e);
          }
        }
        if (anyPropFixed) propsHydrated = fixProps;

        const fixLocs: FilmSceneImageRecord[] = [];
        let anyLocFixed = false;
        for (const loc of locs) {
          if (loc.episodeIds && loc.episodeIds.length) {
            fixLocs.push(loc);
            continue;
          }
          anyLocFixed = true;
          const nextL: FilmSceneImageRecord = {
            ...loc,
            episodeIds: [...allEpIds],
            propNames: loc.propNames || [],
            updatedAt: nowEp,
          };
          fixLocs.push(nextL);
          try {
            await putFilmSceneImage(nextL);
          } catch (e) {
            console.error("[FilmWorkspace] location episode migrate failed:", e);
          }
        }
        if (anyLocFixed) locsHydrated = fixLocs;
      }

      setPropsList(propsHydrated);
      setSceneImages(locsHydrated);
      const synced = await syncMissingEntitiesFromScenes(allScenes, {
        projectId: p.id,
        characters: charsHydrated,
        props: propsHydrated,
        locations: locsHydrated,
      });
      setCharacterCount(
        Math.max(
          synced?.characters.length ?? charsHydrated.length,
          p.characterCount || 0
        )
      );
      setSceneCount(Math.max(allScenes.length, p.sceneCount || 0));
      const epIdx = filmEpisodeIndexFromQuery(
        filmEpisodeQueryFromLocation() ?? router.query.ep,
        eps.length
      );
      setActiveEpisodeIndex(epIdx);
      const ep = eps[epIdx];
      if (ep) {
        setHasOriginalContent(!!ep.originalContent?.trim());
        try {
          const rows = await getFilmScenesByEpisode(ep.id);
          const dialogue = hydrateScenesDialogueLines(rows);
          const images = hydrateScenesImagePrompts(
            dialogue.scenes,
            p.storyboardImagePrompt
          );
          const videos = hydrateScenesVideoPrompts(
            images.scenes,
            p.storyboardVideoPrompt
          );
          const audios = hydrateScenesAudioPrompts(
            videos.scenes,
            p.storyboardAudioPrompt
          );
          setScenes(audios.scenes);
          const changedMap = new Map(
            [
              ...dialogue.changed,
              ...images.changed,
              ...videos.changed,
              ...audios.changed,
            ].map((s) => [s.id, s])
          );
          for (const s of Array.from(changedMap.values())) {
            try {
              await putFilmScene(s);
            } catch (e) {
              console.error("[FilmWorkspace] scene hydrate put failed:", e);
            }
          }
        } catch (e) {
          console.error("[FilmWorkspace] episode scenes load failed:", e);
          setScenes([]);
        }
      } else {
        setScenes([]);
        setHasOriginalContent(false);
      }
    } catch (err) {
      console.error("[FilmWorkspace] load failed:", err);
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const startEditProjectName = () => {
    if (!project) return;
    setProjectNameDraft(project.name);
    setEditingProjectName(true);
  };

  const commitProjectName = async () => {
    if (!project) return;
    const nextName = projectNameDraft.trim();
    setEditingProjectName(false);
    if (!nextName) {
      toast.warn(t("Tên dự án không được để trống."));
      return;
    }
    if (nextName === project.name.trim()) return;
    const updated: FilmProjectRecord = {
      ...project,
      name: nextName,
      updatedAt: new Date().toISOString(),
    };
    await putFilmProject(updated);
    setProject(updated);
  };

  const startEditEpisodeTitle = (ep: FilmEpisodeRecord) => {
    setEpisodeTitleDraft(ep.title?.trim() || `${t("Tập")} ${ep.index}`);
    setEditingEpisodeId(ep.id);
  };

  const commitEpisodeTitle = async () => {
    const episodeId = editingEpisodeId;
    if (!episodeId) return;
    const episode = episodes.find((e) => e.id === episodeId);
    setEditingEpisodeId(null);
    if (!episode) return;
    const nextTitle = episodeTitleDraft.trim();
    if (!nextTitle) {
      toast.warn(t("Tên tập không được để trống."));
      return;
    }
    if (nextTitle === (episode.title || "").trim()) return;
    const updated: FilmEpisodeRecord = {
      ...episode,
      title: nextTitle,
      updatedAt: new Date().toISOString(),
    };
    await putFilmEpisode(updated);
    setEpisodes((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    const ok = alert?.danger
      ? await alert.danger(
          t("Xóa dự án"),
          t(
            "Xóa “{{name}}” sẽ xóa toàn bộ tập, phân cảnh, nhân vật, vật phẩm và bối cảnh. Thao tác không hoàn tác. Tiếp tục?",
            { name: project.name }
          ),
          t("Xóa")
        )
      : window.confirm(
          t(
            "Xóa “{{name}}” sẽ xóa toàn bộ dữ liệu dự án. Tiếp tục?",
            { name: project.name }
          )
        );
    if (!ok) return;
    try {
      await deleteFilmProject(project.id);
      toast.success(t("Đã xóa dự án “{{name}}”", { name: project.name }));
      void router.push("/film");
    } catch (err) {
      console.error("[FilmWorkspace] delete project failed:", err);
      toast.error(t("Không thể xóa dự án"));
    }
  };

  /** Giữ đúng tập từ `?ep=` khi reload / back-forward (shallow). */
  useEffect(() => {
    if (!router.isReady || episodes.length === 0) return;
    const idx = filmEpisodeIndexFromQuery(router.query.ep, episodes.length);
    setActiveEpisodeIndex((cur) => (cur === idx ? cur : idx));
  }, [router.isReady, router.query.ep, episodes.length]);

  useEffect(() => {
    if (activeStep !== "voice" || !project?.id || !characters.length) return;
    if (voiceBulkRunningRef.current) return;
    let cancelled = false;
    void (async () => {
      const rows = await getFilmScenesByProject(project.id);
      if (cancelled || voiceBulkRunningRef.current) return;
      const { scenes: linked, changed } = applyCharacterVoiceLinksToScenes(rows, characters);
      if (!changed.length) return;
      for (const s of changed) await putFilmScene(s);
      if (cancelled || voiceBulkRunningRef.current) return;
      const patchMap = new Map(linked.map((s) => [s.id, s]));
      setScenes((prev) => prev.map((s) => patchMap.get(s.id) || s));
    })();
    return () => {
      cancelled = true;
    };
  }, [activeStep, project?.id, characters]);

  const selectActiveStep = useCallback(
    (step: FilmWorkspaceStepId) => {
      setActiveStep(step);
      if (!router.isReady) return;
      if (String(router.query[FILM_STEP_QUERY_KEY] ?? "") === step) return;
      void router.replace(
        {
          pathname: router.pathname,
          query: { ...router.query, [FILM_STEP_QUERY_KEY]: step },
        },
        undefined,
        { shallow: true }
      );
    },
    [router]
  );

  /** Giữ đúng bước sidebar từ `?step=` khi reload / back-forward (shallow). */
  useEffect(() => {
    if (!router.isReady) return;
    const parsed = parseFilmWorkspaceStepId(router.query[FILM_STEP_QUERY_KEY]);
    if (!parsed) return;
    setActiveStep((cur) => (cur === parsed ? cur : parsed));
  }, [router.isReady, router.query[FILM_STEP_QUERY_KEY]]);

  const selectActiveEpisode = useCallback(
    (idx: number) => {
      setActiveEpisodeIndex(idx);
      if (!router.isReady) return;
      const nextEp = String(idx + 1);
      if (String(router.query.ep ?? "") === nextEp) return;
      void router.replace(
        {
          pathname: router.pathname,
          query: { ...router.query, ep: nextEp },
        },
        undefined,
        { shallow: true }
      );
    },
    [router]
  );

  const handleAddEpisode = async () => {
    if (!project) return;
    try {
      const result = await addFilmEpisode(project.id);
      setProject(result.project);
      setEpisodes(result.episodes);
      setCharacters(result.characters);
      setPropsList(result.props);
      setSceneImages(result.sceneImages);
      setSceneCount(result.project.sceneCount || 0);
      selectActiveEpisode(result.episodes.length - 1);
      toast.success(t("Đã thêm {{title}}", { title: result.addedEpisode.title }));
    } catch (err) {
      console.error("[FilmWorkspace] add episode failed:", err);
      toast.error(t("Không thể thêm tập"));
    }
  };

  const handleDeleteEpisode = async (episode: FilmEpisodeRecord, deletedIdx: number) => {
    if (!project || episodes.length <= 1) return;
    const label = episode.title || `${t("Tập")} ${episode.index}`;
    const ok = alert?.danger
      ? await alert.danger(
          t("Xóa tập"),
          t(
            "Xóa “{{name}}” sẽ xóa toàn bộ phân cảnh và dữ liệu Studio của tập này. Thao tác không hoàn tác. Tiếp tục?",
            { name: label }
          ),
          t("Xóa")
        )
      : window.confirm(
          t(
            "Xóa “{{name}}” sẽ xóa toàn bộ phân cảnh và dữ liệu Studio của tập này. Tiếp tục?",
            { name: label }
          )
        );
    if (!ok) return;

    const activeIdBefore = activeEpisode?.id;
    try {
      const result = await deleteFilmEpisode(project.id, episode.id);
      setProject(result.project);
      setEpisodes(result.episodes);
      setCharacters(result.characters);
      setPropsList(result.props);
      setSceneImages(result.sceneImages);
      setSceneCount(result.project.sceneCount || 0);
      if (activeIdBefore === episode.id) {
        setScenes([]);
        selectActiveEpisode(Math.min(deletedIdx, result.episodes.length - 1));
      } else if (activeIdBefore) {
        const nextIdx = result.episodes.findIndex((e) => e.id === activeIdBefore);
        if (nextIdx >= 0 && nextIdx !== activeEpisodeIndex) {
          selectActiveEpisode(nextIdx);
        }
      }
      toast.success(t("Đã xóa {{name}}", { name: label }));
    } catch (err) {
      console.error("[FilmWorkspace] delete episode failed:", err);
      toast.error(t("Không thể xóa tập"));
    }
  };

  useEffect(() => {
    if (!activeEpisode) return;
    setHasOriginalContent(!!activeEpisode.originalContent?.trim());
    loadEpisodeScenes(activeEpisode.id).catch(console.error);
  }, [activeEpisode?.id, loadEpisodeScenes]);

  const handleSaveOriginal = async (content: string) => {
    if (!activeEpisode) return;
    const updated = await saveFilmEpisodeOriginalContent(activeEpisode.id, content);
    setEpisodes((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    setHasOriginalContent(!!content.trim());
  };

  const handleExtract = async (
    content: string,
    options?: { inheritPrevious?: boolean }
  ) => {
    if (!activeEpisode || !project) return;
    if (!customer) {
      setOpenCustomerLoginDialog(true);
      throw new Error(t("Vui lòng đăng nhập để dùng AI trích xuất"));
    }

    const status = await refreshAiKeysStatus();
    if (!status.hasAnyAi) {
      toast.warn(t("Vui lòng thêm API key AI để sử dụng tính năng này."));
      openAiKeysDialog();
      throw new Error(t("Chưa cấu hình API Key"));
    }

    const [savedInstruction, language] = await Promise.all([
      getFilmSystemInstruction(),
      getFilmOutputLanguage(),
    ]);
    const customInstruction = String(savedInstruction || "").trim();
    const systemInstruction =
      customInstruction &&
      customInstruction !== FILM_DEFAULT_SYSTEM_INSTRUCTION.trim()
        ? customInstruction
        : undefined;

    let previousScenes: ReturnType<typeof buildFilmPreviousEpisodeScenes> | undefined;
    if (options?.inheritPrevious) {
      const prevEpisode = episodes.find((e) => e.index === activeEpisode.index - 1);
      if (!prevEpisode) {
        toast.info(t("Không có tập trước để kế thừa. Sẽ chỉ dùng nội dung gốc."));
      } else {
        const prevScenes = await getFilmScenesByEpisode(prevEpisode.id);
        previousScenes = buildFilmPreviousEpisodeScenes(prevScenes);
        if (previousScenes.length === 0) {
          toast.info(
            t("Tập trước chưa có chuỗi cảnh quay. Sẽ chỉ dùng nội dung gốc.")
          );
          previousScenes = undefined;
        }
      }
    }

    const targetSceneCount = Math.max(
      1,
      activeEpisode.sceneCount || project.scenesPerEpisode || 6
    );
    const result = await extractFilmScreenplay({
      content,
      language,
      sceneCount: targetSceneCount,
      systemInstruction,
      previousScenes,
    });

    // Storyboard + Nhân vật + Vật phẩm + Ảnh Cảnh
    const applied = await applyFilmExtractResult({
      projectId: project.id,
      episode: activeEpisode,
      result,
      aspectRatio: resolveFilmProjectAspectRatio(project.aspectRatio),
      characterImagePromptTemplate: project.characterImagePromptTemplate,
      propImagePromptTemplate: project.propImagePromptTemplate,
      locationImagePromptTemplate: project.locationImagePromptTemplate,
      storyboardImagePrompt: project.storyboardImagePrompt,
      storyboardVideoPrompt: project.storyboardVideoPrompt,
      storyboardAudioPrompt: project.storyboardAudioPrompt,
    });

    setScenes(applied.scenes);
    setCharacters(applied.characters);
    setPropsList(applied.props);
    setSceneImages(applied.sceneImages);
    await syncMissingEntitiesFromScenes(applied.scenes, {
      projectId: project.id,
      characters: applied.characters,
      props: applied.props,
      locations: applied.sceneImages,
    });
    setCharacterCount(applied.characters.length);
    setSceneCount((c) => Math.max(c, applied.scenes.length));
    setProject((prev) =>
      prev
        ? {
            ...prev,
            characterCount: applied.characters.length,
            sceneCount: Math.max(prev.sceneCount || 0, applied.scenes.length),
            updatedAt: new Date().toISOString(),
          }
        : prev
    );

    setHasOriginalContent(true);
    setEpisodes((prev) =>
      prev.map((e) =>
        e.id === activeEpisode.id
          ? { ...e, originalContent: content, sceneCount: applied.scenes.length }
          : e
      )
    );

    const providerLabel =
      result.provider === "gemini"
        ? "Gemini"
        : result.provider === "gateway"
          ? "Gateway"
          : "OpenAI";
    toast.success(
      t(
        "Đã cập nhật {{scenes}} phân cảnh, {{chars}} nhân vật, {{props}} vật phẩm, {{locs}} cảnh",
        {
          scenes: applied.scenes.length,
          chars: applied.characters.length,
          props: applied.props.length,
          locs: applied.sceneImages.length,
        }
      ) + ` (${providerLabel})`
    );
    selectActiveStep("storyboard");
  };

  const handleSaveScene = async (scene: FilmSceneRecord) => {
    let synced = withSyncedDialogueLines(scene);
    synced = withBuiltSceneImagePrompt(
      synced,
      project?.storyboardImagePrompt
    );
    synced = withBuiltSceneVideoPrompt(
      synced,
      project?.storyboardVideoPrompt
    );
    synced = withBuiltSceneAudioPrompt(
      synced,
      project?.storyboardAudioPrompt
    );
    setScenes((prev) => prev.map((x) => (x.id === synced.id ? synced : x)));
    await putFilmScene(synced);
    await syncMissingEntitiesFromScenes([synced]);
  };

  const handleReplaceScenes = async (next: FilmSceneRecord[]) => {
    if (!activeEpisode || !project) return;
    const imageStyle = project.storyboardImagePrompt?.trim() || "";
    const videoStyle = project.storyboardVideoPrompt?.trim() || "";
    const audioStyle = project.storyboardAudioPrompt?.trim() || "";
    const seeded = next.map((s) => ({
      ...s,
      imagePrompt: buildFilmSceneImagePrompt(s, imageStyle || undefined),
      videoPrompt: buildFilmSceneVideoPrompt(s, videoStyle || undefined),
      audioPrompt: buildFilmSceneAudioPrompt(s, audioStyle || undefined) || s.audioPrompt || "",
    }));
    const saved = await replaceFilmScenesForEpisode(project.id, activeEpisode.id, seeded);
    setScenes(saved);
    setSceneCount((c) => Math.max(0, c - scenes.length + saved.length));
    await syncMissingEntitiesFromScenes(saved);
    setEpisodes((prev) =>
      prev.map((e) =>
        e.id === activeEpisode.id
          ? { ...e, sceneCount: saved.length, updatedAt: saved[0]?.updatedAt || e.updatedAt }
          : e
      )
    );
  };

  const handleAddScene = async () => {
    if (!activeEpisode || !project) return;
    const empty = createEmptyFilmScene(project.id, activeEpisode.id, scenes.length + 1);
    const withPrompts: FilmSceneRecord = {
      ...empty,
      imagePrompt: buildFilmSceneImagePrompt(
        empty,
        project.storyboardImagePrompt?.trim() || undefined
      ),
      videoPrompt: buildFilmSceneVideoPrompt(
        empty,
        project.storyboardVideoPrompt?.trim() || undefined
      ),
      audioPrompt:
        buildFilmSceneAudioPrompt(
          empty,
          project.storyboardAudioPrompt?.trim() || undefined
        ) || empty.audioPrompt ||
        "",
    };
    const created = await addFilmScene(withPrompts);
    setScenes((prev) => [...prev, created]);
    setSceneCount((c) => c + 1);
  };

  const handleExtractCharacters = async () => {
    if (!project) return;
    const fromScenes = collectCharacterNamesFromScenes(scenes);
    const fromText = extractCharacterNamesFromText(activeEpisode?.originalContent || "");
    let names = Array.from(new Set([...fromScenes, ...fromText]));

    if (names.length === 0 && characters.length > 0) return;
    if (names.length === 0) names = ["Nhân vật 1", "Nhân vật 2"];

    const byName = new Map(characters.map((c) => [c.name.trim().toLowerCase(), c]));
    const defaultEpIds = activeEpisode
      ? [activeEpisode.id]
      : episodes.map((e) => e.id).filter(Boolean);
    const built = buildFilmCharactersFromNames(project.id, names).map((c, i) => {
      const old = byName.get(c.name.trim().toLowerCase());
      if (!old) {
        return {
          ...c,
          episodeIds: defaultEpIds.length ? [...defaultEpIds] : [],
        };
      }
      return {
        ...c,
        id: old.id,
        role: old.role || c.role,
        description: old.description || c.description,
        clothingAccessories: old.clothingAccessories || c.clothingAccessories || "",
        propNames: old.propNames || [],
        episodeIds:
          old.episodeIds?.length
            ? old.episodeIds
            : defaultEpIds.length
              ? [...defaultEpIds]
              : [],
        imagePrompt:
          old.imagePrompt ||
          buildFilmCharacterImagePrompt(
            {
              name: c.name,
              description: old.description || c.description,
              clothingAccessories: old.clothingAccessories || c.clothingAccessories,
            },
            project.characterImagePromptTemplate
          ),
        imageUrl: old.imageUrl,
        imageUrls: old.imageUrls,
        imageBlob: old.imageBlob,
        status: old.status,
        mediaJobId: old.mediaJobId,
        mediaJobProgress: old.mediaJobProgress,
        sortOrder: i,
      };
    });

    const saved = await replaceFilmCharactersForProject(project.id, built);
    setCharacters(saved);
    setCharacterCount(saved.length);
  };

  /**
   * Đổi tên entity → cập nhật gắn + mọi text có tên trùng (mọi tập, card, nội dung gốc, prompt).
   * Ưu tiên so sánh với bản trong state (trước re-render panel).
   */
  const syncEntityRenameAcrossProject = async (
    kind: "character" | "prop" | "location",
    entityId: string,
    newName: string
  ) => {
    if (!project) return;
    const trimmed = newName.trim();
    if (!trimmed) return;

    let oldName = "";
    if (kind === "character") {
      oldName = characters.find((c) => c.id === entityId)?.name?.trim() || "";
    } else if (kind === "prop") {
      oldName = propsList.find((p) => p.id === entityId)?.name?.trim() || "";
    } else {
      oldName = sceneImages.find((s) => s.id === entityId)?.name?.trim() || "";
    }
    if (!oldName || oldName.toLowerCase() === trimmed.toLowerCase()) return;

    // Cập nhật mọi scene project (không chỉ tập đang mở)
    let allScenes: FilmSceneRecord[] = scenes;
    try {
      allScenes = await getFilmScenesByProject(project.id);
    } catch {
      allScenes = scenes;
    }

    const nextScenes = renameEntityNameInScenes(allScenes, kind, oldName, trimmed);
    const changedScenes = nextScenes.filter((s, i) => s !== allScenes[i]);
    for (const s of changedScenes) {
      await putFilmScene(s);
    }
    // Sync list UI của tập hiện tại
    if (activeEpisode) {
      const epScenes = nextScenes
        .filter((s) => s.episodeId === activeEpisode.id)
        .sort((a, b) => a.index - b.index);
      if (epScenes.length) setScenes(epScenes);
      else {
        setScenes((prev) => renameEntityNameInScenes(prev, kind, oldName, trimmed));
      }
    } else if (changedScenes.length) {
      setScenes((prev) => renameEntityNameInScenes(prev, kind, oldName, trimmed));
    }

    // Nhân vật (propNames + mô tả / prompt)
    const nextChars = renameEntityNameInCharacters(characters, oldName, trimmed);
    const charsChanged = nextChars.some((c, i) => c !== characters[i]);
    if (charsChanged) {
      for (const c of nextChars) {
        if (kind === "character" && c.id === entityId) continue; // caller put
        const prev = characters.find((x) => x.id === c.id);
        if (prev && c !== prev) await putFilmCharacter(c);
      }
      setCharacters(
        kind === "character"
          ? nextChars.map((c) =>
              c.id === entityId
                ? {
                    ...c,
                    name: trimmed,
                    updatedAt: new Date().toISOString(),
                  }
                : c
            )
          : nextChars
      );
    }

    // Vật phẩm
    const nextProps = renameEntityNameInProps(propsList, oldName, trimmed, {
      excludeId: kind === "prop" ? entityId : undefined,
    }).map((p) =>
      kind === "prop" && p.id === entityId
        ? {
            ...p,
            name: trimmed,
            updatedAt: new Date().toISOString(),
          }
        : p
    );
    const propsChanged = nextProps.some((p, i) => {
      const prev = propsList[i];
      return (
        !prev ||
        p.id !== prev.id ||
        p.name !== prev.name ||
        p.description !== prev.description ||
        p.imagePrompt !== prev.imagePrompt ||
        (p.propNames || []).join("|") !== (prev.propNames || []).join("|")
      );
    });
    if (propsChanged) {
      for (const p of nextProps) {
        if (kind === "prop" && p.id === entityId) continue;
        const prev = propsList.find((x) => x.id === p.id);
        if (
          prev &&
          (p.description !== prev.description ||
            p.imagePrompt !== prev.imagePrompt ||
            (p.propNames || []).join("|") !== (prev.propNames || []).join("|"))
        ) {
          await putFilmProp(p);
        }
      }
      setPropsList(nextProps);
    }

    // Bối cảnh
    const nextLocs = renameEntityNameInLocations(sceneImages, oldName, trimmed).map(
      (loc) =>
        kind === "location" && loc.id === entityId
          ? {
              ...loc,
              name: trimmed,
              updatedAt: new Date().toISOString(),
            }
          : loc
    );
    const locsChanged = nextLocs.some((loc, i) => {
      const prev = sceneImages[i];
      return (
        !prev ||
        loc.id !== prev.id ||
        loc.name !== prev.name ||
        loc.description !== prev.description ||
        loc.context !== prev.context ||
        loc.imagePrompt !== prev.imagePrompt ||
        (loc.propNames || []).join("|") !== (prev.propNames || []).join("|")
      );
    });
    if (locsChanged) {
      for (const loc of nextLocs) {
        if (kind === "location" && loc.id === entityId) continue;
        const prev = sceneImages.find((x) => x.id === loc.id);
        if (
          prev &&
          (loc.description !== prev.description ||
            loc.context !== prev.context ||
            loc.imagePrompt !== prev.imagePrompt ||
            (loc.propNames || []).join("|") !== (prev.propNames || []).join("|"))
        ) {
          await putFilmSceneImage(loc);
        }
      }
      setSceneImages(nextLocs);
    }

    // Nội dung gốc + tiêu đề tập
    const nextEps = renameEntityNameInEpisodes(episodes, oldName, trimmed);
    const epsChanged = nextEps.some((ep, i) => ep !== episodes[i]);
    if (epsChanged) {
      for (const ep of nextEps) {
        const prev = episodes.find((x) => x.id === ep.id);
        if (
          prev &&
          (ep.originalContent !== prev.originalContent || ep.title !== prev.title)
        ) {
          await putFilmEpisode(ep);
        }
      }
      setEpisodes(nextEps);
      setHasOriginalContent(
        !!nextEps.find((e) => e.id === activeEpisode?.id)?.originalContent?.trim() ||
          nextEps.some((e) => !!e.originalContent?.trim())
      );
    }

    // Prompt mẫu Setting
    const nextProject = renameEntityNameInProject(project, oldName, trimmed);
    if (nextProject) {
      await putFilmProject(nextProject);
      setProject(nextProject);
    }
  };

  const handleSaveCharacter = async (c: FilmCharacterRecord) => {
    const prev = characters.find((x) => x.id === c.id);
    const oldName = prev?.name?.trim() || "";
    const newName = c.name.trim();
    await syncEntityRenameAcrossProject("character", c.id, newName);
    let toSave: FilmCharacterRecord = { ...c, name: newName };
    if (oldName && oldName.toLowerCase() !== newName.toLowerCase()) {
      const [patched] = renameEntityNameInCharacters([toSave], oldName, newName);
      toSave = { ...patched, name: newName };
    }
    const hadVoice = !!(prev?.voiceId?.trim() || prev?.voiceLabel?.trim() || prev?.voicePreviewBlob);
    const hasVoice = !!(toSave.voiceId?.trim() || toSave.voiceLabel?.trim() || toSave.voicePreviewBlob);
    await putFilmCharacter(toSave);
    const nextCharacters = characters.map((x) => (x.id === toSave.id ? toSave : x));
    setCharacters(nextCharacters);
    if (!project) return;
    const allRows = await getFilmScenesByProject(project.id);
    let linkedScenes = allRows;
    let changed: FilmSceneRecord[] = [];
    if (hadVoice && !hasVoice) {
      const stripped = stripCharacterVoiceLinksFromScenes(allRows, toSave.name);
      linkedScenes = stripped.scenes;
      changed = stripped.changed;
    } else {
      const linked = applyCharacterVoiceLinksToScenes(allRows, nextCharacters);
      linkedScenes = linked.scenes;
      changed = linked.changed;
    }
    if (changed.length) {
      const patchMap = new Map(linkedScenes.map((s) => [s.id, s]));
      setScenes((prev) => prev.map((s) => patchMap.get(s.id) || s));
      for (const s of changed) await putFilmScene(s);
    }
  };

  /** Poll job nền → cập nhật character; đổi tab / đóng dialog không cancel. */
  const finishCharacterImageJob = useCallback(
    (entityId: string, prompt: string, jobId: string, base: FilmCharacterRecord) => {
      void waitFilmMediaJob<Record<string, unknown>>(jobId, (progress) => {
        setCharacters((prev) =>
          prev.map((x) =>
            x.id === entityId && x.mediaJobId === jobId
              ? { ...x, mediaJobProgress: progress, status: "creating" }
              : x
          )
        );
      })
        .then(async (resultData) => {
          const stored = await materializeFilmImageFromJobResult(resultData);
          if (!stored.imageUrl && !stored.imageBlob) throw new Error("Không lấy được URL ảnh");
          const url = stored.imageUrl || "";
          setCharacters((prev) => {
            const current = prev.find((x) => x.id === entityId);
            if (!current || current.mediaJobId !== jobId) return prev;
            const updated: FilmCharacterRecord = {
              ...current,
              imagePrompt: prompt || current.imagePrompt,
              imageUrl: url,
              imageUrls: url
                ? [url, ...(current.imageUrls || []).filter((u) => u && u !== url)]
                : current.imageUrls,
              imageBlob: stored.imageBlob,
              status: "created",
              mediaJobId: undefined,
              mediaJobProgress: undefined,
              mediaError: undefined,
              updatedAt: new Date().toISOString(),
            };
            void putFilmCharacter(updated);
            return prev.map((x) => (x.id === updated.id ? updated : x));
          });
        })
        .catch(async (err: any) => {
          setCharacters((prev) => {
            const current = prev.find((x) => x.id === entityId);
            if (!current || current.mediaJobId !== jobId) return prev;
            const failed: FilmCharacterRecord = {
              ...current,
              imagePrompt: prompt || current.imagePrompt || base.imagePrompt,
              status:
                current.imageBlob || (current.imageUrl || "").trim()
                  ? "created"
                  : "failed",
              mediaJobId: undefined,
              mediaJobProgress: undefined,
              mediaError: String(err?.message || t("Tạo ảnh nhân vật thất bại")),
              updatedAt: new Date().toISOString(),
            };
            void putFilmCharacter(failed);
            return prev.map((x) => (x.id === failed.id ? failed : x));
          });
        });
    },
    [t]
  );

  const handleStopCharacterImage = useCallback(
    async (character: FilmCharacterRecord) => {
      const latest = characters.find((c) => c.id === character.id) || character;
      if (latest.status !== "creating") return;
      const jobId = latest.mediaJobId;
      markStopPending(latest.id, true);
      try {
        // Clear job id trước để waiter success/fail không ghi đè
        const stopped: FilmCharacterRecord = {
          ...latest,
          status:
            latest.imageBlob || (latest.imageUrl || "").trim() ? "created" : "failed",
          mediaJobId: undefined,
          mediaJobProgress: undefined,
          mediaError: t("Đã dừng"),
          updatedAt: new Date().toISOString(),
        };
        setCharacters((prev) => prev.map((x) => (x.id === stopped.id ? stopped : x)));
        await putFilmCharacter(stopped);
        if (jobId) {
          try {
            await cancelFilmMediaJob(jobId);
          } catch {
            // ignore cancel API errors
          }
        }
      } finally {
        markStopPending(latest.id, false);
      }
    },
    [characters, markStopPending, t]
  );

  /**
   * Enqueue job xong return ngay (dialog đóng được).
   * Loading bám `status: creating` + mediaJobId trên entity (IDB), không phụ thuộc dialog.
   */
  const handleCreateCharacterImage = async (input: {
    character: FilmCharacterRecord;
    prompt: string;
    images?: Array<string | { imageBytes: string; mimeType?: string }>;
    propNamesInPrompt?: string[];
    propIds?: string[];
  }) => {
    const { character, images } = input;
    if (!project) return;
    if (character.status === "creating" && character.mediaJobId) return;

    const propExtra = (input.propNamesInPrompt || [])
      .map((n) => n.trim())
      .filter(Boolean)
      .join("; ");
    const prompt =
      String(input.prompt || "").trim() ||
      buildFilmCharacterImagePrompt(
        character,
        project.characterImagePromptTemplate,
        propExtra || undefined
      );

    try {
      const { jobId } = await enqueueFilmImage({
        prompt,
        images: images?.length ? images : undefined,
        aspectRatio: FILM_CHARACTER_PROP_ASPECT_RATIO,
        numberOfImages: 1,
        filmProjectId: project.id,
        filmCharacterId: character.id,
        filmAssetKind: "character",
      });

      const creating: FilmCharacterRecord = {
        ...character,
        imagePrompt: prompt,
        status: "creating",
        mediaJobId: jobId,
        mediaJobProgress: 0,
        mediaError: undefined,
        updatedAt: new Date().toISOString(),
      };
      setCharacters((prev) => prev.map((x) => (x.id === creating.id ? creating : x)));
      await putFilmCharacter(creating);
      finishCharacterImageJob(character.id, prompt, jobId, character);
    } catch (err: any) {
      const failed: FilmCharacterRecord = {
        ...character,
        imagePrompt: prompt,
        status: "failed",
        mediaJobId: undefined,
        mediaJobProgress: undefined,
        mediaError: String(err?.message || t("Tạo ảnh nhân vật thất bại")),
        updatedAt: new Date().toISOString(),
      };
      setCharacters((prev) => prev.map((x) => (x.id === failed.id ? failed : x)));
      await putFilmCharacter(failed);
    }
  };

  /** Gen lại ảnh nhân vật + tối đa 10 ảnh tham chiếu vật phẩm (ưu tiên đã chọn). */
  const handleCreateCharacterWithPropRefs = async (input: {
    character: FilmCharacterRecord;
    prompt: string;
    propNamesInPrompt?: string[];
    propIds?: string[];
  }) => {
    if (!project) return;
    const character =
      characters.find((c) => c.id === input.character.id) || input.character;

    let fromIds: FilmPropRecord[] = [];
    if (input.propIds?.length) {
      const idSet = new Set(input.propIds);
      fromIds = propsList.filter((p) => idSet.has(p.id));
    } else {
      const nameKeys = new Set(
        (input.propNamesInPrompt || [])
          .map((raw) => raw.split(":")[0]?.trim().toLowerCase())
          .filter(Boolean)
      );
      fromIds = nameKeys.size
        ? propsList.filter((p) => nameKeys.has(p.name.trim().toLowerCase()))
        : propsList.filter((p) =>
            (character.propNames || []).some(
              (n) => n.trim().toLowerCase() === p.name.trim().toLowerCase()
            )
          );
    }

    const propsWithImage = fromIds.filter(
      (p) =>
        !!(
          p.imageBlob ||
          p.imageUrl?.trim() ||
          (p.imageUrls && p.imageUrls.length)
        )
    );

    if (!propsWithImage.length) {
      toast.warn(
        t("Chưa có ảnh vật phẩm để làm tham chiếu. Tạo ảnh vật phẩm trước.")
      );
      return;
    }

    // Ảnh vật phẩm trước (tối đa 10). Có chỗ thì chèn NV sheet đầu.
    const entities: Array<{
      imageBlob?: Blob | null;
      imageUrl?: string;
      imageUrls?: string[];
    }> = [];

    for (const p of propsWithImage) {
      if (entities.length >= 10) break;
      entities.push(p);
    }
    const hasCharImage = !!(
      character.imageBlob ||
      character.imageUrl?.trim() ||
      (character.imageUrls && character.imageUrls.length)
    );
    if (hasCharImage && entities.length < 10) {
      entities.unshift(character);
      if (entities.length > 10) entities.length = 10;
    }

    const images = await collectFilmMediaImageRefs(entities, 10);
    if (!images.length) {
      toast.warn(t("Không tải được ảnh tham chiếu vật phẩm."));
      return;
    }

    const propLabels = (input.propNamesInPrompt?.length
      ? input.propNamesInPrompt
      : propsWithImage.map((p) =>
          p.description?.trim() ? `${p.name}: ${p.description.trim()}` : p.name
        )
    )
      .map((n) => n.trim())
      .filter(Boolean);

    await handleCreateCharacterImage({
      character,
      prompt: input.prompt || "",
      images,
      propNamesInPrompt: propLabels,
    });
  };

  const handleSetCharacterImage = async (
    character: FilmCharacterRecord,
    image: GeneratedImageData
  ) => {
    const stored = generatedImageDataToFilmStored(image);
    if (!stored.imageUrl && !stored.imageBlob) return;
    const url = stored.imageUrl || "";
    const next: FilmCharacterRecord = {
      ...character,
      imageUrl: url,
      imageUrls: url
        ? [url, ...(character.imageUrls || []).filter((u) => u && u !== url)]
        : character.imageUrls,
      imageBlob: stored.imageBlob,
      status: "created",
      mediaJobId: undefined,
      mediaJobProgress: undefined,
      mediaError: undefined,
      updatedAt: new Date().toISOString(),
    };
    setCharacters((prev) => prev.map((x) => (x.id === next.id ? next : x)));
    await putFilmCharacter(next);
  };

  const handleBulkCreateCharacters = async () => {
    if (!project) return;
    const targets = characters.filter(
      (c) =>
        c.status !== "creating" &&
        c.status !== "created" &&
        !(c.imageUrl || (c.imageUrls && c.imageUrls.length) || c.imageBlob)
    );
    for (const c of targets) {
      const prompt =
        c.imagePrompt?.trim() ||
        buildFilmCharacterImagePrompt(c, project.characterImagePromptTemplate);
      try {
        await handleCreateCharacterImage({ character: c, prompt });
      } catch {
        // tiếp tục item khác
      }
    }
  };

  const handleAddCharacter = async (name?: string) => {
    if (!project) return;
    const label = (name || "").trim() || `Nhân vật ${characters.length + 1}`;
    const episodeIds = activeEpisode
      ? [activeEpisode.id]
      : episodes.map((e) => e.id).filter(Boolean);
    const empty = createEmptyFilmCharacter(
      project.id,
      characters.length,
      label,
      episodeIds
    );
    await putFilmCharacter(empty);
    setCharacters((prev) => [...prev, empty]);
    setCharacterCount((n) => n + 1);
    return empty;
  };

  /** Gắn storyboard → tạo entity trên tab Nhân vật nếu chưa có; luôn gắn thẻ tập hiện tại. */
  const ensureCharactersByNames = async (
    names: string[],
    opts?: {
      source?: FilmCharacterRecord[];
      projectId?: string;
      episodeIdsByKey?: Map<string, string[]>;
    }
  ) => {
    const projectId = opts?.projectId || project?.id;
    if (!projectId) return opts?.source ?? characters;
    const episodeId = activeEpisode?.id;
    let list = [...(opts?.source ?? characters)];
    let sortBase = list.length;
    const created: FilmCharacterRecord[] = [];
    const updated: FilmCharacterRecord[] = [];
    const now = new Date().toISOString();

    const tagEps = (key: string, current?: string[]) => {
      const extra = opts?.episodeIdsByKey?.get(key) || [];
      const next = new Set([...(current || []), ...extra].filter(Boolean));
      if (episodeId) next.add(episodeId);
      return Array.from(next);
    };

    for (const raw of names) {
      const n = raw.trim();
      if (!n) continue;
      const k = n.toLowerCase();
      const existing = list.find((c) => c.name.trim().toLowerCase() === k);
      if (existing) {
        const episodeIds = tagEps(k, existing.episodeIds);
        const same =
          episodeIds.length === (existing.episodeIds || []).length &&
          episodeIds.every((id) => (existing.episodeIds || []).includes(id));
        if (!same) {
          const next: FilmCharacterRecord = {
            ...existing,
            episodeIds,
            updatedAt: now,
          };
          await putFilmCharacter(next);
          updated.push(next);
          list = list.map((c) => (c.id === next.id ? next : c));
        }
        continue;
      }
      const alreadyNew = created.some((c) => c.name.trim().toLowerCase() === k);
      if (alreadyNew) continue;
      const episodeIds = tagEps(
        k,
        episodeId ? [episodeId] : episodes.map((e) => e.id)
      );
      const empty = createEmptyFilmCharacter(
        projectId,
        sortBase++,
        n,
        episodeIds.length ? episodeIds : episodes.map((e) => e.id)
      );
      await putFilmCharacter(empty);
      created.push(empty);
      list = [...list, empty];
    }

    if (created.length || updated.length) {
      setCharacters(list);
      if (created.length) setCharacterCount((n) => n + created.length);
    }
    return list;
  };

  const handleCloneCharacter = async (c: FilmCharacterRecord) => {
    if (!project) return;
    const name = nextFilmCharacterCloneName(
      c.name,
      characters.map((x) => x.name)
    );
    const now = new Date().toISOString();
    const clone: FilmCharacterRecord = {
      ...c,
      id: createFilmId("ch"),
      name,
      propNames: [...(c.propNames || [])],
      episodeIds: [...(c.episodeIds || [])],
      imageUrls: c.imageUrls ? [...c.imageUrls] : [],
      status: c.imageBlob || c.imageUrl || (c.imageUrls && c.imageUrls.length)
        ? c.status || "created"
        : "pending",
      mediaJobId: undefined,
      mediaJobProgress: undefined,
      mediaError: undefined,
      sortOrder: characters.length,
      createdAt: now,
      updatedAt: now,
    };
    await putFilmCharacter(clone);
    setCharacters((prev) => [...prev, clone]);
    setCharacterCount((n) => n + 1);
    toast.success(t("Đã clone “{{name}}”.", { name: clone.name }));
    return clone;
  };

  const handleDeleteCharacter = async (c: FilmCharacterRecord) => {
    const refCount = countScenesReferencingName(scenes, "character", c.name);
    const ok = alert.danger
      ? await alert.danger(
          t("Xóa nhân vật"),
          t(
            "Xóa “{{name}}” sẽ gỡ khỏi tất cả phân cảnh đang gắn ({{count}} cảnh). Thao tác không hoàn tác. Tiếp tục?",
            { name: c.name, count: refCount }
          ),
          t("Xóa")
        )
      : window.confirm(
          t(
            "Xóa “{{name}}” sẽ gỡ khỏi tất cả phân cảnh đang gắn ({{count}} cảnh). Tiếp tục?",
            { name: c.name, count: refCount }
          )
        );
    if (!ok) return;

    await deleteFilmCharacter(c.id);
    setCharacters((prev) => prev.filter((x) => x.id !== c.id));
    setCharacterCount((n) => Math.max(0, n - 1));

    const nextScenes = stripEntityNameFromScenes(scenes, "character", c.name);
    const changed = nextScenes.filter((s, i) => s !== scenes[i]);
    if (changed.length) {
      setScenes(nextScenes);
      for (const s of changed) await putFilmScene(s);
    }
  };

  const handleExtractProps = async () => {
    if (!project) return;
    let names = collectPropNamesFromScenes(scenes);
    if (names.length === 0 && propsList.length > 0) return;
    if (names.length === 0) {
      names = ["Vật phẩm 1", "Vật phẩm 2", "Vật phẩm 3"];
    }
    const byName = new Map(propsList.map((p) => [p.name.trim().toLowerCase(), p]));
    const built = buildFilmPropsFromNames(project.id, names).map((p, i) => {
      const old = byName.get(p.name.trim().toLowerCase());
      if (!old) {
        return {
          ...p,
          imagePrompt: buildFilmPropImagePrompt(p, project.propImagePromptTemplate),
        };
      }
      return {
        ...p,
        id: old.id,
        category: old.category || p.category,
        description: old.description || p.description,
        imagePrompt:
          old.imagePrompt ||
          buildFilmPropImagePrompt(
            {
              name: p.name,
              description: old.description || p.description,
            },
            project.propImagePromptTemplate
          ),
        imageUrl: old.imageUrl,
        imageUrls: old.imageUrls,
        imageBlob: old.imageBlob,
        status: old.status,
        mediaJobId: old.mediaJobId,
        mediaJobProgress: old.mediaJobProgress,
        locked: old.locked,
        sortOrder: i,
      };
    });
    const saved = await replaceFilmPropsForProject(project.id, built);
    setPropsList(saved);
  };

  const handleSaveProp = async (p: FilmPropRecord) => {
    const prev = propsList.find((x) => x.id === p.id);
    const oldName = prev?.name?.trim() || "";
    const newName = p.name.trim();
    await syncEntityRenameAcrossProject("prop", p.id, newName);
    let toSave: FilmPropRecord = { ...p, name: newName };
    if (oldName && oldName.toLowerCase() !== newName.toLowerCase()) {
      const [patched] = renameEntityNameInProps([toSave], oldName, newName);
      toSave = { ...patched, name: newName };
    }
    await putFilmProp(toSave);
    setPropsList((prevList) =>
      prevList.map((x) => (x.id === toSave.id ? toSave : x))
    );
  };

  const finishPropImageJob = useCallback(
    (entityId: string, prompt: string, jobId: string, base: FilmPropRecord) => {
      void waitFilmMediaJob<Record<string, unknown>>(jobId, (progress) => {
        setPropsList((prev) =>
          prev.map((x) =>
            x.id === entityId && x.mediaJobId === jobId
              ? { ...x, mediaJobProgress: progress, status: "creating" }
              : x
          )
        );
      })
        .then(async (resultData) => {
          const stored = await materializeFilmImageFromJobResult(resultData);
          if (!stored.imageUrl && !stored.imageBlob) throw new Error("Không lấy được URL ảnh vật phẩm");
          const url = stored.imageUrl || "";
          setPropsList((prev) => {
            const current = prev.find((x) => x.id === entityId);
            if (!current || current.mediaJobId !== jobId) return prev;
            const done: FilmPropRecord = {
              ...current,
              imagePrompt: prompt || current.imagePrompt,
              imageUrl: url,
              imageUrls: url
                ? [url, ...(current.imageUrls || []).filter((u) => u && u !== url)]
                : current.imageUrls,
              imageBlob: stored.imageBlob,
              status: "created",
              mediaJobId: undefined,
              mediaJobProgress: undefined,
              mediaError: undefined,
              updatedAt: new Date().toISOString(),
            };
            void putFilmProp(done);
            return prev.map((x) => (x.id === done.id ? done : x));
          });
        })
        .catch(async (err: any) => {
          setPropsList((prev) => {
            const current = prev.find((x) => x.id === entityId);
            if (!current || current.mediaJobId !== jobId) return prev;
            const failed: FilmPropRecord = {
              ...current,
              imagePrompt: prompt || current.imagePrompt || base.imagePrompt,
              status:
                current.imageBlob || (current.imageUrl || "").trim()
                  ? "created"
                  : "failed",
              mediaJobId: undefined,
              mediaJobProgress: undefined,
              mediaError: String(err?.message || t("Tạo ảnh vật phẩm thất bại")),
              updatedAt: new Date().toISOString(),
            };
            void putFilmProp(failed);
            return prev.map((x) => (x.id === failed.id ? failed : x));
          });
        });
    },
    [t]
  );

  const handleStopPropImage = useCallback(
    async (prop: FilmPropRecord) => {
      const latest = propsList.find((p) => p.id === prop.id) || prop;
      if (latest.status !== "creating") return;
      const jobId = latest.mediaJobId;
      markStopPending(latest.id, true);
      try {
        const stopped: FilmPropRecord = {
          ...latest,
          status:
            latest.imageBlob || (latest.imageUrl || "").trim() ? "created" : "failed",
          mediaJobId: undefined,
          mediaJobProgress: undefined,
          mediaError: t("Đã dừng"),
          updatedAt: new Date().toISOString(),
        };
        setPropsList((prev) => prev.map((x) => (x.id === stopped.id ? stopped : x)));
        await putFilmProp(stopped);
        if (jobId) {
          try {
            await cancelFilmMediaJob(jobId);
          } catch {
            // ignore
          }
        }
      } finally {
        markStopPending(latest.id, false);
      }
    },
    [propsList, markStopPending, t]
  );

  const handleCreatePropImage = async (input: FilmPropImageGenerateInput) => {
    if (!project) return;
    const { prop } = input;
    if (prop.status === "creating" && prop.mediaJobId) return;

    const propExtra = (input.propNamesInPrompt || [])
      .map((n) => n.trim())
      .filter(Boolean)
      .join("; ");
    let prompt = String(input.prompt || "").trim();
    if (!prompt) {
      prompt = buildFilmPropImagePrompt(prop, project.propImagePromptTemplate);
      if (propExtra) prompt = `${prompt}\nCompanion props: ${propExtra}`;
    }

    try {
      const { jobId } = await enqueueFilmImage({
        prompt,
        images: input.images?.length ? input.images : undefined,
        aspectRatio: FILM_CHARACTER_PROP_ASPECT_RATIO,
        numberOfImages: 1,
        filmProjectId: project.id,
        filmPropId: prop.id,
        filmAssetKind: "prop",
      });

      const creating: FilmPropRecord = {
        ...prop,
        imagePrompt: prompt,
        status: "creating",
        mediaJobId: jobId,
        mediaJobProgress: 0,
        mediaError: undefined,
        updatedAt: new Date().toISOString(),
      };
      setPropsList((prev) => prev.map((x) => (x.id === creating.id ? creating : x)));
      await putFilmProp(creating);
      finishPropImageJob(prop.id, prompt, jobId, prop);
    } catch (err: any) {
      const failed: FilmPropRecord = {
        ...prop,
        imagePrompt: prompt,
        status: "failed",
        mediaJobId: undefined,
        mediaJobProgress: undefined,
        mediaError: String(err?.message || t("Tạo ảnh vật phẩm thất bại")),
        updatedAt: new Date().toISOString(),
      };
      setPropsList((prev) => prev.map((x) => (x.id === failed.id ? failed : x)));
      await putFilmProp(failed);
    }
  };

  const handleCreatePropWithCompanionRefs = async (
    input: FilmPropImageGenerateInput
  ) => {
    if (!project) return;
    const prop = propsList.find((p) => p.id === input.prop.id) || input.prop;
    let fromIds: FilmPropRecord[] = [];
    if (input.propIds?.length) {
      const idSet = new Set(input.propIds);
      fromIds = propsList.filter((p) => idSet.has(p.id) && p.id !== prop.id);
    } else {
      fromIds = propsList.filter(
        (p) =>
          p.id !== prop.id &&
          (prop.propNames || []).some(
            (n) => n.trim().toLowerCase() === p.name.trim().toLowerCase()
          )
      );
    }
    const withImage = fromIds.filter(
      (p) =>
        !!(p.imageBlob || p.imageUrl?.trim() || (p.imageUrls && p.imageUrls.length))
    );
    if (!withImage.length) {
      toast.warn(
        t("Chưa có ảnh vật phẩm kèm để làm tham chiếu. Tạo ảnh vật phẩm trước.")
      );
      return;
    }
    const entities: Array<{
      imageBlob?: Blob | null;
      imageUrl?: string;
      imageUrls?: string[];
    }> = [];
    for (const p of withImage) {
      if (entities.length >= 10) break;
      entities.push(p);
    }
    const hasSelf = !!(
      prop.imageBlob ||
      prop.imageUrl?.trim() ||
      (prop.imageUrls && prop.imageUrls.length)
    );
    if (hasSelf && entities.length < 10) {
      entities.unshift(prop);
      if (entities.length > 10) entities.length = 10;
    }
    const images = await collectFilmMediaImageRefs(entities, 10);
    if (!images.length) {
      toast.warn(t("Không tải được ảnh tham chiếu vật phẩm."));
      return;
    }
    const propLabels = input.propNamesInPrompt?.length
      ? input.propNamesInPrompt
      : withImage.map((p) =>
          p.description?.trim() ? `${p.name}: ${p.description.trim()}` : p.name
        );
    await handleCreatePropImage({
      prop,
      prompt: input.prompt || "",
      images,
      propIds: withImage.map((p) => p.id),
      propNamesInPrompt: propLabels,
    });
  };

  const handleSetPropImage = async (prop: FilmPropRecord, image: GeneratedImageData) => {
    const stored = generatedImageDataToFilmStored(image);
    if (!stored.imageUrl && !stored.imageBlob) return;
    const url = stored.imageUrl || "";
    const next: FilmPropRecord = {
      ...prop,
      imageUrl: url,
      imageUrls: url
        ? [url, ...(prop.imageUrls || []).filter((u) => u && u !== url)]
        : prop.imageUrls,
      imageBlob: stored.imageBlob,
      status: "created",
      mediaJobId: undefined,
      mediaJobProgress: undefined,
      mediaError: undefined,
      updatedAt: new Date().toISOString(),
    };
    setPropsList((prev) => prev.map((x) => (x.id === next.id ? next : x)));
    await putFilmProp(next);
  };

  const handleBulkCreateProps = async () => {
    if (!project) return;
    const targets = propsList.filter(
      (p) =>
        p.status !== "creating" &&
        p.status !== "created" &&
        !(p.imageUrl || (p.imageUrls && p.imageUrls.length) || p.imageBlob)
    );
    if (!targets.length) return;

    for (const prop of targets) {
      const prompt =
        prop.imagePrompt?.trim() ||
        buildFilmPropImagePrompt(prop, project.propImagePromptTemplate);
      try {
        await handleCreatePropImage({ prop, prompt });
      } catch {
        // tiếp tục item khác
      }
    }
  };

  const handleAddProp = async (name?: string) => {
    if (!project) return;
    const label = (name || "").trim() || `Vật phẩm ${propsList.length + 1}`;
    const episodeIds = activeEpisode
      ? [activeEpisode.id]
      : episodes.map((e) => e.id).filter(Boolean);
    const empty = createEmptyFilmProp(
      project.id,
      propsList.length,
      label,
      episodeIds
    );
    await putFilmProp(empty);
    setPropsList((prev) => [...prev, empty]);
    return empty;
  };

  const ensurePropsByNames = async (
    names: string[],
    opts?: {
      source?: FilmPropRecord[];
      projectId?: string;
      episodeIdsByKey?: Map<string, string[]>;
    }
  ) => {
    const projectId = opts?.projectId || project?.id;
    if (!projectId) return opts?.source ?? propsList;
    const episodeId = activeEpisode?.id;
    let list = [...(opts?.source ?? propsList)];
    let sortBase = list.length;
    const created: FilmPropRecord[] = [];
    const updated: FilmPropRecord[] = [];
    const now = new Date().toISOString();

    const tagEps = (key: string, current?: string[]) => {
      const extra = opts?.episodeIdsByKey?.get(key) || [];
      const next = new Set([...(current || []), ...extra].filter(Boolean));
      if (episodeId) next.add(episodeId);
      return Array.from(next);
    };

    for (const raw of names) {
      const n = raw.trim();
      if (!n) continue;
      const k = n.toLowerCase();
      const existing = list.find((p) => p.name.trim().toLowerCase() === k);
      if (existing) {
        const episodeIds = tagEps(k, existing.episodeIds);
        const same =
          episodeIds.length === (existing.episodeIds || []).length &&
          episodeIds.every((id) => (existing.episodeIds || []).includes(id));
        if (!same) {
          const next: FilmPropRecord = {
            ...existing,
            episodeIds,
            updatedAt: now,
          };
          await putFilmProp(next);
          updated.push(next);
          list = list.map((p) => (p.id === next.id ? next : p));
        }
        continue;
      }
      if (created.some((p) => p.name.trim().toLowerCase() === k)) continue;
      const episodeIds = tagEps(
        k,
        episodeId ? [episodeId] : episodes.map((e) => e.id)
      );
      const empty = createEmptyFilmProp(
        projectId,
        sortBase++,
        n,
        episodeIds.length ? episodeIds : episodes.map((e) => e.id)
      );
      await putFilmProp(empty);
      created.push(empty);
      list = [...list, empty];
    }

    if (created.length || updated.length) {
      setPropsList(list);
    }
    return list;
  };

  const handleCloneProp = async (p: FilmPropRecord) => {
    if (!project) return;
    const name = nextFilmPropCloneName(
      p.name,
      propsList.map((x) => x.name)
    );
    const now = new Date().toISOString();
    const clone: FilmPropRecord = {
      ...p,
      id: createFilmId("pr"),
      name,
      propNames: [...(p.propNames || [])],
      episodeIds: [...(p.episodeIds || [])],
      imageUrls: p.imageUrls ? [...p.imageUrls] : [],
      status: p.imageBlob || p.imageUrl || (p.imageUrls && p.imageUrls.length)
        ? p.status || "created"
        : "pending",
      mediaJobId: undefined,
      mediaJobProgress: undefined,
      mediaError: undefined,
      sortOrder: propsList.length,
      createdAt: now,
      updatedAt: now,
    };
    await putFilmProp(clone);
    setPropsList((prev) => [...prev, clone]);
    toast.success(t("Đã clone “{{name}}”.", { name: clone.name }));
    return clone;
  };

  /**
   * Gợi ý AI 10 phụ kiện trên người → tab Vật phẩm + gắn character.propNames.
   */
  const handleSuggestCharacterProps = async (character: FilmCharacterRecord) => {
    if (!project) return;
    if (!customer) {
      toast.warn(t("Vui lòng đăng nhập để dùng AI."));
      return;
    }
    const aiStatus = await refreshAiKeysStatus();
    if (!aiStatus.hasAnyAi) {
      openAiKeysDialog();
      toast.warn(t("Thêm API Key trước khi gợi ý vật phẩm."));
      return;
    }

    const originalContent =
      activeEpisode?.originalContent?.trim() ||
      episodes.map((e) => e.originalContent || "").find((c) => c.trim()) ||
      "";
    if (!originalContent.trim()) {
      toast.warn(
        t("Chưa có nội dung gốc. Thêm nội dung ở tab Nội dung gốc rồi thử lại.")
      );
      return;
    }

    try {
      const language = await getFilmOutputLanguage();
      const result = await suggestFilmCharacterProps({
        projectName: project.name,
        originalContent,
        characterName: character.name,
        characterRole: character.role,
        characterDescription: character.description,
        clothingAccessories: character.clothingAccessories,
        language,
      });

      const now = new Date().toISOString();
      let nextProps = [...propsList];
      let sortBase = nextProps.length;
      const linkedNames: string[] = [];

      for (const item of result.props) {
        const name = item.name.trim();
        if (!name) continue;
        linkedNames.push(name);
        const key = name.toLowerCase();
        const existingIdx = nextProps.findIndex(
          (p) => p.name.trim().toLowerCase() === key
        );
        if (existingIdx >= 0) {
          const old = nextProps[existingIdx];
          const updated: FilmPropRecord = {
            ...old,
            description: item.description || old.description || "",
            category: old.category || "clothing",
            imagePrompt:
              old.imagePrompt?.trim() ||
              buildFilmPropImagePrompt(
                {
                  name,
                  description: item.description || old.description || "",
                },
                project.propImagePromptTemplate
              ),
            updatedAt: now,
          };
          await putFilmProp(updated);
          nextProps = nextProps.map((p, i) => (i === existingIdx ? updated : p));
        } else {
          const empty = createEmptyFilmProp(project.id, sortBase++, name);
          const created: FilmPropRecord = {
            ...empty,
            category: "clothing",
            description: item.description || "",
            imagePrompt: buildFilmPropImagePrompt(
              { name, description: item.description || "" },
              project.propImagePromptTemplate
            ),
            updatedAt: now,
          };
          await putFilmProp(created);
          nextProps = [...nextProps, created];
        }
      }

      setPropsList(nextProps);

      const prevNames = character.propNames || [];
      const mergedNames: string[] = [];
      const seen = new Set<string>();
      for (const n of [...prevNames, ...linkedNames]) {
        const tName = n.trim();
        if (!tName) continue;
        const k = tName.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        mergedNames.push(tName);
      }

      const charNext: FilmCharacterRecord = {
        ...character,
        propNames: mergedNames,
        updatedAt: now,
      };
      await putFilmCharacter(charNext);
      setCharacters((prev) => prev.map((c) => (c.id === charNext.id ? charNext : c)));

      toast.success(
        t("Đã gợi ý {{count}} vật phẩm cho {{name}}.", {
          count: linkedNames.length,
          name: character.name,
        })
      );
    } catch (err: any) {
      console.error("[Film] suggest character props failed:", err);
      toast.error(err?.message || t("Gợi ý vật phẩm thất bại."));
    }
  };

  /** Thêm vật phẩm thủ công + gắn character.propNames */
  const handleAddCharacterProp = async (input: {
    character: FilmCharacterRecord;
    name: string;
    description: string;
  }) => {
    if (!project) return;
    const name = input.name.trim();
    if (!name) {
      toast.warn(t("Nhập tên vật phẩm."));
      return;
    }
    const description = (input.description || "").trim();
    const now = new Date().toISOString();
    const key = name.toLowerCase();
    const existing = propsList.find((p) => p.name.trim().toLowerCase() === key);

    if (existing) {
      const updated: FilmPropRecord = {
        ...existing,
        description: description || existing.description || "",
        category: existing.category || "clothing",
        imagePrompt:
          existing.imagePrompt?.trim() ||
          buildFilmPropImagePrompt(
            {
              name,
              description: description || existing.description || "",
            },
            project.propImagePromptTemplate
          ),
        updatedAt: now,
      };
      await putFilmProp(updated);
      setPropsList((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
    } else {
      const empty = createEmptyFilmProp(project.id, propsList.length, name);
      const created: FilmPropRecord = {
        ...empty,
        category: "clothing",
        description,
        imagePrompt: buildFilmPropImagePrompt(
          { name, description },
          project.propImagePromptTemplate
        ),
        updatedAt: now,
      };
      await putFilmProp(created);
      setPropsList((prev) => [...prev, created]);
    }

    const character =
      characters.find((c) => c.id === input.character.id) || input.character;
    const prevNames = character.propNames || [];
    const alreadyLinked = prevNames.some(
      (n) => n.trim().toLowerCase() === key
    );
    if (!alreadyLinked) {
      const charNext: FilmCharacterRecord = {
        ...character,
        propNames: [...prevNames, name],
        updatedAt: now,
      };
      await putFilmCharacter(charNext);
      setCharacters((prev) =>
        prev.map((c) => (c.id === charNext.id ? charNext : c))
      );
    }

    toast.success(t("Đã thêm vật phẩm “{{name}}”.", { name }));
  };

  const mergePropNames = (prev: string[] | undefined, names: string[]): string[] => {
    const out = [...(prev || [])];
    const seen = new Set(out.map((n) => n.trim().toLowerCase()).filter(Boolean));
    for (const raw of names) {
      const n = raw.trim();
      const k = n.toLowerCase();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(n);
    }
    return out;
  };

  const materializeCatalogAsPropNames = async (
    items: FilmCatalogPickItem[]
  ): Promise<string[]> => {
    if (!project) return [];
    let nextProps = [...propsList];
    const names: string[] = [];
    const now = new Date().toISOString();
    const epIds = activeEpisode ? [activeEpisode.id] : episodes.map((e) => e.id);

    for (const item of items) {
      if (item.kind === "prop") {
        const p = nextProps.find((x) => x.id === item.id);
        const name = (p?.name || item.name).trim();
        if (name) names.push(name);
        continue;
      }
      const name = item.name.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const existing = nextProps.find((p) => p.name.trim().toLowerCase() === key);
      if (existing) {
        names.push(existing.name);
        continue;
      }
      const source =
        item.kind === "character"
          ? characters.find((c) => c.id === item.id)
          : sceneImages.find((s) => s.id === item.id);
      const empty = createEmptyFilmProp(project.id, nextProps.length, name, epIds);
      const created: FilmPropRecord = {
        ...empty,
        category: "other",
        description:
          source && "description" in source
            ? String(source.description || "")
            : "",
        imageUrl: source?.imageUrl,
        imageUrls: source?.imageUrls,
        imageBlob: source?.imageBlob,
        status:
          source?.imageBlob || source?.imageUrl?.trim() ? "created" : "pending",
        updatedAt: now,
      };
      await putFilmProp(created);
      nextProps = [...nextProps, created];
      names.push(created.name);
    }
    if (nextProps.length !== propsList.length) {
      setPropsList(nextProps);
    }
    return names;
  };

  const handleLinkCatalogToCharacter = async (
    character: FilmCharacterRecord,
    items: FilmCatalogPickItem[]
  ) => {
    const names = await materializeCatalogAsPropNames(items);
    if (!names.length) return;
    const latest = characters.find((c) => c.id === character.id) || character;
    const charNext: FilmCharacterRecord = {
      ...latest,
      propNames: mergePropNames(latest.propNames, names),
      updatedAt: new Date().toISOString(),
    };
    await putFilmCharacter(charNext);
    setCharacters((prev) => prev.map((c) => (c.id === charNext.id ? charNext : c)));
    toast.success(t("Đã gắn {{count}} item.", { count: names.length }));
  };

  const handleLinkCatalogToProp = async (
    prop: FilmPropRecord,
    items: FilmCatalogPickItem[]
  ) => {
    const names = await materializeCatalogAsPropNames(items);
    if (!names.length) return;
    const latest = propsList.find((p) => p.id === prop.id) || prop;
    const selfKey = latest.name.trim().toLowerCase();
    const filtered = names.filter((n) => n.trim().toLowerCase() !== selfKey);
    const propNext: FilmPropRecord = {
      ...latest,
      propNames: mergePropNames(latest.propNames, filtered),
      updatedAt: new Date().toISOString(),
    };
    await putFilmProp(propNext);
    setPropsList((prev) => prev.map((p) => (p.id === propNext.id ? propNext : p)));
    toast.success(t("Đã gắn {{count}} item.", { count: filtered.length }));
  };

  const handleLinkCatalogToLocation = async (
    item: FilmSceneImageRecord,
    items: FilmCatalogPickItem[]
  ) => {
    const names = await materializeCatalogAsPropNames(items);
    if (!names.length) return;
    const latest = sceneImages.find((s) => s.id === item.id) || item;
    const locNext: FilmSceneImageRecord = {
      ...latest,
      propNames: mergePropNames(latest.propNames, names),
      updatedAt: new Date().toISOString(),
    };
    await putFilmSceneImage(locNext);
    setSceneImages((prev) => prev.map((s) => (s.id === locNext.id ? locNext : s)));
    toast.success(t("Đã gắn {{count}} item.", { count: names.length }));
  };

  const handleMoveLinkedProp = async (input: {
    fromKind: FilmCatalogKind;
    fromId: string;
    toKind: FilmCatalogKind;
    toId: string;
    propName: string;
  }) => {
    if (input.fromKind !== input.toKind || input.fromId === input.toId) return;
    const name = input.propName.trim();
    if (!name) return;
    const key = name.toLowerCase();
    const now = new Date().toISOString();

    const strip = (names: string[] | undefined) =>
      (names || []).filter((n) => n.trim().toLowerCase() !== key);
    const add = (names: string[] | undefined) => {
      if ((names || []).some((n) => n.trim().toLowerCase() === key)) {
        return [...(names || [])];
      }
      return [...(names || []), name];
    };

    if (input.fromKind === "character") {
      const from = characters.find((c) => c.id === input.fromId);
      const to = characters.find((c) => c.id === input.toId);
      if (!from || !to) return;
      const fromNext: FilmCharacterRecord = {
        ...from,
        propNames: strip(from.propNames),
        updatedAt: now,
      };
      const toNext: FilmCharacterRecord = {
        ...to,
        propNames: add(to.propNames),
        updatedAt: now,
      };
      await putFilmCharacter(fromNext);
      await putFilmCharacter(toNext);
      setCharacters((prev) =>
        prev.map((c) =>
          c.id === fromNext.id ? fromNext : c.id === toNext.id ? toNext : c
        )
      );
      return;
    }
    if (input.fromKind === "prop") {
      const from = propsList.find((p) => p.id === input.fromId);
      const to = propsList.find((p) => p.id === input.toId);
      if (!from || !to) return;
      const fromNext: FilmPropRecord = {
        ...from,
        propNames: strip(from.propNames),
        updatedAt: now,
      };
      const toNext: FilmPropRecord = {
        ...to,
        propNames: add(to.propNames),
        updatedAt: now,
      };
      await putFilmProp(fromNext);
      await putFilmProp(toNext);
      setPropsList((prev) =>
        prev.map((p) =>
          p.id === fromNext.id ? fromNext : p.id === toNext.id ? toNext : p
        )
      );
      return;
    }
    const from = sceneImages.find((s) => s.id === input.fromId);
    const to = sceneImages.find((s) => s.id === input.toId);
    if (!from || !to) return;
    const fromNext: FilmSceneImageRecord = {
      ...from,
      propNames: strip(from.propNames),
      updatedAt: now,
    };
    const toNext: FilmSceneImageRecord = {
      ...to,
      propNames: add(to.propNames),
      updatedAt: now,
    };
    await putFilmSceneImage(fromNext);
    await putFilmSceneImage(toNext);
    setSceneImages((prev) =>
      prev.map((s) =>
        s.id === fromNext.id ? fromNext : s.id === toNext.id ? toNext : s
      )
    );
  };

  const handleUnlinkLinkedProp = async (input: {
    kind: FilmCatalogKind;
    ownerId: string;
    propName: string;
  }) => {
    const name = input.propName.trim();
    if (!name) return;
    const key = name.toLowerCase();
    const now = new Date().toISOString();
    const strip = (names: string[] | undefined) =>
      (names || []).filter((n) => n.trim().toLowerCase() !== key);

    if (input.kind === "character") {
      const from = characters.find((c) => c.id === input.ownerId);
      if (!from) return;
      const next: FilmCharacterRecord = {
        ...from,
        propNames: strip(from.propNames),
        updatedAt: now,
      };
      await putFilmCharacter(next);
      setCharacters((prev) => prev.map((c) => (c.id === next.id ? next : c)));
      return;
    }
    if (input.kind === "prop") {
      const from = propsList.find((p) => p.id === input.ownerId);
      if (!from) return;
      const next: FilmPropRecord = {
        ...from,
        propNames: strip(from.propNames),
        updatedAt: now,
      };
      await putFilmProp(next);
      setPropsList((prev) => prev.map((p) => (p.id === next.id ? next : p)));
      return;
    }
    const from = sceneImages.find((s) => s.id === input.ownerId);
    if (!from) return;
    const next: FilmSceneImageRecord = {
      ...from,
      propNames: strip(from.propNames),
      updatedAt: now,
    };
    await putFilmSceneImage(next);
    setSceneImages((prev) => prev.map((s) => (s.id === next.id ? next : s)));
  };

  /** Gợi ý 10 vật phẩm kèm cho 1 VP → propsList + prop.propNames */
  const handleSuggestPropCompanions = async (prop: FilmPropRecord) => {
    if (!project) return;
    if (!customer) {
      toast.warn(t("Vui lòng đăng nhập để dùng AI."));
      return;
    }
    if (!(await refreshAiKeysStatus()).hasAnyAi) {
      openAiKeysDialog();
      toast.warn(t("Thêm API Key trước khi gợi ý vật phẩm."));
      return;
    }
    const originalContent =
      activeEpisode?.originalContent?.trim() ||
      episodes.map((e) => e.originalContent || "").find((c) => c.trim()) ||
      "";
    if (!originalContent.trim()) {
      toast.warn(
        t("Chưa có nội dung gốc. Thêm nội dung ở tab Nội dung gốc rồi thử lại.")
      );
      return;
    }
    try {
      const language = await getFilmOutputLanguage();
      const result = await suggestFilmEntityProps({
        entityKind: "prop",
        projectName: project.name,
        originalContent,
        entityName: prop.name,
        entityMeta: String(prop.category || ""),
        entityDescription: prop.description,
        language,
      });
      const now = new Date().toISOString();
      let nextProps = [...propsList];
      let sortBase = nextProps.length;
      const linkedNames: string[] = [];
      const epIds =
        prop.episodeIds?.length
          ? [...prop.episodeIds]
          : activeEpisode
            ? [activeEpisode.id]
            : episodes.map((e) => e.id);

      for (const item of result.props) {
        const name = item.name.trim();
        if (!name) continue;
        linkedNames.push(name);
        const key = name.toLowerCase();
        const existingIdx = nextProps.findIndex(
          (p) => p.name.trim().toLowerCase() === key
        );
        if (existingIdx >= 0) {
          const old = nextProps[existingIdx];
          const updated: FilmPropRecord = {
            ...old,
            description: item.description || old.description || "",
            episodeIds:
              old.episodeIds?.length
                ? old.episodeIds
                : epIds.length
                  ? [...epIds]
                  : [],
            imagePrompt:
              old.imagePrompt?.trim() ||
              buildFilmPropImagePrompt(
                {
                  name,
                  description: item.description || old.description || "",
                },
                project.propImagePromptTemplate
              ),
            updatedAt: now,
          };
          await putFilmProp(updated);
          nextProps = nextProps.map((p, i) => (i === existingIdx ? updated : p));
        } else {
          const empty = createEmptyFilmProp(project.id, sortBase++, name, epIds);
          const created: FilmPropRecord = {
            ...empty,
            category: "prop",
            description: item.description || "",
            imagePrompt: buildFilmPropImagePrompt(
              { name, description: item.description || "" },
              project.propImagePromptTemplate
            ),
            updatedAt: now,
          };
          await putFilmProp(created);
          nextProps = [...nextProps, created];
        }
      }
      setPropsList(nextProps);

      const owner = nextProps.find((p) => p.id === prop.id) || prop;
      const prevNames = owner.propNames || [];
      const mergedNames: string[] = [];
      const seen = new Set<string>();
      for (const n of [...prevNames, ...linkedNames]) {
        const tName = n.trim();
        if (!tName || tName.toLowerCase() === owner.name.trim().toLowerCase())
          continue;
        const k = tName.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        mergedNames.push(tName);
      }
      const propNext: FilmPropRecord = {
        ...owner,
        propNames: mergedNames,
        updatedAt: now,
      };
      await putFilmProp(propNext);
      setPropsList((prev) => prev.map((p) => (p.id === propNext.id ? propNext : p)));
      toast.success(
        t("Đã gợi ý {{count}} vật phẩm kèm cho {{name}}.", {
          count: linkedNames.length,
          name: prop.name,
        })
      );
    } catch (err: any) {
      console.error("[Film] suggest prop companions failed:", err);
      toast.error(err?.message || t("Gợi ý vật phẩm thất bại."));
    }
  };

  const handleAddPropCompanion = async (input: {
    prop: FilmPropRecord;
    name: string;
    description: string;
  }) => {
    if (!project) return;
    const name = input.name.trim();
    if (!name) {
      toast.warn(t("Nhập tên vật phẩm."));
      return;
    }
    const description = (input.description || "").trim();
    const now = new Date().toISOString();
    const key = name.toLowerCase();
    const owner = propsList.find((p) => p.id === input.prop.id) || input.prop;
    const epIds =
      owner.episodeIds?.length
        ? [...owner.episodeIds]
        : activeEpisode
          ? [activeEpisode.id]
          : episodes.map((e) => e.id);
    const existing = propsList.find((p) => p.name.trim().toLowerCase() === key);
    if (existing) {
      const updated: FilmPropRecord = {
        ...existing,
        description: description || existing.description || "",
        episodeIds:
          existing.episodeIds?.length
            ? existing.episodeIds
            : epIds.length
              ? [...epIds]
              : [],
        imagePrompt:
          existing.imagePrompt?.trim() ||
          buildFilmPropImagePrompt(
            {
              name,
              description: description || existing.description || "",
            },
            project.propImagePromptTemplate
          ),
        updatedAt: now,
      };
      await putFilmProp(updated);
      setPropsList((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } else {
      const empty = createEmptyFilmProp(project.id, propsList.length, name, epIds);
      const created: FilmPropRecord = {
        ...empty,
        category: "prop",
        description,
        imagePrompt: buildFilmPropImagePrompt(
          { name, description },
          project.propImagePromptTemplate
        ),
        updatedAt: now,
      };
      await putFilmProp(created);
      setPropsList((prev) => [...prev, created]);
    }
    const prevNames = owner.propNames || [];
    if (!prevNames.some((n) => n.trim().toLowerCase() === key)) {
      const propNext: FilmPropRecord = {
        ...owner,
        propNames: [...prevNames, name],
        updatedAt: now,
      };
      await putFilmProp(propNext);
      setPropsList((prev) =>
        prev.map((p) => (p.id === propNext.id ? propNext : p))
      );
    }
    toast.success(t("Đã thêm vật phẩm “{{name}}”.", { name }));
  };

  const handleDeleteProp = async (p: FilmPropRecord) => {
    const refCount = countScenesReferencingName(scenes, "prop", p.name);
    const ok = alert.danger
      ? await alert.danger(
          t("Xóa vật phẩm"),
          t(
            "Xóa “{{name}}” sẽ gỡ khỏi tất cả phân cảnh đang gắn ({{count}} cảnh). Thao tác không hoàn tác. Tiếp tục?",
            { name: p.name, count: refCount }
          ),
          t("Xóa")
        )
      : window.confirm(
          t(
            "Xóa “{{name}}” sẽ gỡ khỏi tất cả phân cảnh đang gắn ({{count}} cảnh). Tiếp tục?",
            { name: p.name, count: refCount }
          )
        );
    if (!ok) return;

    await deleteFilmProp(p.id);
    setPropsList((prev) => {
      const stripName = p.name.trim().toLowerCase();
      return prev
        .filter((x) => x.id !== p.id)
        .map((x) => {
          const names = (x.propNames || []).filter(
            (n) => n.trim().toLowerCase() !== stripName
          );
          if (names.length === (x.propNames || []).length) return x;
          return { ...x, propNames: names, updatedAt: new Date().toISOString() };
        });
    });
    // Persist companion strip
    for (const x of propsList) {
      if (x.id === p.id) continue;
      const names = (x.propNames || []).filter(
        (n) => n.trim().toLowerCase() !== p.name.trim().toLowerCase()
      );
      if (names.length !== (x.propNames || []).length) {
        const next = {
          ...x,
          propNames: names,
          updatedAt: new Date().toISOString(),
        };
        await putFilmProp(next);
      }
    }
    setCharacters((prev) =>
      prev.map((c) => {
        const names = (c.propNames || []).filter(
          (n) => n.trim().toLowerCase() !== p.name.trim().toLowerCase()
        );
        if (names.length === (c.propNames || []).length) return c;
        const next = {
          ...c,
          propNames: names,
          updatedAt: new Date().toISOString(),
        };
        void putFilmCharacter(next);
        return next;
      })
    );
    setSceneImages((prev) =>
      prev.map((s) => {
        const names = (s.propNames || []).filter(
          (n) => n.trim().toLowerCase() !== p.name.trim().toLowerCase()
        );
        if (names.length === (s.propNames || []).length) return s;
        const next = {
          ...s,
          propNames: names,
          updatedAt: new Date().toISOString(),
        };
        void putFilmSceneImage(next);
        return next;
      })
    );

    const nextScenes = stripEntityNameFromScenes(scenes, "prop", p.name);
    const changed = nextScenes.filter((s, i) => s !== scenes[i]);
    if (changed.length) {
      setScenes(nextScenes);
      for (const s of changed) await putFilmScene(s);
    }
  };

  const handleExtractSceneImages = async () => {
    if (!project) return;
    let locations = collectLocationsFromScenes(scenes);
    if (locations.length === 0 && sceneImages.length > 0) return;
    if (locations.length === 0) {
      locations = [
        { name: "Cảnh 1", context: "Ngày" },
        { name: "Cảnh 2", context: "Tối" },
        { name: "Cảnh 3", context: "Ngày" },
        { name: "Cảnh 4", context: "Ngày" },
      ];
    }
    const ar = resolveFilmProjectAspectRatio(project.aspectRatio);
    const byName = new Map(sceneImages.map((p) => [p.name.trim().toLowerCase(), p]));
    const built = buildFilmSceneImagesFromLocations(project.id, locations).map((p, i) => {
      const old = byName.get(p.name.trim().toLowerCase());
      if (!old) {
        return {
          ...p,
          imagePrompt: buildFilmLocationImagePrompt(
            p,
            ar,
            project.locationImagePromptTemplate
          ),
        };
      }
      return {
        ...p,
        id: old.id,
        context: old.context || p.context,
        timeOfDay: old.timeOfDay || p.timeOfDay || "Daylight",
        description: old.description || p.description,
        imagePrompt:
          old.imagePrompt ||
          buildFilmLocationImagePrompt(
            {
              name: p.name,
              description: old.description || p.description,
              timeOfDay: old.timeOfDay || p.timeOfDay,
              context: old.context || p.context,
            },
            ar,
            project.locationImagePromptTemplate
          ),
        imageUrl: old.imageUrl,
        imageUrls: old.imageUrls,
        imageBlob: old.imageBlob,
        status: old.status,
        mediaJobId: old.mediaJobId,
        mediaJobProgress: old.mediaJobProgress,
        sortOrder: i,
      };
    });
    const saved = await replaceFilmSceneImagesForProject(project.id, built);
    setSceneImages(saved);
  };

  const handleSaveSceneImage = async (item: FilmSceneImageRecord) => {
    const prev = sceneImages.find((x) => x.id === item.id);
    const oldName = prev?.name?.trim() || "";
    const newName = item.name.trim();
    await syncEntityRenameAcrossProject("location", item.id, newName);
    let toSave: FilmSceneImageRecord = { ...item, name: newName };
    if (oldName && oldName.toLowerCase() !== newName.toLowerCase()) {
      const [patched] = renameEntityNameInLocations([toSave], oldName, newName);
      toSave = { ...patched, name: newName };
    }
    await putFilmSceneImage(toSave);
    setSceneImages((prevList) =>
      prevList.map((x) => (x.id === toSave.id ? toSave : x))
    );
  };

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const finishSceneImageJob = useCallback(
    (entityId: string, prompt: string, jobId: string, base: FilmSceneImageRecord) => {
      void waitFilmMediaJob<Record<string, unknown>>(jobId, (progress) => {
        setSceneImages((prev) =>
          prev.map((x) =>
            x.id === entityId && x.mediaJobId === jobId
              ? { ...x, mediaJobProgress: progress, status: "creating" }
              : x
          )
        );
      })
        .then(async (resultData) => {
          const stored = await materializeFilmImageFromJobResult(resultData);
          if (!stored.imageUrl && !stored.imageBlob) throw new Error("Không lấy được URL ảnh location");
          const url = stored.imageUrl || "";
          setSceneImages((prev) => {
            const current = prev.find((x) => x.id === entityId);
            if (!current || current.mediaJobId !== jobId) return prev;
            const done: FilmSceneImageRecord = {
              ...current,
              imagePrompt: prompt || current.imagePrompt,
              imageUrl: url,
              imageUrls: url
                ? [url, ...(current.imageUrls || []).filter((u) => u && u !== url)]
                : current.imageUrls,
              imageBlob: stored.imageBlob,
              status: "created",
              mediaJobId: undefined,
              mediaJobProgress: undefined,
              mediaError: undefined,
              updatedAt: new Date().toISOString(),
            };
            void putFilmSceneImage(done);
            return prev.map((x) => (x.id === done.id ? done : x));
          });
        })
        .catch(async (err: any) => {
          setSceneImages((prev) => {
            const current = prev.find((x) => x.id === entityId);
            if (!current || current.mediaJobId !== jobId) return prev;
            const failed: FilmSceneImageRecord = {
              ...current,
              imagePrompt: prompt || current.imagePrompt || base.imagePrompt,
              status:
                current.imageBlob || (current.imageUrl || "").trim()
                  ? "created"
                  : "failed",
              mediaJobId: undefined,
              mediaJobProgress: undefined,
              mediaError: String(err?.message || t("Tạo ảnh location thất bại")),
              updatedAt: new Date().toISOString(),
            };
            void putFilmSceneImage(failed);
            return prev.map((x) => (x.id === failed.id ? failed : x));
          });
        });
    },
    [t]
  );

  const handleStopSceneImage = useCallback(
    async (item: FilmSceneImageRecord) => {
      const latest = sceneImages.find((x) => x.id === item.id) || item;
      if (latest.status !== "creating") return;
      const jobId = latest.mediaJobId;
      markStopPending(latest.id, true);
      try {
        const stopped: FilmSceneImageRecord = {
          ...latest,
          status:
            latest.imageBlob || (latest.imageUrl || "").trim() ? "created" : "failed",
          mediaJobId: undefined,
          mediaJobProgress: undefined,
          mediaError: t("Đã dừng"),
          updatedAt: new Date().toISOString(),
        };
        setSceneImages((prev) => prev.map((x) => (x.id === stopped.id ? stopped : x)));
        await putFilmSceneImage(stopped);
        if (jobId) {
          try {
            await cancelFilmMediaJob(jobId);
          } catch {
            // ignore
          }
        }
      } finally {
        markStopPending(latest.id, false);
      }
    },
    [sceneImages, markStopPending, t]
  );

  const handleCreateSceneImage = async (input: FilmLocationImageGenerateInput) => {
    if (!project) return;
    const { item } = input;
    if (item.status === "creating" && item.mediaJobId) return;

    const propExtra = (input.propNamesInPrompt || [])
      .map((n) => n.trim())
      .filter(Boolean)
      .join("; ");
    let prompt = String(input.prompt || "").trim();
    if (!prompt) {
      prompt = buildFilmLocationImagePrompt(
        item,
        resolveFilmProjectAspectRatio(project.aspectRatio),
        project.locationImagePromptTemplate
      );
      if (propExtra) prompt = `${prompt}\nSet dressing props: ${propExtra}`;
    }

    try {
      const { jobId } = await enqueueFilmImage({
        prompt,
        images: input.images?.length ? input.images : undefined,
        aspectRatio: resolveFilmProjectAspectRatio(project.aspectRatio),
        numberOfImages: 1,
        filmProjectId: project.id,
        filmSceneImageId: item.id,
        filmAssetKind: "scene_location",
      });

      const creating: FilmSceneImageRecord = {
        ...item,
        imagePrompt: prompt,
        status: "creating",
        mediaJobId: jobId,
        mediaJobProgress: 0,
        mediaError: undefined,
        updatedAt: new Date().toISOString(),
      };
      setSceneImages((prev) => prev.map((x) => (x.id === creating.id ? creating : x)));
      await putFilmSceneImage(creating);
      finishSceneImageJob(item.id, prompt, jobId, item);
    } catch (err: any) {
      const failed: FilmSceneImageRecord = {
        ...item,
        imagePrompt: prompt,
        status: "failed",
        mediaJobId: undefined,
        mediaJobProgress: undefined,
        mediaError: String(err?.message || t("Tạo ảnh location thất bại")),
        updatedAt: new Date().toISOString(),
      };
      setSceneImages((prev) => prev.map((x) => (x.id === failed.id ? failed : x)));
      await putFilmSceneImage(failed);
    }
  };

  const handleCreateLocationWithPropRefs = async (
    input: FilmLocationImageGenerateInput
  ) => {
    if (!project) return;
    const item =
      sceneImages.find((s) => s.id === input.item.id) || input.item;
    let fromIds: FilmPropRecord[] = [];
    if (input.propIds?.length) {
      const idSet = new Set(input.propIds);
      fromIds = propsList.filter((p) => idSet.has(p.id));
    } else {
      fromIds = propsList.filter((p) =>
        (item.propNames || []).some(
          (n) => n.trim().toLowerCase() === p.name.trim().toLowerCase()
        )
      );
    }
    const withImage = fromIds.filter(
      (p) =>
        !!(p.imageBlob || p.imageUrl?.trim() || (p.imageUrls && p.imageUrls.length))
    );
    if (!withImage.length) {
      toast.warn(
        t("Chưa có ảnh vật phẩm để làm tham chiếu. Tạo ảnh vật phẩm trước.")
      );
      return;
    }
    const entities: Array<{
      imageBlob?: Blob | null;
      imageUrl?: string;
      imageUrls?: string[];
    }> = [];
    for (const p of withImage) {
      if (entities.length >= 10) break;
      entities.push(p);
    }
    const hasSelf = !!(
      item.imageBlob ||
      item.imageUrl?.trim() ||
      (item.imageUrls && item.imageUrls.length)
    );
    if (hasSelf && entities.length < 10) {
      entities.unshift(item);
      if (entities.length > 10) entities.length = 10;
    }
    const images = await collectFilmMediaImageRefs(entities, 10);
    if (!images.length) {
      toast.warn(t("Không tải được ảnh tham chiếu vật phẩm."));
      return;
    }
    const propLabels = input.propNamesInPrompt?.length
      ? input.propNamesInPrompt
      : withImage.map((p) =>
          p.description?.trim() ? `${p.name}: ${p.description.trim()}` : p.name
        );
    await handleCreateSceneImage({
      item,
      prompt: input.prompt || "",
      images,
      propIds: withImage.map((p) => p.id),
      propNamesInPrompt: propLabels,
    });
  };

  const handleSetSceneImage = async (
    item: FilmSceneImageRecord,
    image: GeneratedImageData
  ) => {
    const stored = generatedImageDataToFilmStored(image);
    if (!stored.imageUrl && !stored.imageBlob) return;
    const url = stored.imageUrl || "";
    const next: FilmSceneImageRecord = {
      ...item,
      imageUrl: url,
      imageUrls: url
        ? [url, ...(item.imageUrls || []).filter((u) => u && u !== url)]
        : item.imageUrls,
      imageBlob: stored.imageBlob,
      status: "created",
      mediaJobId: undefined,
      mediaJobProgress: undefined,
      mediaError: undefined,
      updatedAt: new Date().toISOString(),
    };
    setSceneImages((prev) => prev.map((x) => (x.id === next.id ? next : x)));
    await putFilmSceneImage(next);
  };

  const handleBulkCreateSceneImages = async () => {
    if (!project) return;
    const targets = sceneImages.filter(
      (p) =>
        p.status !== "creating" &&
        p.status !== "created" &&
        !(p.imageUrl || (p.imageUrls && p.imageUrls.length) || p.imageBlob)
    );
    if (!targets.length) return;

    for (const item of targets) {
      const prompt =
        item.imagePrompt?.trim() ||
        buildFilmLocationImagePrompt(
          item,
          resolveFilmProjectAspectRatio(project.aspectRatio),
          project.locationImagePromptTemplate
        );
      try {
        await handleCreateSceneImage({ item, prompt });
      } catch {
        // tiếp tục item khác
      }
    }
  };

  /** Resume poll job đang creating trong IDB (reload / quay lại project). */
  const creatingMediaJobsKey = useMemo(() => {
    const ids: string[] = [];
    for (const c of characters) {
      if (c.status === "creating" && c.mediaJobId) ids.push(`c:${c.mediaJobId}`);
    }
    for (const p of propsList) {
      if (p.status === "creating" && p.mediaJobId) ids.push(`p:${p.mediaJobId}`);
    }
    for (const loc of sceneImages) {
      if (loc.status === "creating" && loc.mediaJobId) ids.push(`l:${loc.mediaJobId}`);
    }
    for (const s of scenes) {
      if (s.frameStatus === "creating" && s.frameMediaJobId) ids.push(`f:${s.frameMediaJobId}`);
      if (s.videoStatus === "creating" && s.videoMediaJobId) ids.push(`v:${s.videoMediaJobId}`);
    }
    return ids.sort().join("|");
  }, [characters, propsList, sceneImages, scenes]);

  useEffect(() => {
    if (loading || !project) return;
    for (const c of characters) {
      if (c.status === "creating" && c.mediaJobId && !isFilmMediaJobWatching(c.mediaJobId)) {
        finishCharacterImageJob(c.id, c.imagePrompt || "", c.mediaJobId, c);
      }
    }
    for (const p of propsList) {
      if (p.status === "creating" && p.mediaJobId && !isFilmMediaJobWatching(p.mediaJobId)) {
        finishPropImageJob(p.id, p.imagePrompt || "", p.mediaJobId, p);
      }
    }
    for (const loc of sceneImages) {
      if (loc.status === "creating" && loc.mediaJobId && !isFilmMediaJobWatching(loc.mediaJobId)) {
        finishSceneImageJob(loc.id, loc.imagePrompt || "", loc.mediaJobId, loc);
      }
    }
    for (const s of scenes) {
      if (s.frameStatus === "creating" && s.frameMediaJobId) {
        const jobId = s.frameMediaJobId;
        if (isFilmMediaJobWatching(jobId)) continue;
        void waitFilmMediaJob<Record<string, unknown>>(jobId, (progress) => {
          setScenes((prev) =>
            prev.map((x) =>
              x.id === s.id && x.frameMediaJobId === jobId
                ? { ...x, frameMediaProgress: progress, frameStatus: "creating" }
                : x
            )
          );
        })
          .then(async (resultData) => {
            const stored = await materializeFilmImageFromJobResult(resultData);
            setScenes((prev) => {
              const current = prev.find((x) => x.id === s.id);
              if (!current || current.frameMediaJobId !== jobId) return prev;
              const done: FilmSceneRecord = {
                ...current,
                frameImageUrl: stored.imageUrl || current.frameImageUrl || "",
                frameImageBlob: stored.imageBlob,
                frameStatus: "ready",
                mediaStatus: "ready",
                frameMediaJobId: undefined,
                frameMediaProgress: undefined,
                frameError: undefined,
                updatedAt: new Date().toISOString(),
              };
              void putFilmScene(done);
              return prev.map((x) => (x.id === done.id ? done : x));
            });
          })
          .catch(async (err: any) => {
            setScenes((prev) => {
              const current = prev.find((x) => x.id === s.id);
              if (!current || current.frameMediaJobId !== jobId) return prev;
              const hasFrame =
                !!(current.frameImageBlob instanceof Blob && current.frameImageBlob.size > 0) ||
                !!(current.frameImageUrl || "").trim();
              const failed: FilmSceneRecord = {
                ...current,
                frameStatus: hasFrame ? "ready" : "error",
                mediaStatus: hasFrame ? "ready" : current.mediaStatus,
                frameMediaJobId: undefined,
                frameMediaProgress: undefined,
                frameError: String(err?.message || t("Tạo ảnh cảnh quay thất bại")),
                updatedAt: new Date().toISOString(),
              };
              void putFilmScene(failed);
              return prev.map((x) => (x.id === failed.id ? failed : x));
            });
          });
      }
      if (s.videoStatus === "creating" && s.videoMediaJobId) {
        const jobId = s.videoMediaJobId;
        if (isFilmMediaJobWatching(jobId)) continue;
        void waitFilmMediaJob<Record<string, unknown>>(jobId, (progress) => {
          setScenes((prev) =>
            prev.map((x) =>
              x.id === s.id && x.videoMediaJobId === jobId
                ? { ...x, videoMediaProgress: progress, videoStatus: "creating" }
                : x
            )
          );
        })
          .then(async (resultData) => {
            const stored = await materializeFilmVideoFromJobResult(resultData);
            if (!stored.videoUrl && !stored.videoBlob) {
              throw new Error("Job film không trả về video");
            }
            setScenes((prev) => {
              const current = prev.find((x) => x.id === s.id);
              if (!current || current.videoMediaJobId !== jobId) return prev;
              const done: FilmSceneRecord = {
                ...current,
                videoUrl: stored.videoUrl || current.videoUrl || "",
                videoBlob: stored.videoBlob || current.videoBlob,
                videoStatus: "ready",
                videoMediaJobId: undefined,
                videoMediaProgress: undefined,
                videoError: undefined,
                updatedAt: new Date().toISOString(),
              };
              void putFilmScene(done);
              return prev.map((x) => (x.id === done.id ? done : x));
            });
          })
          .catch(async (err: any) => {
            setScenes((prev) => {
              const current = prev.find((x) => x.id === s.id);
              if (!current || current.videoMediaJobId !== jobId) return prev;
              const hasVideo =
                !!(current.videoUrl || "").trim() ||
                !!(current.videoBlob && current.videoBlob.size > 0);
              const failed: FilmSceneRecord = {
                ...current,
                videoStatus: hasVideo ? "ready" : "error",
                videoMediaJobId: undefined,
                videoMediaProgress: undefined,
                videoError: String(err?.message || t("Tạo video thất bại")),
                updatedAt: new Date().toISOString(),
              };
              void putFilmScene(failed);
              return prev.map((x) => (x.id === failed.id ? failed : x));
            });
          });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resume theo load + job ids đang creating
  }, [
    loading,
    project?.id,
    creatingMediaJobsKey,
    finishCharacterImageJob,
    finishPropImageJob,
    finishSceneImageJob,
    t,
  ]);

  const handleAddSceneImage = async (name?: string) => {
    if (!project) return;
    const label = (name || "").trim() || `Bối cảnh ${sceneImages.length + 1}`;
    const episodeIds = activeEpisode
      ? [activeEpisode.id]
      : episodes.map((e) => e.id).filter(Boolean);
    const empty = createEmptyFilmSceneImage(
      project.id,
      sceneImages.length,
      label,
      episodeIds
    );
    await putFilmSceneImage(empty);
    setSceneImages((prev) => [...prev, empty]);
    return empty;
  };

  const ensureLocationsByNames = async (
    names: string[],
    opts?: {
      source?: FilmSceneImageRecord[];
      projectId?: string;
      episodeIdsByKey?: Map<string, string[]>;
    }
  ) => {
    const projectId = opts?.projectId || project?.id;
    if (!projectId) return opts?.source ?? sceneImages;
    const episodeId = activeEpisode?.id;
    let list = [...(opts?.source ?? sceneImages)];
    let sortBase = list.length;
    const created: FilmSceneImageRecord[] = [];
    const updated: FilmSceneImageRecord[] = [];
    const now = new Date().toISOString();

    const tagEps = (key: string, current?: string[]) => {
      const extra = opts?.episodeIdsByKey?.get(key) || [];
      const next = new Set([...(current || []), ...extra].filter(Boolean));
      if (episodeId) next.add(episodeId);
      return Array.from(next);
    };

    for (const raw of names) {
      const n = raw.trim();
      if (!n) continue;
      const k = n.toLowerCase();
      const existing = list.find((s) => s.name.trim().toLowerCase() === k);
      if (existing) {
        const episodeIds = tagEps(k, existing.episodeIds);
        const same =
          episodeIds.length === (existing.episodeIds || []).length &&
          episodeIds.every((id) => (existing.episodeIds || []).includes(id));
        if (!same) {
          const next: FilmSceneImageRecord = {
            ...existing,
            episodeIds,
            updatedAt: now,
          };
          await putFilmSceneImage(next);
          updated.push(next);
          list = list.map((s) => (s.id === next.id ? next : s));
        }
        continue;
      }
      if (created.some((s) => s.name.trim().toLowerCase() === k)) continue;
      const episodeIds = tagEps(
        k,
        episodeId ? [episodeId] : episodes.map((e) => e.id)
      );
      const empty = createEmptyFilmSceneImage(
        projectId,
        sortBase++,
        n,
        episodeIds.length ? episodeIds : episodes.map((e) => e.id)
      );
      await putFilmSceneImage(empty);
      created.push(empty);
      list = [...list, empty];
    }

    if (created.length || updated.length) {
      setSceneImages(list);
    }
    return list;
  };

  const syncMissingEntitiesFromScenes = async (
    sceneList: FilmSceneRecord[],
    opts?: {
      projectId?: string;
      characters?: FilmCharacterRecord[];
      props?: FilmPropRecord[];
      locations?: FilmSceneImageRecord[];
    }
  ) => {
    const idx = indexFilmSceneAttachNames(sceneList);
    const charKeys = new Map(
      Array.from(idx.characters.entries()).map(([k, v]) => [k, v.episodeIds])
    );
    const propKeys = new Map(
      Array.from(idx.props.entries()).map(([k, v]) => [k, v.episodeIds])
    );
    const locKeys = new Map(
      Array.from(idx.locations.entries()).map(([k, v]) => [k, v.episodeIds])
    );
    const common = { projectId: opts?.projectId };
    const nextChars = await ensureCharactersByNames(
      Array.from(idx.characters.values()).map((x) => x.name),
      { ...common, source: opts?.characters, episodeIdsByKey: charKeys }
    );
    const nextProps = await ensurePropsByNames(
      Array.from(idx.props.values()).map((x) => x.name),
      { ...common, source: opts?.props, episodeIdsByKey: propKeys }
    );
    const nextLocs = await ensureLocationsByNames(
      Array.from(idx.locations.values()).map((x) => x.name),
      { ...common, source: opts?.locations, episodeIdsByKey: locKeys }
    );
    return {
      characters: nextChars,
      props: nextProps,
      locations: nextLocs,
    };
  };

  const handleCloneLocation = async (item: FilmSceneImageRecord) => {
    if (!project) return;
    const name = nextFilmLocationCloneName(
      item.name,
      sceneImages.map((x) => x.name)
    );
    const now = new Date().toISOString();
    const clone: FilmSceneImageRecord = {
      ...item,
      id: createFilmId("loc"),
      name,
      propNames: [...(item.propNames || [])],
      episodeIds: [...(item.episodeIds || [])],
      imageUrls: item.imageUrls ? [...item.imageUrls] : [],
      status:
        item.imageBlob || item.imageUrl || (item.imageUrls && item.imageUrls.length)
          ? item.status || "created"
          : "pending",
      mediaJobId: undefined,
      mediaJobProgress: undefined,
      mediaError: undefined,
      sortOrder: sceneImages.length,
      createdAt: now,
      updatedAt: now,
    };
    await putFilmSceneImage(clone);
    setSceneImages((prev) => [...prev, clone]);
    toast.success(t("Đã clone “{{name}}”.", { name: clone.name }));
    return clone;
  };

  const handleSuggestLocationProps = async (item: FilmSceneImageRecord) => {
    if (!project) return;
    if (!customer) {
      toast.warn(t("Vui lòng đăng nhập để dùng AI."));
      return;
    }
    if (!(await refreshAiKeysStatus()).hasAnyAi) {
      openAiKeysDialog();
      toast.warn(t("Thêm API Key trước khi gợi ý vật phẩm."));
      return;
    }
    const originalContent =
      activeEpisode?.originalContent?.trim() ||
      episodes.map((e) => e.originalContent || "").find((c) => c.trim()) ||
      "";
    if (!originalContent.trim()) {
      toast.warn(
        t("Chưa có nội dung gốc. Thêm nội dung ở tab Nội dung gốc rồi thử lại.")
      );
      return;
    }
    try {
      const language = await getFilmOutputLanguage();
      const result = await suggestFilmEntityProps({
        entityKind: "location",
        projectName: project.name,
        originalContent,
        entityName: item.name,
        entityMeta: [item.timeOfDay, item.context].filter(Boolean).join(" · "),
        entityDescription: item.description,
        language,
      });
      const now = new Date().toISOString();
      let nextProps = [...propsList];
      let sortBase = nextProps.length;
      const linkedNames: string[] = [];
      const epIds =
        item.episodeIds?.length
          ? [...item.episodeIds]
          : activeEpisode
            ? [activeEpisode.id]
            : episodes.map((e) => e.id);

      for (const row of result.props) {
        const name = row.name.trim();
        if (!name) continue;
        linkedNames.push(name);
        const key = name.toLowerCase();
        const existingIdx = nextProps.findIndex(
          (p) => p.name.trim().toLowerCase() === key
        );
        if (existingIdx >= 0) {
          const old = nextProps[existingIdx];
          const updated: FilmPropRecord = {
            ...old,
            description: row.description || old.description || "",
            episodeIds:
              old.episodeIds?.length
                ? old.episodeIds
                : epIds.length
                  ? [...epIds]
                  : [],
            imagePrompt:
              old.imagePrompt?.trim() ||
              buildFilmPropImagePrompt(
                {
                  name,
                  description: row.description || old.description || "",
                },
                project.propImagePromptTemplate
              ),
            updatedAt: now,
          };
          await putFilmProp(updated);
          nextProps = nextProps.map((p, i) => (i === existingIdx ? updated : p));
        } else {
          const empty = createEmptyFilmProp(project.id, sortBase++, name, epIds);
          const created: FilmPropRecord = {
            ...empty,
            category: "prop",
            description: row.description || "",
            imagePrompt: buildFilmPropImagePrompt(
              { name, description: row.description || "" },
              project.propImagePromptTemplate
            ),
            updatedAt: now,
          };
          await putFilmProp(created);
          nextProps = [...nextProps, created];
        }
      }
      setPropsList(nextProps);

      const owner =
        sceneImages.find((s) => s.id === item.id) || item;
      const prevNames = owner.propNames || [];
      const mergedNames: string[] = [];
      const seen = new Set<string>();
      for (const n of [...prevNames, ...linkedNames]) {
        const tName = n.trim();
        if (!tName) continue;
        const k = tName.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        mergedNames.push(tName);
      }
      const locNext: FilmSceneImageRecord = {
        ...owner,
        propNames: mergedNames,
        updatedAt: now,
      };
      await putFilmSceneImage(locNext);
      setSceneImages((prev) =>
        prev.map((s) => (s.id === locNext.id ? locNext : s))
      );
      toast.success(
        t("Đã gợi ý {{count}} vật phẩm cho bối cảnh {{name}}.", {
          count: linkedNames.length,
          name: item.name,
        })
      );
    } catch (err: any) {
      console.error("[Film] suggest location props failed:", err);
      toast.error(err?.message || t("Gợi ý vật phẩm thất bại."));
    }
  };

  const handleAddLocationProp = async (input: {
    item: FilmSceneImageRecord;
    name: string;
    description: string;
  }) => {
    if (!project) return;
    const name = input.name.trim();
    if (!name) {
      toast.warn(t("Nhập tên vật phẩm."));
      return;
    }
    const description = (input.description || "").trim();
    const now = new Date().toISOString();
    const key = name.toLowerCase();
    const owner =
      sceneImages.find((s) => s.id === input.item.id) || input.item;
    const epIds =
      owner.episodeIds?.length
        ? [...owner.episodeIds]
        : activeEpisode
          ? [activeEpisode.id]
          : episodes.map((e) => e.id);
    const existing = propsList.find((p) => p.name.trim().toLowerCase() === key);
    if (existing) {
      const updated: FilmPropRecord = {
        ...existing,
        description: description || existing.description || "",
        episodeIds:
          existing.episodeIds?.length
            ? existing.episodeIds
            : epIds.length
              ? [...epIds]
              : [],
        imagePrompt:
          existing.imagePrompt?.trim() ||
          buildFilmPropImagePrompt(
            {
              name,
              description: description || existing.description || "",
            },
            project.propImagePromptTemplate
          ),
        updatedAt: now,
      };
      await putFilmProp(updated);
      setPropsList((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } else {
      const empty = createEmptyFilmProp(project.id, propsList.length, name, epIds);
      const created: FilmPropRecord = {
        ...empty,
        category: "prop",
        description,
        imagePrompt: buildFilmPropImagePrompt(
          { name, description },
          project.propImagePromptTemplate
        ),
        updatedAt: now,
      };
      await putFilmProp(created);
      setPropsList((prev) => [...prev, created]);
    }
    const prevNames = owner.propNames || [];
    if (!prevNames.some((n) => n.trim().toLowerCase() === key)) {
      const locNext: FilmSceneImageRecord = {
        ...owner,
        propNames: [...prevNames, name],
        updatedAt: now,
      };
      await putFilmSceneImage(locNext);
      setSceneImages((prev) =>
        prev.map((s) => (s.id === locNext.id ? locNext : s))
      );
    }
    toast.success(t("Đã thêm vật phẩm “{{name}}”.", { name }));
  };

  const handleDeleteSceneImage = async (item: FilmSceneImageRecord) => {
    const refCount = countScenesReferencingName(scenes, "location", item.name);
    const ok = alert.danger
      ? await alert.danger(
          t("Xóa bối cảnh"),
          t(
            "Xóa “{{name}}” sẽ gỡ khỏi tất cả phân cảnh đang gắn ({{count}} cảnh). Thao tác không hoàn tác. Tiếp tục?",
            { name: item.name, count: refCount }
          ),
          t("Xóa")
        )
      : window.confirm(
          t(
            "Xóa “{{name}}” sẽ gỡ khỏi tất cả phân cảnh đang gắn ({{count}} cảnh). Tiếp tục?",
            { name: item.name, count: refCount }
          )
        );
    if (!ok) return;

    await deleteFilmSceneImage(item.id);
    setSceneImages((prev) => prev.filter((x) => x.id !== item.id));

    const nextScenes = stripEntityNameFromScenes(scenes, "location", item.name);
    const changed = nextScenes.filter((s, i) => s !== scenes[i]);
    if (changed.length) {
      setScenes(nextScenes);
      for (const s of changed) await putFilmScene(s);
    }
  };

  const handleCreateShotFrame = async (input: FilmShotFrameGenerateInput) => {
    if (!project) return;
    const scene =
      scenes.find((s) => s.id === input.scene.id) || input.scene;
    if (scene.frameStatus === "creating" && scene.frameMediaJobId) return;

    const activePrompt =
      String(input.prompt || "").trim() ||
      resolveFilmShotFrameActivePrompt(scene, project.storyboardImagePrompt);

    // Chỉ ghi imagePrompt chính khi đang gen bằng prompt phân cảnh (không phải đề xuất)
    const usingSuggested =
      scene.framePromptSource !== "main" &&
      !!String(scene.frameSuggestedPrompt || "").trim() &&
      activePrompt === String(scene.frameSuggestedPrompt || "").trim();
    const mainImagePrompt = usingSuggested
      ? scene.imagePrompt
      : activePrompt || scene.imagePrompt;

    if (!activePrompt.trim()) {
      const failed: FilmSceneRecord = {
        ...scene,
        frameStatus: "error",
        frameError: t("Thiếu Prompt ảnh của phân cảnh."),
        updatedAt: new Date().toISOString(),
      };
      setScenes((prev) => prev.map((x) => (x.id === failed.id ? failed : x)));
      await putFilmScene(failed);
      return;
    }

    const attachCheck = checkFilmSceneAttachmentsForMedia(
      scene,
      characters,
      propsList,
      sceneImages
    );
    if (attachCheck.ok === false) {
      const failed: FilmSceneRecord = {
        ...scene,
        imagePrompt: mainImagePrompt,
        frameStatus: "error",
        frameError: attachCheck.message,
        updatedAt: new Date().toISOString(),
      };
      setScenes((prev) => prev.map((x) => (x.id === failed.id ? failed : x)));
      await putFilmScene(failed);
      return;
    }

    // Ref: Gắn Cảnh → NV → VP (tối đa 10) → Image API
    const attachEntities = collectFilmSceneAttachImageEntities(
      scene,
      characters,
      propsList,
      sceneImages,
      FILM_SCENE_ATTACH_IMAGE_LIMIT
    );
    if (!attachEntities.length) {
      const failed: FilmSceneRecord = {
        ...scene,
        imagePrompt: mainImagePrompt,
        frameStatus: "error",
        frameError: t(
          "Không có ảnh tham chiếu. Gắn Cảnh/NV/VP đã có ảnh rồi tạo lại."
        ),
        updatedAt: new Date().toISOString(),
      };
      setScenes((prev) => prev.map((x) => (x.id === failed.id ? failed : x)));
      await putFilmScene(failed);
      return;
    }

    const images = await collectFilmMediaImageRefs(
      attachEntities,
      FILM_SCENE_ATTACH_IMAGE_LIMIT
    );
    if (!images.length) {
      const failed: FilmSceneRecord = {
        ...scene,
        imagePrompt: mainImagePrompt,
        frameStatus: "error",
        frameError: t("Không tải được ảnh tham chiếu gắn trên phân cảnh."),
        updatedAt: new Date().toISOString(),
      };
      setScenes((prev) => prev.map((x) => (x.id === failed.id ? failed : x)));
      await putFilmScene(failed);
      return;
    }

    const aspectRatio = resolveFilmProjectAspectRatio(project.aspectRatio);

    try {
      const { jobId } = await enqueueFilmImage({
        prompt: appendFilmSingleFrameImageConstraint(activePrompt),
        images,
        aspectRatio,
        numberOfImages: 1,
        filmProjectId: project.id,
        filmEpisodeId: scene.episodeId,
        filmSceneId: scene.id,
        filmAssetKind: "shot_frame",
      });

      const creating: FilmSceneRecord = {
        ...scene,
        imagePrompt: mainImagePrompt,
        frameStatus: "creating",
        mediaStatus: "pending",
        frameMediaJobId: jobId,
        frameMediaProgress: 0,
        frameError: undefined,
        updatedAt: new Date().toISOString(),
      };
      setScenes((prev) => prev.map((x) => (x.id === creating.id ? creating : x)));
      await putFilmScene(creating);

      void waitFilmMediaJob<Record<string, unknown>>(jobId, (progress) => {
        setScenes((prev) =>
          prev.map((x) =>
            x.id === scene.id && x.frameMediaJobId === jobId
              ? {
                  ...x,
                  frameMediaProgress: progress,
                  frameStatus: "creating",
                }
              : x
          )
        );
      })
        .then(async (resultData) => {
          const stored = await materializeFilmImageFromJobResult(resultData);
          if (!stored.imageUrl && !stored.imageBlob) {
            throw new Error("Không lấy được URL ảnh");
          }
          setScenes((prev) => {
            const current = prev.find((x) => x.id === scene.id);
            if (!current || current.frameMediaJobId !== jobId) return prev;
            const done: FilmSceneRecord = {
              ...current,
              imagePrompt: mainImagePrompt ?? current.imagePrompt,
              frameImageUrl: stored.imageUrl || "",
              frameImageBlob: stored.imageBlob,
              frameStatus: "ready",
              mediaStatus: "ready",
              frameMediaJobId: undefined,
              frameMediaProgress: undefined,
              frameError: undefined,
              updatedAt: new Date().toISOString(),
            };
            void putFilmScene(done);
            return prev.map((x) => (x.id === done.id ? done : x));
          });
        })
        .catch(async (err: any) => {
          setScenes((prev) => {
            const current = prev.find((x) => x.id === scene.id);
            if (!current || current.frameMediaJobId !== jobId) return prev;
            const hasFrame =
              !!(current.frameImageBlob instanceof Blob && current.frameImageBlob.size > 0) ||
              !!(current.frameImageUrl || "").trim();
            const failed: FilmSceneRecord = {
              ...current,
              imagePrompt: mainImagePrompt ?? current.imagePrompt,
              frameStatus: hasFrame ? "ready" : "error",
              mediaStatus: hasFrame ? "ready" : current.mediaStatus,
              frameMediaJobId: undefined,
              frameMediaProgress: undefined,
              frameError: String(
                err?.message || t("Tạo ảnh cảnh quay thất bại")
              ),
              updatedAt: new Date().toISOString(),
            };
            void putFilmScene(failed);
            return prev.map((x) => (x.id === failed.id ? failed : x));
          });
        });
    } catch (err: any) {
      const failed: FilmSceneRecord = {
        ...scene,
        imagePrompt: mainImagePrompt,
        frameStatus: "error",
        frameMediaJobId: undefined,
        frameMediaProgress: undefined,
        frameError: String(err?.message || t("Tạo ảnh cảnh quay thất bại")),
        updatedAt: new Date().toISOString(),
      };
      setScenes((prev) => prev.map((x) => (x.id === failed.id ? failed : x)));
      await putFilmScene(failed);
    }
  };

  const handleStopShotFrame = useCallback(
    async (scene: FilmSceneRecord) => {
      const latest = scenes.find((s) => s.id === scene.id) || scene;
      if (latest.frameStatus !== "creating") return;
      const jobId = latest.frameMediaJobId;
      markStopPending(latest.id, true);
      try {
        const hasFrame =
          !!(latest.frameImageBlob instanceof Blob && latest.frameImageBlob.size > 0) ||
          !!(latest.frameImageUrl || "").trim();
        const stopped: FilmSceneRecord = {
          ...latest,
          frameStatus: hasFrame ? "ready" : "error",
          mediaStatus: hasFrame ? "ready" : latest.mediaStatus,
          frameMediaJobId: undefined,
          frameMediaProgress: undefined,
          frameError: t("Đã dừng"),
          updatedAt: new Date().toISOString(),
        };
        setScenes((prev) => prev.map((x) => (x.id === stopped.id ? stopped : x)));
        await putFilmScene(stopped);
        if (jobId) {
          try {
            await cancelFilmMediaJob(jobId);
          } catch {
            // ignore
          }
        }
      } finally {
        markStopPending(latest.id, false);
      }
    },
    [scenes, markStopPending, t]
  );

  const handleSetShotFrameImage = async (
    scene: FilmSceneRecord,
    image: GeneratedImageData
  ) => {
    const stored = generatedImageDataToFilmStored(image);
    if (!stored.imageUrl && !stored.imageBlob) return;
    const next: FilmSceneRecord = {
      ...scene,
      frameImageUrl: stored.imageUrl || scene.frameImageUrl || "",
      frameImageBlob: stored.imageBlob,
      frameStatus: "ready",
      mediaStatus: "ready",
      frameError: undefined,
      frameMediaJobId: undefined,
      frameMediaProgress: undefined,
      updatedAt: new Date().toISOString(),
    };
    setScenes((prev) => prev.map((x) => (x.id === next.id ? next : x)));
    await putFilmScene(next);
  };

  const handleSetSceneVideo = async (
    scene: FilmSceneRecord,
    video: {
      videoUri?: string | null;
      videoBytes?: string | null;
      mediaBlob?: Blob;
      previewUrl?: string;
      mimeType?: string;
    }
  ) => {
    const stored = generatedVideoDataToFilmStored(video);
    if (!stored.videoUrl && !stored.videoBlob) return;
    const next: FilmSceneRecord = {
      ...scene,
      videoUrl: stored.videoUrl || (stored.videoBlob ? "" : scene.videoUrl || ""),
      videoBlob: stored.videoBlob,
      videoStatus: "ready",
      videoError: undefined,
      videoMediaJobId: undefined,
      videoMediaProgress: undefined,
      updatedAt: new Date().toISOString(),
    };
    setScenes((prev) => prev.map((x) => (x.id === next.id ? next : x)));
    await putFilmScene(next);
  };

  const handleSuggestSafeShotFramePrompt = async (scene: FilmSceneRecord) => {
    const latest = scenes.find((s) => s.id === scene.id) || scene;
    if (latest.frameSuggestStatus === "loading") return;

    const loading: FilmSceneRecord = {
      ...latest,
      frameSuggestStatus: "loading",
      frameSuggestError: undefined,
      updatedAt: new Date().toISOString(),
    };
    setScenes((prev) => prev.map((x) => (x.id === loading.id ? loading : x)));
    await putFilmScene(loading);

    try {
      const out = await rewriteFilmShotFramePrompt({
        prompt: latest.imagePrompt,
        visualDescription: latest.visualDescription,
        atmosphere: latest.atmosphere,
        action: latest.action,
        shotSize: latest.shotSize,
        cameraAngle: latest.cameraAngle,
        summary: latest.summary,
        storyboardImagePrompt: project?.storyboardImagePrompt,
        errorMessage: latest.frameError,
        sceneTitle: latest.title || latest.summary || "",
        characterNames: latest.characterNames || [],
        propNames: latest.propNames || [],
        locationNames: latest.locationNames || (latest.sceneTag ? [latest.sceneTag] : []),
        language: "Vietnamese",
      });

      const done: FilmSceneRecord = {
        ...latest,
        frameSuggestedPrompt: out.rewrittenPrompt,
        frameSuggestSummary: out.changesSummary,
        framePromptSource: "suggested",
        frameSuggestStatus: "ready",
        frameSuggestError: undefined,
        updatedAt: new Date().toISOString(),
      };
      setScenes((prev) => prev.map((x) => (x.id === done.id ? done : x)));
      await putFilmScene(done);
      toast.success(t("Đã có prompt đề xuất — mặc định dùng để gen ảnh."));
    } catch (err: any) {
      const failed: FilmSceneRecord = {
        ...latest,
        frameSuggestStatus: "error",
        frameSuggestError: String(
          err?.message || t("Gợi ý prompt thất bại")
        ),
        updatedAt: new Date().toISOString(),
      };
      setScenes((prev) => prev.map((x) => (x.id === failed.id ? failed : x)));
      await putFilmScene(failed);
      toast.error(failed.frameSuggestError || t("Gợi ý prompt thất bại"));
    }
  };

  const handleFramePromptSourceChange = async (
    scene: FilmSceneRecord,
    source: "main" | "suggested"
  ) => {
    const latest = scenes.find((s) => s.id === scene.id) || scene;
    if (source === "suggested" && !String(latest.frameSuggestedPrompt || "").trim()) {
      return;
    }
    const next: FilmSceneRecord = {
      ...latest,
      framePromptSource: source,
      updatedAt: new Date().toISOString(),
    };
    setScenes((prev) => prev.map((x) => (x.id === next.id ? next : x)));
    await putFilmScene(next);
  };

  const handleBulkCreateShotFrames = async () => {
    const targets = scenes.filter(
      (s) => !sceneFrameReady(s) && s.frameStatus !== "creating"
    );
    if (!targets.length) return;

    for (const s of targets) {
      const prompt = resolveFilmShotFrameActivePrompt(
        s,
        project?.storyboardImagePrompt
      );
      try {
        await handleCreateShotFrame({ scene: s, prompt });
      } catch {
        // tiếp tục scene khác
      }
    }
  };

  const handleCreateVideo = async (scene: FilmSceneRecord) => {
    if (!project) return;
    const latest = scenes.find((s) => s.id === scene.id) || scene;
    if (latest.videoStatus === "creating" && latest.videoMediaJobId) return;

    const prompt = resolveFilmSceneVideoPrompt(
      latest,
      project.storyboardVideoPrompt
    );
    if (!prompt) {
      const failed: FilmSceneRecord = {
        ...latest,
        videoStatus: "error",
        videoError: t("Thiếu Prompt video của cảnh quay."),
        updatedAt: new Date().toISOString(),
      };
      setScenes((prev) => prev.map((x) => (x.id === failed.id ? failed : x)));
      await putFilmScene(failed);
      toast.error(t("Thiếu Prompt video của cảnh quay."));
      return;
    }

    const mode = videoRefMode;
    const maxSlots = FILM_VIDEO_REF_SLOT_COUNT[mode];
    const slots = padVideoRefSlots(latest.videoRefSlots, mode);
    const images = await collectFilmVideoRefSlotImageRefs(slots, maxSlots);

    const aspectRatio = resolveFilmProjectAspectRatio(project.aspectRatio);
    const videoMode = filmVideoRefModeToFlow2(mode);
    const serviceImageType = filmVideoRefModeToServiceImageType(mode);
    const silentLipSync = !!latest.videoSilentLipSync;
    // voice chỉ gửi khi Thành phần + có ảnh + không nhép miệng im lặng; backend vẫn lọc lần nữa
    const voice =
      !silentLipSync &&
      videoMode === "component" &&
      images.length > 0
        ? resolveFilmSceneVideoVoice(latest, characters)
        : undefined;

    try {
      const { jobId } = await enqueueFilmVideo({
        prompt,
        images: images.length ? images : undefined,
        aspectRatio,
        videoMode,
        serviceImageType,
        generateAudio: silentLipSync ? false : undefined,
        voice,
        filmProjectId: project.id,
        filmEpisodeId: latest.episodeId,
        filmSceneId: latest.id,
        filmAssetKind: "shot_video",
      });

      const creating: FilmSceneRecord = {
        ...latest,
        videoStatus: "creating",
        videoMediaJobId: jobId,
        videoMediaProgress: 0,
        videoError: undefined,
        updatedAt: new Date().toISOString(),
      };
      setScenes((prev) => prev.map((x) => (x.id === creating.id ? creating : x)));
      await putFilmScene(creating);

      void waitFilmMediaJob<Record<string, unknown>>(jobId, (progress) => {
        setScenes((prev) =>
          prev.map((x) =>
            x.id === latest.id && x.videoMediaJobId === jobId
              ? {
                  ...x,
                  videoMediaProgress: progress,
                  videoStatus: "creating",
                }
              : x
          )
        );
      })
        .then(async (resultData) => {
          const stored = await materializeFilmVideoFromJobResult(resultData);
          if (!stored.videoUrl && !stored.videoBlob) {
            throw new Error("Job film không trả về video");
          }
          setScenes((prev) => {
            const current = prev.find((x) => x.id === latest.id);
            if (!current || current.videoMediaJobId !== jobId) return prev;
            const done: FilmSceneRecord = {
              ...current,
              videoUrl: stored.videoUrl || current.videoUrl || "",
              videoBlob: stored.videoBlob || current.videoBlob,
              videoStatus: "ready",
              videoMediaJobId: undefined,
              videoMediaProgress: undefined,
              videoError: undefined,
              updatedAt: new Date().toISOString(),
            };
            void putFilmScene(done);
            return prev.map((x) => (x.id === done.id ? done : x));
          });
        })
        .catch(async (err: any) => {
          setScenes((prev) => {
            const current = prev.find((x) => x.id === latest.id);
            if (!current || current.videoMediaJobId !== jobId) return prev;
            const hasVideo =
              !!(current.videoUrl || "").trim() ||
              !!(current.videoBlob && current.videoBlob.size > 0);
            const failed: FilmSceneRecord = {
              ...current,
              videoStatus: hasVideo ? "ready" : "error",
              videoMediaJobId: undefined,
              videoMediaProgress: undefined,
              videoError: String(err?.message || t("Tạo video thất bại")),
              updatedAt: new Date().toISOString(),
            };
            void putFilmScene(failed);
            return prev.map((x) => (x.id === failed.id ? failed : x));
          });
        });
    } catch (err: any) {
      const failed: FilmSceneRecord = {
        ...latest,
        videoStatus: "error",
        videoMediaJobId: undefined,
        videoMediaProgress: undefined,
        videoError: String(err?.message || t("Tạo video thất bại")),
        updatedAt: new Date().toISOString(),
      };
      setScenes((prev) => prev.map((x) => (x.id === failed.id ? failed : x)));
      await putFilmScene(failed);
      toast.error(failed.videoError || t("Tạo video thất bại"));
    }
  };

  const handleStopVideoGeneration = useCallback(
    async (scene: FilmSceneRecord) => {
      const latest = scenes.find((s) => s.id === scene.id) || scene;
      if (latest.videoStatus !== "creating") return;
      const jobId = latest.videoMediaJobId;
      markStopPending(`video:${latest.id}`, true);
      try {
        const hasVideo =
          !!(latest.videoUrl || "").trim() ||
          !!(latest.videoBlob && latest.videoBlob.size > 0);
        const stopped: FilmSceneRecord = {
          ...latest,
          videoStatus: hasVideo ? "ready" : "error",
          videoMediaJobId: undefined,
          videoMediaProgress: undefined,
          videoError: t("Đã dừng"),
          updatedAt: new Date().toISOString(),
        };
        setScenes((prev) => prev.map((x) => (x.id === stopped.id ? stopped : x)));
        await putFilmScene(stopped);
        if (jobId) {
          try {
            await cancelFilmMediaJob(jobId);
          } catch {
            // ignore
          }
        }
      } finally {
        markStopPending(`video:${latest.id}`, false);
      }
    },
    [scenes, markStopPending, t]
  );

  const handleVideoRefModeChange = useCallback(
    async (mode: FilmVideoRefMode, opts?: { rebuild?: boolean }) => {
      const rebuild = opts?.rebuild ?? false;
      if (!rebuild && !scenesNeedVideoRefSlotSeed(scenes, mode)) return;

      setVideoRefMode(mode);
      const now = new Date().toISOString();
      const next = scenes.map((s) => ({
        ...s,
        videoRefSlots: rebuild
          ? buildDefaultVideoRefSlots(s, mode)
          : ensureVideoRefSlotsFromFrame(s, mode),
        updatedAt: now,
      }));
      setScenes(next);
      for (const s of next) {
        const prev = scenes.find((x) => x.id === s.id);
        if (prev && videoRefSlotsEqual(prev.videoRefSlots, s.videoRefSlots, mode)) continue;
        try {
          await putFilmScene(s);
        } catch (e) {
          console.error("[FilmWorkspace] videoRefSlots seed failed:", e);
        }
      }
    },
    [scenes]
  );

  const handleVideoRefSlotsChange = useCallback(
    async (scene: FilmSceneRecord, slots: Array<FilmVideoRefSlot | null>) => {
      const latest = scenes.find((s) => s.id === scene.id) || scene;
      const next: FilmSceneRecord = {
        ...latest,
        videoRefSlots: slots,
        updatedAt: new Date().toISOString(),
      };
      setScenes((prev) => prev.map((x) => (x.id === next.id ? next : x)));
      await putFilmScene(next);
    },
    [scenes]
  );

  const handleBulkCreateVideos = async (mode: "all" | "errors" = "all") => {
    const targets = scenes.filter((s) => {
      if (s.videoStatus === "creating") return false;
      if (mode === "errors") return s.videoStatus === "error";
      return true;
    });
    if (!targets.length) return;

    for (const s of targets) {
      try {
        await handleCreateVideo(s);
      } catch {
        // tiếp tục scene khác
      }
    }
  };

  const refreshTextCredits = async () => {
    try {
      await loadCustomer();
    } catch {
      // ignore — credit hiển thị sẽ cập nhật lần load sau
    }
  };

  const filmVoiceAbortKey = (sceneId: string, lineId: string) => `${sceneId}:${lineId}`;

  const persistStoppedVoiceLine = (scene: FilmSceneRecord, dialogueLineId: string) => {
    const line = scene.dialogueLines?.find((l) => l.id === dialogueLineId);
    if (!line || line.voiceStatus !== "creating") return scene;
    const stopped = stopSceneDialogueVoice(scene, dialogueLineId);
    void putFilmScene(stopped);
    return stopped;
  };

  const handleCreateVoice = async (input: FilmVoiceGenerateInput) => {
    const { scene, dialogueLineId, text, voiceId, voiceLabel } = input;
    if (!dialogueLineId || !voiceId?.trim()) return;
    const trimmedText = String(text || "").trim();
    if (!trimmedText) return;

    const key = filmVoiceAbortKey(scene.id, dialogueLineId);
    voiceAbortRef.current.get(key)?.abort();
    const ac = new AbortController();
    voiceAbortRef.current.set(key, ac);

    const current = scenes.find((s) => s.id === scene.id) || scene;
    const existingLine = current.dialogueLines?.find((l) => l.id === dialogueLineId);
    const creating = patchSceneDialogueLine(current, dialogueLineId, {
      voiceId: voiceId.trim(),
      voiceLabel: voiceLabel?.trim() || voiceId.trim(),
      voiceCustom: existingLine?.voiceCustom,
      voiceStatus: "creating",
      voiceError: undefined,
    });
    setScenes((prev) => prev.map((x) => (x.id === creating.id ? creating : x)));
    await putFilmScene(creating);

    try {
      const blob = await generateFilmDialogueVoiceBlob(trimmedText, voiceId, ac.signal);
      if (ac.signal.aborted) throw new DOMException("Đã dừng", "AbortError");
      const lineAfterCreating =
        creating.dialogueLines?.find((l) => l.id === dialogueLineId) || existingLine;
      if (!lineAfterCreating) return;
      const takePatch = buildAppendDialogueVoiceTakePatch(lineAfterCreating, {
        voiceBlob: blob,
        voiceUrl: "",
        voiceId: voiceId.trim(),
        voiceLabel: voiceLabel?.trim() || voiceId.trim(),
      });
      const done = patchSceneDialogueLine(creating, dialogueLineId, takePatch);
      setScenes((prev) => prev.map((x) => (x.id === done.id ? done : x)));
      await putFilmScene(done);
      await refreshTextCredits();
    } catch (err: any) {
      if (isVoiceAbortError(err) || ac.signal.aborted) {
        setScenes((prev) =>
          prev.map((x) => (x.id === scene.id ? persistStoppedVoiceLine(x, dialogueLineId) : x))
        );
        return;
      }
      const failed = patchSceneDialogueLine(creating, dialogueLineId, {
        voiceStatus: "error",
        voiceError: String(err?.message || t("Tạo giọng thất bại")),
      });
      setScenes((prev) => prev.map((x) => (x.id === failed.id ? failed : x)));
      await putFilmScene(failed);
    } finally {
      if (voiceAbortRef.current.get(key) === ac) voiceAbortRef.current.delete(key);
    }
  };

  const handleSetDefaultVoiceTake = async (item: FilmVoiceListItem, takeId: string) => {
    const current = scenes.find((s) => s.id === item.scene.id) || item.scene;
    const line = current.dialogueLines?.find((l) => l.id === item.line.id);
    if (!line) return;
    const patch = buildSetDefaultDialogueVoiceTakePatch(line, takeId);
    if (!patch) return;
    const next = patchSceneDialogueLine(current, item.line.id, patch);
    setScenes((prev) => prev.map((x) => (x.id === next.id ? next : x)));
    await putFilmScene(next);
  };

  const handleBulkCreateVoices = async (items: FilmVoiceListItem[]) => {
    const pending = items.filter((item) => {
      if (dialogueLineReady(item.line) || dialogueLineCreating(item.line)) return false;
      if (!item.line.line?.trim()) return false;
      const linked = resolveDialogueLineVoiceLink(item.line, characters);
      return !!linked.voiceId?.trim();
    });
    if (!pending.length) return;

    voiceBulkAbortRef.current?.abort();
    const bulkAc = new AbortController();
    voiceBulkAbortRef.current = bulkAc;
    voiceBulkRunningRef.current = true;

    const occupiedLineIds = new Set(pending.map((item) => item.line.id));
    const sceneById = new Map<string, FilmSceneRecord>();
    for (const scene of scenes) sceneById.set(scene.id, scene);
    for (const item of pending) {
      const base = sceneById.get(item.scene.id) || item.scene;
      sceneById.set(item.scene.id, withDialogueLineOnScene(base, item.line, occupiedLineIds));
    }
    const sceneTail = new Map<string, Promise<void>>();

    const patchLine = (
      sceneId: string,
      lineId: string,
      patch: Parameters<typeof patchSceneDialogueLine>[2],
      match?: { character: string; line: string }
    ) => {
      const prev = sceneTail.get(sceneId) || Promise.resolve();
      const task = prev.then(async () => {
        const current = sceneById.get(sceneId);
        if (!current) return null;
        const next = patchSceneDialogueLine(current, lineId, patch, match);
        sceneById.set(sceneId, next);
        await putFilmScene(next);
        setVoiceSceneOverlay([next]);
        setScenes((rows) => {
          if (!rows.some((s) => s.id === sceneId)) return rows;
          return rows.map((s) => (s.id === sceneId ? next : s));
        });
        return next;
      });
      sceneTail.set(
        sceneId,
        task.then(
          () => undefined,
          () => undefined
        )
      );
      return task;
    };

    const runOne = async (item: FilmVoiceListItem) => {
      if (bulkAc.signal.aborted) return;
      const linked = resolveDialogueLineVoiceLink(item.line, characters);
      const text = item.line.line?.trim();
      if (!text || !linked.voiceId?.trim()) return;

      const key = filmVoiceAbortKey(item.scene.id, item.line.id);
      const ac = new AbortController();
      voiceAbortRef.current.set(key, ac);
      const onAbort = () => ac.abort();
      bulkAc.signal.addEventListener("abort", onAbort, { once: true });

      try {
        await patchLine(
          item.scene.id,
          item.line.id,
          {
            voiceStatus: "creating",
            voiceError: undefined,
            voiceId: linked.voiceId,
            voiceLabel: linked.voiceLabel || linked.voiceId,
          },
          item.line
        );

        const blob = await generateFilmDialogueVoiceBlob(text, linked.voiceId, ac.signal);
        if (ac.signal.aborted || bulkAc.signal.aborted) {
          const sceneNow = sceneById.get(item.scene.id);
          const lineNow = sceneNow?.dialogueLines?.find((l) => l.id === item.line.id) || item.line;
          await patchLine(
            item.scene.id,
            item.line.id,
            {
              voiceStatus: dialogueLineHasAudio(lineNow) ? "ready" : "pending",
              voiceError: undefined,
            },
            item.line
          );
          return;
        }
        const sceneNow = sceneById.get(item.scene.id);
        const lineNow = sceneNow?.dialogueLines?.find((l) => l.id === item.line.id) || item.line;
        await patchLine(
          item.scene.id,
          item.line.id,
          {
            voiceId: linked.voiceId,
            voiceLabel: linked.voiceLabel || linked.voiceId,
            ...buildAppendDialogueVoiceTakePatch(lineNow, {
              voiceBlob: blob,
              voiceUrl: "",
              voiceId: linked.voiceId,
              voiceLabel: linked.voiceLabel || linked.voiceId,
            }),
          },
          item.line
        );
        await refreshTextCredits();
      } catch (err: any) {
        if (isVoiceAbortError(err) || ac.signal.aborted || bulkAc.signal.aborted) {
          const sceneNow = sceneById.get(item.scene.id);
          const lineNow = sceneNow?.dialogueLines?.find((l) => l.id === item.line.id) || item.line;
          await patchLine(
            item.scene.id,
            item.line.id,
            {
              voiceStatus: dialogueLineHasAudio(lineNow) ? "ready" : "pending",
              voiceError: undefined,
            },
            item.line
          );
          return;
        }
        await patchLine(
          item.scene.id,
          item.line.id,
          {
            voiceStatus: "error",
            voiceError: String(err?.message || t("Tạo giọng thất bại")),
          },
          item.line
        );
      } finally {
        bulkAc.signal.removeEventListener("abort", onAbort);
        if (voiceAbortRef.current.get(key) === ac) voiceAbortRef.current.delete(key);
      }
    };

    try {
      let cursor = 0;
      const worker = async () => {
        while (!bulkAc.signal.aborted) {
          const index = cursor++;
          if (index >= pending.length) return;
          try {
            await runOne(pending[index]);
          } catch {
            // giữ worker lấy câu tiếp theo trong cùng bộ lọc
          }
        }
      };
      const pool = Math.min(FILM_VOICE_BULK_CONCURRENCY, pending.length);
      await Promise.all(Array.from({ length: pool }, () => worker()));
      await Promise.all(Array.from(sceneTail.values()));

      if (bulkAc.signal.aborted) {
        for (const item of pending) {
          const scene = sceneById.get(item.scene.id);
          const line = scene?.dialogueLines?.find((l) => l.id === item.line.id);
          if (!line || line.voiceStatus !== "creating") continue;
          await patchLine(
            item.scene.id,
            item.line.id,
            {
              voiceStatus: dialogueLineHasAudio(line) ? "ready" : "pending",
              voiceError: undefined,
            },
            item.line
          );
        }
      }
    } finally {
      if (voiceBulkAbortRef.current === bulkAc) voiceBulkAbortRef.current = null;
      voiceBulkRunningRef.current = false;
      setVoiceSceneOverlay(null);
    }
  };

  const handleStopVoice = useCallback(async (item: FilmVoiceListItem) => {
    const key = filmVoiceAbortKey(item.scene.id, item.line.id);
    voiceAbortRef.current.get(key)?.abort();
    const latest = scenes.find((s) => s.id === item.scene.id);
    if (!latest) return;
    const stopped = persistStoppedVoiceLine(latest, item.line.id);
    if (stopped === latest) return;
    setScenes((prev) => prev.map((x) => (x.id === stopped.id ? stopped : x)));
  }, [scenes]);

  const handleStopBulkVoices = useCallback(async () => {
    voiceBulkAbortRef.current?.abort();
    voiceAbortRef.current.forEach((ac) => ac.abort());
    const toSave: FilmSceneRecord[] = [];
    setScenes((prev) =>
      prev.map((scene) => {
        const creatingLines = (scene.dialogueLines || []).filter(
          (l) => l.voiceStatus === "creating"
        );
        if (!creatingLines.length) return scene;
        let next = scene;
        for (const line of creatingLines) {
          next = stopSceneDialogueVoice(next, line.id);
        }
        toSave.push(next);
        return next;
      })
    );
    for (const s of toSave) await putFilmScene(s);
  }, []);

  /** Scene gốc Chuỗi phân cảnh — bỏ clip Studio (cắt/chèn video) */
  const storyboardScenes = scenes.filter(isFilmCreateVideoScene);

  /** Studio: load/seed timeline riêng theo tập — không ghi vào scenes gốc */
  useEffect(() => {
    if (activeStep !== "studio") return;
    if (!project?.id || !activeEpisode?.id) {
      setStudioScenes([]);
      return;
    }
    const projectIdNow = project.id;
    const episodeIdNow = activeEpisode.id;
    let cancelled = false;
    setStudioLoading(true);
    void (async () => {
      try {
        const source = await purgeStudioArtifactsFromEpisodeScenes(
          projectIdNow,
          episodeIdNow
        ).catch(async () => {
          const raw = await getFilmScenesByEpisode(episodeIdNow);
          return raw.filter(isFilmCreateVideoScene);
        });
        if (!cancelled) {
          setScenes(source.filter(isFilmCreateVideoScene));
        }
        const tl = await loadOrSeedFilmStudioTimeline(
          projectIdNow,
          episodeIdNow,
          source
        );
        if (!cancelled) setStudioScenes(tl.scenes || []);
      } catch (err) {
        console.error("[FilmWorkspace] load studio timeline failed:", err);
        if (!cancelled) setStudioScenes([]);
      } finally {
        if (!cancelled) setStudioLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeStep, project?.id, activeEpisode?.id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center w-full min-h-screen text-sm text-gray-400">
        {t("Đang tải...")}
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col gap-3 justify-center items-center px-6 w-full min-h-screen">
        <p className="m-0 text-gray-500">{t("Không tìm thấy dự án.")}</p>
        <Button outline text={t("Quay lại")} onClick={() => router.push("/film")} />
      </div>
    );
  }

  const episodeLabel = activeEpisode?.title || `${t("Tập")} ${activeEpisodeIndex + 1}`;
  const hasStoryboard = storyboardScenes.length > 0;
  const hasCharacters = characters.length > 0;
  const charactersDone =
    hasCharacters &&
    characters.every(
      (c) =>
        c.status === "created" ||
        !!c.imageUrl ||
        !!c.imageBlob ||
        (c.imageUrls && c.imageUrls.length > 0)
    );
  const hasProps = propsList.length > 0;
  const propsDone =
    hasProps &&
    propsList.every(
      (p) =>
        p.status === "created" ||
        !!p.imageUrl ||
        !!p.imageBlob ||
        (p.imageUrls && p.imageUrls.length > 0)
    );
  const hasSceneImages = sceneImages.length > 0;
  const sceneImagesDone =
    hasSceneImages &&
    sceneImages.every(
      (p) =>
        p.status === "created" ||
        !!p.imageUrl ||
        !!p.imageBlob ||
        (p.imageUrls && p.imageUrls.length > 0)
    );
  const shotImagesDone =
    hasStoryboard &&
    storyboardScenes.length > 0 &&
    storyboardScenes.every(sceneFrameReady);
  const createVideoDone =
    hasStoryboard &&
    storyboardScenes.length > 0 &&
    storyboardScenes.every(sceneVideoReady);
  const voiceItems = hasStoryboard ? buildFilmVoiceListItems(storyboardScenes) : [];
  const voiceDone =
    voiceItems.length > 0 && voiceItems.every((item) => dialogueLineReady(item.line));
  const doneSteps: FilmWorkspaceStepId[] = [];
  if (hasOriginalContent) doneSteps.push("original_content");
  if (hasStoryboard) doneSteps.push("storyboard");
  if (charactersDone) doneSteps.push("character_images");
  if (propsDone) doneSteps.push("props");
  if (sceneImagesDone) doneSteps.push("scene_images");
  if (voiceDone) doneSteps.push("voice");
  if (shotImagesDone) doneSteps.push("shot_images");
  if (createVideoDone) doneSteps.push("create_video");
  if (createVideoDone) doneSteps.push("studio");

  const loadingSteps: FilmWorkspaceStepId[] = [];
  if (characters.some((c) => c.status === "creating")) {
    loadingSteps.push("character_images");
  }
  if (propsList.some((p) => p.status === "creating")) {
    loadingSteps.push("props");
  }
  if (sceneImages.some((p) => p.status === "creating")) {
    loadingSteps.push("scene_images");
  }

  const openLayout =
    activeStep === "storyboard" ||
    activeStep === "character_images" ||
    activeStep === "props" ||
    activeStep === "scene_images" ||
    activeStep === "voice" ||
    activeStep === "shot_images" ||
    activeStep === "create_video" ||
    activeStep === "studio";

  return (
    <div
      className="flex flex-col w-full bg-gray-100 overflow-hidden"
      style={{ height: "calc(100vh - 3.5rem)", maxHeight: "calc(100vh - 3.5rem)" }}
    >
      {/* Header cố định — không cuộn theo main */}
      <div className="flex-shrink-0 z-30 bg-white shadow-sm">
        <div className="flex flex-col gap-3 px-4 py-3 w-full sm:px-6 lg:px-8 lg:flex-row lg:items-center lg:gap-4">
          <div className="flex flex-1 gap-3 items-center min-w-0">
            <button
              type="button"
              onClick={() => router.push("/film")}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-blue-600 bg-transparent border-0 cursor-pointer flex-shrink-0"
            >
              <HiArrowLeft />
              <span className="hidden sm:inline">{t("Quay lại")}</span>
            </button>
            <div className="flex flex-wrap gap-y-1 gap-x-2 items-center min-w-0">
              {editingProjectName ? (
                <input
                  autoFocus
                  value={projectNameDraft}
                  onChange={(e) => setProjectNameDraft(e.target.value)}
                  onBlur={() => void commitProjectName()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      (e.target as HTMLInputElement).blur();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setEditingProjectName(false);
                    }
                  }}
                  className="m-0 min-w-0 max-w-full px-1.5 py-0.5 text-base font-bold text-gray-900 bg-white rounded border border-blue-300 outline-none sm:text-lg focus:border-blue-500"
                  style={{ width: `${Math.max(8, projectNameDraft.length + 2)}ch` }}
                />
              ) : (
                <h1
                  className="m-0 text-base font-bold text-gray-900 truncate sm:text-lg cursor-text hover:text-blue-700"
                  title={t("Nhấp để đổi tên dự án") as string}
                  onClick={startEditProjectName}
                >
                  {project.name}
                </h1>
              )}
              <span className="flex-shrink-0 text-sm text-gray-500">{episodeLabel}</span>
              <span className="hidden flex-shrink-0 text-gray-300 sm:inline">·</span>
              <p className="m-0 text-xs text-gray-400">
                {t("Nội dung gồm")}: {characterCount} {t("Nhân vật")} - {sceneCount}{" "}
                {t("Cảnh quay")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap flex-shrink-0 gap-2 items-center sm:gap-3">
            <Button
              outline
              small
              success={hasAnyAi}
              gray={!hasAnyAi}
              text={t("API Key")}
              icon={<RiKey2Line className="text-lg" />}
              className="!rounded-lg px-2.5"
              asyncLoading={false}
              tooltip={t("Cấu hình AI Keys") as string}
              onClick={openAiKeysDialog}
            />
            <Button
              outline
              small
              text={t("Làm mới")}
              icon={<HiRefresh />}
              className="!rounded-lg"
              onClick={load}
            />
            <Button
              outline
              small
              text={t("Xóa dự án")}
              icon={<HiTrash />}
              className="!rounded-lg !border-red-200 !text-red-600 hover:!bg-red-50"
              onClick={() => void handleDeleteProject()}
            />
            <TrainingGuidePopover
              variant="toolbar"
              topicSlug={TrainingTopicSlug.MAKE_FILM}
            />
          </div>
        </div>
        {episodes.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center px-4 pb-3 sm:px-6 lg:px-8">
            {episodes.map((ep, idx) => {
              const active = idx === activeEpisodeIndex;
              const renaming = editingEpisodeId === ep.id;
              const hovered = hoveredEpisodeId === ep.id;
              const actionCount = 1 + (episodes.length > 1 ? 1 : 0);
              const actionsOpen = hovered && !renaming;
              return (
                <span
                  key={ep.id}
                  onMouseEnter={() => setHoveredEpisodeId(ep.id)}
                  onMouseLeave={() =>
                    setHoveredEpisodeId((cur) => (cur === ep.id ? null : cur))
                  }
                  className={`inline-flex items-center rounded-lg border text-xs font-medium ${
                    active || renaming
                      ? "bg-blue-50 border-blue-200 text-blue-700"
                      : "bg-white border-gray-200 text-gray-600"
                  }`}
                >
                  {renaming ? (
                    <input
                      autoFocus
                      value={episodeTitleDraft}
                      onChange={(e) => setEpisodeTitleDraft(e.target.value)}
                      onBlur={() => void commitEpisodeTitle()}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          (e.target as HTMLInputElement).blur();
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setEditingEpisodeId(null);
                        }
                      }}
                      className="min-w-0 max-w-[12rem] px-2 py-1.5 text-xs font-medium text-blue-700 bg-transparent border-0 outline-none"
                      style={{ width: `${Math.max(6, episodeTitleDraft.length + 1)}ch` }}
                      title={t("Đổi tên tập") as string}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => selectActiveEpisode(idx)}
                      className={`px-3 py-1.5 border-0 cursor-pointer bg-transparent ${
                        active ? "text-blue-700" : "text-gray-600 hover:text-gray-800"
                      }`}
                    >
                      {ep.title || `${t("Tập")} ${ep.index}`}
                    </button>
                  )}
                  {!renaming ? (
                    <span
                      className={`inline-flex items-center self-stretch overflow-hidden border-0 border-l ${
                        active ? "border-blue-200" : "border-gray-200"
                      }`}
                      style={{
                        width: actionsOpen ? actionCount * 28 : 0,
                        opacity: actionsOpen ? 1 : 0,
                        borderLeftWidth: actionsOpen ? 1 : 0,
                        transition: "width 0.15s ease, opacity 0.15s ease",
                        pointerEvents: actionsOpen ? "auto" : "none",
                      }}
                    >
                      <button
                        type="button"
                        title={t("Đổi tên tập")}
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditEpisodeTitle(ep);
                        }}
                        className="inline-flex flex-shrink-0 items-center justify-center w-7 h-full border-0 cursor-pointer bg-transparent hover:bg-blue-100"
                      >
                        <HiPencil className="text-sm text-blue-500" />
                      </button>
                      {episodes.length > 1 ? (
                        <button
                          type="button"
                          title={t("Xóa tập")}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteEpisode(ep, idx);
                          }}
                          className="inline-flex flex-shrink-0 items-center justify-center w-7 h-full border-0 border-l border-inherit cursor-pointer bg-transparent hover:bg-red-50"
                        >
                          <HiTrash className="text-sm text-red-500" />
                        </button>
                      ) : null}
                    </span>
                  ) : null}
                </span>
              );
            })}
            <Button
              outline
              small
              text={t("Thêm tập")}
              icon={<HiPlus />}
              className="!rounded-lg"
              onClick={() => void handleAddEpisode()}
            />
          </div>
        )}
      </div>

      <FilmAiKeysDialog
        isOpen={aiKeysDialogOpen}
        onClose={() => setAiKeysDialogOpen(false)}
        onSaved={(status) => setAiKeysStatus(status)}
      />

      {/* Trái fix cứng (desktop) / drawer trượt (mobile) | phải là scroll container duy nhất */}
      <div className="relative flex flex-1 min-h-0 overflow-hidden lg:gap-4 lg:py-4 lg:pr-6 lg:items-stretch">
        <FilmWorkspaceSidebar
          activeStep={activeStep}
          progressDone={doneSteps.length}
          doneStepIds={doneSteps}
          loadingStepIds={loadingSteps}
          onStepChange={selectActiveStep}
          onRefresh={load}
        />

        <main
          className={`flex-1 min-w-0 min-h-0 overflow-y-auto overscroll-contain ${
            activeStep === "studio"
              ? "p-0 overflow-y-auto overscroll-contain flex flex-col flex-1 min-h-0"
              : openLayout
                ? "p-4 sm:px-6 lg:p-0"
                : "m-4 sm:mx-6 lg:m-0 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 flex flex-col"
          }`}
        >
          {activeStep === "original_content" && (
            <FilmOriginalContentPanel
              episode={activeEpisode}
              canInheritPrevious={(activeEpisode?.index || 0) > 1}
              onSave={handleSaveOriginal}
              onExtract={handleExtract}
            />
          )}

          {activeStep === "storyboard" && (
            <FilmStoryboardPanel
              projectId={project.id}
              episode={activeEpisode}
              scenes={scenes}
              characters={characters}
              props={propsList}
              sceneImages={sceneImages}
              storyboardImagePromptStyle={project.storyboardImagePrompt}
              storyboardVideoPromptStyle={project.storyboardVideoPrompt}
              storyboardAudioPromptStyle={project.storyboardAudioPrompt}
              focusSceneId={storyboardFocusSceneId}
              onScenesChange={setScenes}
              onSaveScene={handleSaveScene}
              onReplaceScenes={handleReplaceScenes}
              onAddScene={handleAddScene}
              onEnsureCharacters={(names: string[]): Promise<void> =>
                ensureCharactersByNames(names).then(() => undefined)
              }
              onEnsureProps={(names: string[]): Promise<void> =>
                ensurePropsByNames(names).then(() => undefined)
              }
              onEnsureLocations={(names: string[]): Promise<void> =>
                ensureLocationsByNames(names).then(() => undefined)
              }
              onOpenAttachEntity={(kind, option) => {
                const id = String(option?.id || "").trim();
                const step =
                  kind === "character"
                    ? "character_images"
                    : kind === "prop"
                      ? "props"
                      : "scene_images";
                setProductionFocusEntityId(null);
                selectActiveStep(step);
                if (id) {
                  requestAnimationFrame(() => {
                    setProductionFocusEntityId(id);
                  });
                }
              }}
              onTabNavigate={(tab) => {
                if (tab === "voice") selectActiveStep("voice");
                else if (tab === "shot_images") selectActiveStep("shot_images");
                else if (tab === "create_video") selectActiveStep("create_video");
              }}
            />
          )}

          {activeStep === "character_images" && (
            <FilmCharacterImagesPanel
              characters={characters}
              propsList={propsList}
              aspectRatio={FILM_CHARACTER_PROP_ASPECT_RATIO}
              promptTemplate={project.characterImagePromptTemplate}
              onCharactersChange={setCharacters}
              onSaveCharacter={handleSaveCharacter}
              onExtractCharacters={handleExtractCharacters}
              onBulkCreate={handleBulkCreateCharacters}
              onAddCharacter={handleAddCharacter}
              onCloneCharacter={handleCloneCharacter}
              onDeleteCharacter={handleDeleteCharacter}
              onCreateCharacterImage={handleCreateCharacterImage}
              onCreateCharacterWithPropRefs={handleCreateCharacterWithPropRefs}
              onCreatePropImage={handleCreatePropImage}
              onStopCharacterImage={handleStopCharacterImage}
              stopPendingIds={stopPendingIds}
              onSetCharacterImage={handleSetCharacterImage}
              onSuggestCharacterProps={handleSuggestCharacterProps}
              onAddCharacterProp={handleAddCharacterProp}
              sceneImages={sceneImages}
              onLinkCatalogItems={handleLinkCatalogToCharacter}
              onMoveLinkedProp={(p) => {
                void handleMoveLinkedProp(p);
              }}
              onUnlinkLinkedProp={(p) => {
                void handleUnlinkLinkedProp(p);
              }}
              episodes={episodes}
              focusEntityId={
                activeStep === "character_images" ? productionFocusEntityId : null
              }
              onFocusEntityConsumed={() => setProductionFocusEntityId(null)}
              onTabNavigate={(tab) => {
                if (tab === "props") selectActiveStep("props");
                else if (tab === "scene_images") selectActiveStep("scene_images");
              }}
            />
          )}

          {activeStep === "props" && (
            <FilmPropsPanel
              props={propsList}
              allPropsForLink={propsList}
              episodes={episodes}
              aspectRatio={FILM_CHARACTER_PROP_ASPECT_RATIO}
              promptTemplate={project.propImagePromptTemplate}
              onPropsChange={setPropsList}
              onSaveProp={handleSaveProp}
              onExtractProps={handleExtractProps}
              onBulkCreate={handleBulkCreateProps}
              onAddProp={handleAddProp}
              onDeleteProp={handleDeleteProp}
              onCloneProp={handleCloneProp}
              onCreatePropImage={handleCreatePropImage}
              onCreatePropWithCompanionRefs={handleCreatePropWithCompanionRefs}
              onStopPropImage={handleStopPropImage}
              stopPendingIds={stopPendingIds}
              onSetPropImage={handleSetPropImage}
              onSuggestPropCompanions={handleSuggestPropCompanions}
              onAddPropCompanion={handleAddPropCompanion}
              characters={characters}
              sceneImages={sceneImages}
              onLinkCatalogItems={handleLinkCatalogToProp}
              onMoveLinkedProp={(p) => {
                void handleMoveLinkedProp(p);
              }}
              onUnlinkLinkedProp={(p) => {
                void handleUnlinkLinkedProp(p);
              }}
              focusEntityId={activeStep === "props" ? productionFocusEntityId : null}
              onFocusEntityConsumed={() => setProductionFocusEntityId(null)}
              onTabNavigate={(tab) => {
                if (tab === "character_images" || tab === "extract_characters") {
                  selectActiveStep("character_images");
                } else if (tab === "scene_images") {
                  selectActiveStep("scene_images");
                }
              }}
            />
          )}

          {activeStep === "scene_images" && (
            <FilmSceneImagesPanel
              items={sceneImages}
              propsList={propsList}
              episodes={episodes}
              aspectRatio={resolveFilmProjectAspectRatio(project.aspectRatio)}
              promptTemplate={project.locationImagePromptTemplate}
              onItemsChange={setSceneImages}
              onSaveItem={handleSaveSceneImage}
              onExtract={handleExtractSceneImages}
              onBulkCreate={handleBulkCreateSceneImages}
              onAddItem={handleAddSceneImage}
              onDeleteItem={handleDeleteSceneImage}
              onCloneItem={handleCloneLocation}
              onCreateItem={handleCreateSceneImage}
              onCreateLocationWithPropRefs={handleCreateLocationWithPropRefs}
              onSetItemImage={handleSetSceneImage}
              onCreatePropImage={handleCreatePropImage}
              onStopItemImage={handleStopSceneImage}
              stopPendingIds={stopPendingIds}
              onSuggestLocationProps={handleSuggestLocationProps}
              onAddLocationProp={handleAddLocationProp}
              characters={characters}
              onLinkCatalogItems={handleLinkCatalogToLocation}
              onMoveLinkedProp={(p) => {
                void handleMoveLinkedProp(p);
              }}
              onUnlinkLinkedProp={(p) => {
                void handleUnlinkLinkedProp(p);
              }}
              focusEntityId={
                activeStep === "scene_images" ? productionFocusEntityId : null
              }
              onFocusEntityConsumed={() => setProductionFocusEntityId(null)}
              onTabNavigate={(tab) => {
                if (tab === "character_images" || tab === "extract_characters") {
                  selectActiveStep("character_images");
                } else if (tab === "props") {
                  selectActiveStep("props");
                }
              }}
            />
          )}

          {activeStep === "shot_images" && (
            <FilmShotImagesPanel
              scenes={storyboardScenes}
              characters={characters}
              aspectRatio={resolveFilmProjectAspectRatio(project.aspectRatio)}
              storyboardImagePromptStyle={project.storyboardImagePrompt}
              storyboardVideoPromptStyle={project.storyboardVideoPrompt}
              storyboardAudioPromptStyle={project.storyboardAudioPrompt}
              onCreateFrame={handleCreateShotFrame}
              onStopFrame={handleStopShotFrame}
              stopPendingIds={stopPendingIds}
              onSetFrameImage={handleSetShotFrameImage}
              onBulkCreateFrames={handleBulkCreateShotFrames}
              onSuggestSafePrompt={handleSuggestSafeShotFramePrompt}
              onFramePromptSourceChange={handleFramePromptSourceChange}
              onSaveScene={handleSaveScene}
              onTabNavigate={(tab) => {
                if (tab === "storyboard") selectActiveStep("storyboard");
                else if (tab === "voice") selectActiveStep("voice");
                else if (tab === "create_video") selectActiveStep("create_video");
              }}
              onOpenStoryboardScene={(scene) => {
                setStoryboardFocusSceneId(scene.id);
                selectActiveStep("storyboard");
              }}
              propsList={propsList}
              sceneImages={sceneImages}
              onOpenAttachEntity={(kind, option) => {
                const id = String(option?.id || "").trim();
                const step =
                  kind === "character"
                    ? "character_images"
                    : kind === "prop"
                      ? "props"
                      : "scene_images";
                setProductionFocusEntityId(null);
                selectActiveStep(step);
                if (id) {
                  requestAnimationFrame(() => {
                    setProductionFocusEntityId(id);
                  });
                }
              }}
              onDetachAttach={(scene, kind, name) => {
                const next = detachFilmSceneAttachName(scene, kind, name);
                const attachOk = checkFilmSceneAttachmentsForMedia(
                  next,
                  characters,
                  propsList,
                  sceneImages
                );
                void handleSaveScene({
                  ...next,
                  frameError: attachOk.ok
                    ? undefined
                    : isFilmAttachErrorMessage(scene.frameError)
                      ? attachOk.message
                      : scene.frameError,
                });
              }}
            />
          )}

          {activeStep === "voice" && (
            <FilmVoicePanel
              projectId={project.id}
              scenes={storyboardScenes}
              characters={characters}
              episodes={episodes}
              promptTemplate={project.characterImagePromptTemplate}
              onCharactersChange={setCharacters}
              onSaveCharacter={handleSaveCharacter}
              onSaveScene={handleSaveScene}
              onCreateVoice={handleCreateVoice}
              onSetDefaultVoiceTake={handleSetDefaultVoiceTake}
              onStopVoice={handleStopVoice}
              onBulkCreateVoices={handleBulkCreateVoices}
              onStopBulkVoices={handleStopBulkVoices}
              overlayScenes={voiceSceneOverlay}
              onTabNavigate={(tab) => {
                if (tab === "storyboard") selectActiveStep("storyboard");
                else if (tab === "shot_images") selectActiveStep("shot_images");
                else if (tab === "create_video") selectActiveStep("create_video");
              }}
            />
          )}

          {activeStep === "create_video" && (
            <FilmCreateVideoPanel
              scenes={storyboardScenes}
              aspectRatio={resolveFilmProjectAspectRatio(project.aspectRatio)}
              characters={characters}
              propsList={propsList}
              sceneImages={sceneImages}
              storyboardImagePromptStyle={project.storyboardImagePrompt}
              storyboardVideoPromptStyle={project.storyboardVideoPrompt}
              storyboardAudioPromptStyle={project.storyboardAudioPrompt}
              onCreateVideo={handleCreateVideo}
              onStopVideo={handleStopVideoGeneration}
              onSetSceneVideo={handleSetSceneVideo}
              stopPendingIds={stopPendingIds}
              onBulkCreateVideos={handleBulkCreateVideos}
              videoRefMode={videoRefMode}
              onVideoRefModeChange={handleVideoRefModeChange}
              onVideoRefSlotsChange={handleVideoRefSlotsChange}
              onSaveScene={handleSaveScene}
              onDownloadAll={() => {
                // Placeholder — export zip khi có video thật
                console.info("[Film] Download all videos (not implemented)");
              }}
              onTabNavigate={(tab) => {
                if (tab === "storyboard") selectActiveStep("storyboard");
                else if (tab === "voice") selectActiveStep("voice");
                else if (tab === "shot_images") selectActiveStep("shot_images");
              }}
              onOpenStoryboardScene={(scene) => {
                setStoryboardFocusSceneId(scene.id);
                selectActiveStep("storyboard");
              }}
              onOpenAttachEntity={(kind, option) => {
                const id = String(option?.id || "").trim();
                const step =
                  kind === "character"
                    ? "character_images"
                    : kind === "prop"
                      ? "props"
                      : "scene_images";
                setProductionFocusEntityId(null);
                selectActiveStep(step);
                if (id) {
                  requestAnimationFrame(() => {
                    setProductionFocusEntityId(id);
                  });
                }
              }}
            />
          )}

          {activeStep === "studio" && (
            <div className="relative flex flex-col w-full min-h-full">
              {studioLoading ? (
                <div className="flex flex-1 items-center justify-center text-sm text-gray-400 py-16">
                  {t("Đang tải Studio...")}
                </div>
              ) : (
              <FilmStudioPanel
                scenes={studioScenes}
                aspectRatio={resolveFilmProjectAspectRatio(project.aspectRatio)}
                subtitleConfig={project.studioSubtitleConfig}
                onSubtitleConfigChange={(config) => {
                  if (!project) return;
                  const updated: FilmProjectRecord = {
                    ...project,
                    studioSubtitleConfig: config,
                    updatedAt: new Date().toISOString(),
                  };
                  setProject(updated);
                  void putFilmProject(updated).catch(() => undefined);
                }}
                onReloadScenes={async () => {
                  if (!project?.id || !activeEpisode?.id) {
                    return storyboardScenes;
                  }
                  // Chỉ đọc scenes gốc (Tạo video) — không sửa store scenes
                  const fresh = await getFilmScenesByEpisode(activeEpisode.id);
                  return fresh.filter(isFilmCreateVideoScene);
                }}
                onReplaceScenes={async (next) => {
                  if (!project?.id || !activeEpisode?.id) {
                    setStudioScenes(next);
                    return next;
                  }
                  const saved = await putFilmStudioTimeline({
                    episodeId: activeEpisode.id,
                    projectId: project.id,
                    scenes: next,
                    updatedAt: new Date().toISOString(),
                  });
                  setStudioScenes(saved.scenes);
                  return saved.scenes;
                }}
                onScenesChange={(next) => {
                  setStudioScenes(next);
                  if (!project?.id || !activeEpisode?.id) return;
                  void putFilmStudioTimeline({
                    episodeId: activeEpisode.id,
                    projectId: project.id,
                    scenes: next,
                    updatedAt: new Date().toISOString(),
                  }).catch(() => undefined);
                }}
              />
              )}
            </div>
          )}

          {activeStep === "settings" && (
            <FilmSettingsPanel
              project={project}
              onProjectUpdated={setProject}
              onScenesUpdated={(updated) => {
                setScenes((prev) => {
                  const map = new Map(updated.map((s) => [s.id, s]));
                  return prev.map((s) => map.get(s.id) || s);
                });
              }}
              aiKeysStatus={aiKeysStatus}
              onOpenApiKey={openAiKeysDialog}
            />
          )}

          {activeStep !== "original_content" &&
            activeStep !== "storyboard" &&
            activeStep !== "character_images" &&
            activeStep !== "props" &&
            activeStep !== "scene_images" &&
            activeStep !== "voice" &&
            activeStep !== "shot_images" &&
            activeStep !== "create_video" &&
            activeStep !== "studio" &&
            activeStep !== "settings" && (
              <div className="flex flex-col justify-center items-center px-6 h-full text-center min-h-xs">
                <p className="m-0 text-base font-semibold text-gray-700">
                  {t("Tính năng đang phát triển")}
                </p>
              </div>
            )}
        </main>
      </div>
    </div>
  );
}
