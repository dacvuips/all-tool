/**
 * Tab Studio cho Audio/Image → Video — tái dùng FilmStudioPanel.
 * Gắn: video đã gen, audio nguồn (form nếu có), lời thoại → phụ đề.
 * Audio / Image / Text đều dùng chung sau khi đã gen video.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import FilmStudioPanel from "../../../../film/film-studio-panel";
import type {
  FilmAspectRatio,
  FilmSceneRecord,
  FilmStudioSubtitleConfig,
} from "../../../../film/film-types";
import { normalizeFilmStudioSubtitleConfig } from "../../../../film/film-types";
import type { ElementFormAudio, SceneScript } from "../../constants";
import { CACHE_KEY, DB_NAME, STORE_NAME } from "../../constants";
import type { GeneratedVideoData } from "../../copy-video/hook/useCopyVideoApi";
import { useAffiliateVideoApi } from "../../hook/useAffiliateVideoApi";
import { useIndexedDB } from "../../hook/useIndexedDB";
import {
  applyFitDialogueDurationToStudioScenes,
  attachSceneImagesToStudioScenes,
  attachSourceAudioToStudioScenes,
  AUDIO_IMAGE_STUDIO_EPISODE_ID,
  AUDIO_IMAGE_STUDIO_PROJECT_ID,
  buildAudioImageStudioSourceScenes,
  seedAudioImageStudioTimeline,
} from "./audio-image-studio-adapter";

const FIT_DIALOGUE_STORAGE_KEY = "audio-image-to-video:studio:fitDialogue:v1";

function readFitDialogueDefault(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(FIT_DIALOGUE_STORAGE_KEY);
    if (raw == null) return true;
    return raw !== "0" && raw !== "false";
  } catch {
    return true;
  }
}

function writeFitDialogueDefault(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FIT_DIALOGUE_STORAGE_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

type StudioPersistPayload = {
  projectId: string;
  episodeId: string;
  scenes: FilmSceneRecord[];
  sceneIds?: string[];
  subtitleConfig?: FilmStudioSubtitleConfig;
  videoAudioVolume?: number;
  fitDialogueDuration?: boolean;
  updatedAt: string;
};

type Props = {
  scenes: SceneScript[];
  sourceAudio?: ElementFormAudio | null;
  aspectRatio?: string;
  /** Tăng khi phân tích lại / cần seed Studio mới */
  studioEpoch?: number;
};

function sceneIdsKey(scenes: SceneScript[]) {
  return (scenes || [])
    .filter((s) => !s.disabled)
    .map((s) => s.id)
    .filter(Boolean)
    .join("|");
}

function hasVideoMedia(video?: GeneratedVideoData | null) {
  return !!(video?.mediaBlob || (video?.videoUri || "").trim() || (video?.previewUrl || "").trim());
}

function cachedSceneHasVideo(scene: FilmSceneRecord) {
  return !!(scene.videoBlob || (scene.videoUrl || "").trim());
}

/** Xóa timeline Studio đã lưu (gọi sau phân tích lại). */
export async function clearAudioImageStudioTimelineCache(
  remove: (key: string) => Promise<void>
): Promise<void> {
  await remove(CACHE_KEY.audioImageStudioTimeline);
}

export function AudioImageStudioPanel({
  scenes,
  sourceAudio,
  aspectRatio,
  studioEpoch = 0,
}: Props) {
  const { t } = useTranslation();
  const { getGeneratedVideo, getGeneratedImage } = useAffiliateVideoApi();
  const studioDB = useIndexedDB<StudioPersistPayload>(
    STORE_NAME.generateScene,
    DB_NAME.generateScene
  );

  const [studioScenes, setStudioScenes] = useState<FilmSceneRecord[]>([]);
  const [subtitleConfig, setSubtitleConfig] = useState<FilmStudioSubtitleConfig>(() =>
    normalizeFilmStudioSubtitleConfig(null)
  );
  const [videoAudioVolume, setVideoAudioVolume] = useState(100);
  const [fitDialogueDuration, setFitDialogueDuration] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const seedingRef = useRef(false);
  const persistTimerRef = useRef<number | null>(null);
  const fitDialogueRef = useRef(fitDialogueDuration);
  fitDialogueRef.current = fitDialogueDuration;

  const filmAspect = useMemo<FilmAspectRatio>(() => {
    return aspectRatio === "16:9" ? "16:9" : "9:16";
  }, [aspectRatio]);

  const idsKey = useMemo(() => sceneIdsKey(scenes), [scenes]);

  const loadVideosBySceneId = useCallback(async () => {
    const map: Record<string, GeneratedVideoData | undefined> = {};
    await Promise.all(
      (scenes || []).map(async (s) => {
        if (!s?.id) return;
        try {
          map[s.id] = await getGeneratedVideo(s.id);
        } catch {
          map[s.id] = undefined;
        }
      })
    );
    return map;
  }, [scenes, getGeneratedVideo]);

  const loadImagesBySceneId = useCallback(async () => {
    const map: Record<string, Awaited<ReturnType<typeof getGeneratedImage>>> = {};
    await Promise.all(
      (scenes || []).map(async (s) => {
        if (!s?.id) return;
        try {
          map[s.id] = await getGeneratedImage(s.id);
        } catch {
          map[s.id] = undefined;
        }
      })
    );
    return map;
  }, [scenes, getGeneratedImage]);

  const persistStudio = useCallback(
    (next: {
      scenes: FilmSceneRecord[];
      subtitleConfig?: FilmStudioSubtitleConfig;
      videoAudioVolume?: number;
      fitDialogueDuration?: boolean;
    }) => {
      if (!next.scenes.length) {
        void studioDB.remove(CACHE_KEY.audioImageStudioTimeline).catch(() => undefined);
        return;
      }
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
      }
      persistTimerRef.current = window.setTimeout(() => {
        const payload: StudioPersistPayload = {
          projectId: AUDIO_IMAGE_STUDIO_PROJECT_ID,
          episodeId: AUDIO_IMAGE_STUDIO_EPISODE_ID,
          scenes: next.scenes,
          sceneIds: next.scenes.map((s) => s.id),
          subtitleConfig: next.subtitleConfig ?? subtitleConfig,
          videoAudioVolume: next.videoAudioVolume ?? videoAudioVolume,
          fitDialogueDuration: next.fitDialogueDuration ?? fitDialogueRef.current,
          updatedAt: new Date().toISOString(),
        };
        void studioDB.set(CACHE_KEY.audioImageStudioTimeline, payload).catch(() => undefined);
      }, 400);
    },
    [studioDB, subtitleConfig, videoAudioVolume]
  );

  const seedFromSource = useCallback(async () => {
    const [videosBySceneId, imagesBySceneId] = await Promise.all([
      loadVideosBySceneId(),
      loadImagesBySceneId(),
    ]);
    return seedAudioImageStudioTimeline({
      scenes,
      videosBySceneId,
      imagesBySceneId,
      sourceAudio,
      aspectRatio: filmAspect,
      fitDialogueDuration: fitDialogueRef.current,
    });
  }, [loadVideosBySceneId, loadImagesBySceneId, scenes, sourceAudio, filmAspect]);

  const shouldReseedFromCache = useCallback(
    async (cached: StudioPersistPayload | undefined) => {
      if (!cached?.scenes?.length) return true;
      const cachedIds = (cached.sceneIds || cached.scenes.map((s) => s.id)).join("|");
      if (cachedIds !== idsKey) return true;

      const videosBySceneId = await loadVideosBySceneId();
      const readyCount = Object.values(videosBySceneId).filter(hasVideoMedia).length;
      const cachedReady = cached.scenes.filter(cachedSceneHasVideo).length;
      if (readyCount > cachedReady) return true;
      return false;
    },
    [idsKey, loadVideosBySceneId]
  );

  const applyFitAndPersist = useCallback(
    async (enabled: boolean, baseScenes: FilmSceneRecord[]) => {
      // Bỏ clip audio studioOnly cũ rồi gắn lại sau khi đổi duration
      const withoutStudioAudio = baseScenes.map((s) => ({
        ...s,
        dialogueLines: (s.dialogueLines || []).filter((l) => !l.studioOnly),
      }));
      let next = applyFitDialogueDurationToStudioScenes(withoutStudioAudio, scenes, enabled);
      next = await attachSourceAudioToStudioScenes(next, sourceAudio);
      setStudioScenes(next);
      persistStudio({ scenes: next, fitDialogueDuration: enabled });
    },
    [scenes, sourceAudio, persistStudio]
  );

  const handleFitToggle = useCallback(
    (enabled: boolean) => {
      setFitDialogueDuration(enabled);
      writeFitDialogueDefault(enabled);
      void applyFitAndPersist(enabled, studioScenes);
    },
    [applyFitAndPersist, studioScenes]
  );

  // Load / seed khi đổi scene, epoch (phân tích lại), hoặc mở tab lần đầu.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (seedingRef.current) return;
      seedingRef.current = true;
      setLoading(true);
      setLoadError(null);
      try {
        if (studioEpoch > 0) {
          await studioDB.remove(CACHE_KEY.audioImageStudioTimeline).catch(() => undefined);
        }

        const cached = await studioDB.get(CACHE_KEY.audioImageStudioTimeline);
        if (cancelled) return;

        const fitFromCache =
          typeof cached?.fitDialogueDuration === "boolean"
            ? cached.fitDialogueDuration
            : readFitDialogueDefault();
        setFitDialogueDuration(fitFromCache);
        fitDialogueRef.current = fitFromCache;

        const reseed = await shouldReseedFromCache(cached || undefined);
        if (!reseed && cached?.scenes?.length) {
          const imagesBySceneId = await loadImagesBySceneId();
          const withFrames = attachSceneImagesToStudioScenes(cached.scenes, imagesBySceneId);
          setStudioScenes(withFrames);
          if (cached.subtitleConfig) {
            setSubtitleConfig(normalizeFilmStudioSubtitleConfig(cached.subtitleConfig));
          }
          if (typeof cached.videoAudioVolume === "number") {
            setVideoAudioVolume(cached.videoAudioVolume);
          }
          persistStudio({
            scenes: withFrames,
            subtitleConfig: cached.subtitleConfig
              ? normalizeFilmStudioSubtitleConfig(cached.subtitleConfig)
              : undefined,
            videoAudioVolume:
              typeof cached.videoAudioVolume === "number" ? cached.videoAudioVolume : undefined,
            fitDialogueDuration: fitFromCache,
          });
        } else {
          const seeded = await seedFromSource();
          if (cancelled) return;
          setStudioScenes(seeded);
          persistStudio({ scenes: seeded, fitDialogueDuration: fitFromCache });
        }
      } catch (err: any) {
        if (!cancelled) {
          setLoadError(err?.message || t("Không tải được Studio"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          seedingRef.current = false;
        }
      }
    })();
    return () => {
      cancelled = true;
      seedingRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, studioEpoch]);

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-16 text-sm text-gray-400">
        {t("Đang tải Studio...")}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-3 py-16 px-4 text-center">
        <p className="text-sm text-red-500">{loadError}</p>
        <button
          type="button"
          className="text-sm font-medium text-primary underline"
          onClick={() => {
            seedingRef.current = false;
            setLoading(true);
            void seedFromSource()
              .then((seeded) => {
                setStudioScenes(seeded);
                persistStudio({ scenes: seeded });
                setLoadError(null);
              })
              .catch((err: any) => setLoadError(err?.message || t("Không tải được Studio")))
              .finally(() => setLoading(false));
          }}
        >
          {t("Thử lại")}
        </button>
      </div>
    );
  }

  if (!studioScenes.length) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-2 py-16 px-6 text-center">
        <p className="text-sm text-gray-500">
          {t("Chưa có video để đưa vào Studio. Hãy tạo video các phân cảnh trước.")}
        </p>
        <button
          type="button"
          className="text-sm font-medium text-primary underline"
          onClick={() => {
            setLoading(true);
            void seedFromSource()
              .then((seeded) => {
                setStudioScenes(seeded);
                persistStudio({ scenes: seeded });
              })
              .finally(() => setLoading(false));
          }}
        >
          {t("Làm mới Studio")}
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col flex-1 min-h-0 w-full h-full overflow-hidden">
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-2 py-1.5 border-b border-gray-100 bg-white">
        <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs text-gray-700">
          <input
            type="checkbox"
            className="rounded border-gray-300 text-primary focus:ring-primary"
            checked={fitDialogueDuration}
            onChange={(e) => handleFitToggle(e.target.checked)}
          />
          <span>
            {t("Khớp tốc độ video theo thời gian thoại")}
            <span className="ml-1 text-gray-400">
              ({t("dài hơn → chậm · ngắn hơn 8s → nhanh")})
            </span>
          </span>
        </label>
      </div>
      <FilmStudioPanel
        embedded
        scenes={studioScenes}
        aspectRatio={filmAspect}
        subtitleConfig={subtitleConfig}
        onSubtitleConfigChange={(config) => {
          setSubtitleConfig(config);
          persistStudio({ scenes: studioScenes, subtitleConfig: config });
        }}
        videoAudioVolume={videoAudioVolume}
        onVideoAudioVolumeChange={(volume) => {
          setVideoAudioVolume(volume);
          persistStudio({ scenes: studioScenes, videoAudioVolume: volume });
        }}
        onReloadScenes={async () => {
          const [videosBySceneId, imagesBySceneId] = await Promise.all([
            loadVideosBySceneId(),
            loadImagesBySceneId(),
          ]);
          return buildAudioImageStudioSourceScenes({
            scenes,
            videosBySceneId,
            imagesBySceneId,
            sourceAudio,
            aspectRatio: filmAspect,
            fitDialogueDuration: fitDialogueRef.current,
          });
        }}
        onReplaceScenes={async (next) => {
          const finalScenes = await attachSourceAudioToStudioScenes(next, sourceAudio);
          setStudioScenes(finalScenes);
          persistStudio({ scenes: finalScenes });
          return finalScenes;
        }}
        onScenesChange={(next) => {
          setStudioScenes(next);
          persistStudio({ scenes: next });
        }}
      />
    </div>
  );
}
