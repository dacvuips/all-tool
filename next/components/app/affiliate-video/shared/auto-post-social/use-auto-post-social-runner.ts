/**
 * Runner: Play all / Play từng bài đăng MXH
 *
 * Phase 1 — Gen toàn cục: gom prompt tất cả bài đăng, xen kẽ round-robin,
 * chạy song song theo videoStreamCount (vd. 10 luồng = 10 prompt từ nhiều bài).
 * Phase 2 — Tuần tự từng bài: nối video → upload YouTube.
 */
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { youtubePostRepository } from "../../../../../lib/repo/youtube/youtube-post.repo";
import { facebookPostRepository } from "../../../../../lib/repo/facebook/facebook-post.repo";
import { CopyVideoScene } from "../../constants";
import { mergeSceneVideosToBlob } from "../batchMergeVideos";
import { clearVideoBlobWatermark } from "../batchClearWatermark";
import type { GeneratedVideoLike } from "../generatedMediaUtils";
import {
  AutoPostPackageSnapshot,
  buildSceneToGroupMap,
  countScenesNeedingVideo,
  countScenesNeedingVideoForPost,
  countScenesWithVideo,
  getAutoPostRemainingQuota,
  interleaveSceneIdsAcrossGroups,
  isGroupReadyToPublish,
} from "./auto-post-package-quota";
import {
  autoPostPipelineRunningRef,
  autoPostPipelineStopRef,
  clearAutoPostGroupStopped,
  getAutoPostRunState,
  isAutoPostGroupStopped,
  markAutoPostGroupStopped,
  patchAutoPostRunState,
  resetAutoPostRunState,
  setAutoPostGroupInfo,
  setAutoPostRunnerActions,
} from "./auto-post-social-run-store";
import {
  buildGroupsFromScenes,
  normalizeSocialPostFields,
  SocialPostGroup,
  toPostFacebookPageVideoMeta,
  toPostYoutubeVideoMeta,
} from "./grouped-list";
import type { PersistSocialPostPublishParams } from "./use-persist-social-post-publish";
import { useAutoPostSocialSettings } from "./use-auto-post-social-settings";

async function blobToRawBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

type GroupRunOutcome = "done" | "error" | "stopped" | "skipped";

type PlatformUploadFlags = { youtube: boolean; facebook: boolean };

function hasAnyUploadPlatform(flags: PlatformUploadFlags): boolean {
  return flags.youtube || flags.facebook;
}

const PUBLISH_PIPELINE_STATUSES = new Set(["merging", "uploading", "done"]);

function setGroupGeneratingUnlessPublishing(
  groupId: string,
  patch: { status: "generating"; message: string }
): void {
  if (isAutoPostGroupStopped(groupId)) return;
  const current = getAutoPostRunState().groups[groupId]?.status;
  if (current && PUBLISH_PIPELINE_STATUSES.has(current)) return;
  setAutoPostGroupInfo(groupId, patch);
}

export type AutoPostGenBatchResult = {
  completed: number;
  errors: number;
  skipped: number;
  stopped: boolean;
  quotaSkipped?: number;
};

export type AutoPostSceneGenOptions = {
  maxToGenerate?: number;
  sceneOrder?: string[];
  onSceneActive?: (sceneId: string) => void;
  onSceneComplete?: (sceneId: string) => void;
  shouldAbortScene?: (sceneId: string) => boolean;
};

export interface UseAutoPostSocialRunnerOptions {
  scenes: CopyVideoScene[];
  socialPostGroups?: SocialPostGroup[];
  runGenerateVideosForSceneIds: (
    sceneIds: string[],
    stopRef?: { current: boolean },
    options?: AutoPostSceneGenOptions
  ) => Promise<AutoPostGenBatchResult>;
  runGenerateImagesForSceneIds?: (
    sceneIds: string[],
    stopRef?: { current: boolean },
    options?: AutoPostSceneGenOptions
  ) => Promise<AutoPostGenBatchResult>;
  getGeneratedVideo: (sceneId: string) => Promise<GeneratedVideoLike | null | undefined>;
  getGeneratedImage?: (sceneId: string) => Promise<unknown>;
  persistGroupPublish?: (params: PersistSocialPostPublishParams) => Promise<void>;
  refreshPackageQuota?: () => Promise<AutoPostPackageSnapshot | null | undefined>;
  /** Dừng gen ảnh/video đang chạy (hủy job backend). */
  abortGeneration?: () => void | Promise<void>;
  /** Hủy gen cho scene cụ thể (dừng từng bài đăng). */
  abortGenerationForSceneIds?: (sceneIds: string[]) => void | Promise<void>;
  needsImageBeforeVideo?: boolean;
  busy?: boolean;
}

export function useAutoPostSocialRunner({
  scenes,
  socialPostGroups,
  runGenerateVideosForSceneIds,
  runGenerateImagesForSceneIds,
  getGeneratedVideo,
  getGeneratedImage,
  persistGroupPublish,
  refreshPackageQuota,
  abortGeneration,
  abortGenerationForSceneIds,
  needsImageBeforeVideo = false,
  busy = false,
}: UseAutoPostSocialRunnerOptions) {
  const { t } = useTranslation();
  const toast = useToast();
  const { settings, credentials, hydrated } = useAutoPostSocialSettings();
  const stopRef = autoPostPipelineStopRef;
  const runningRef = autoPostPipelineRunningRef;
  const scenesRef = useRef(scenes);
  const groupsRef = useRef(socialPostGroups);
  const busyRef = useRef(busy);
  const persistRef = useRef(persistGroupPublish);
  const refreshPackageRef = useRef(refreshPackageQuota);
  const abortGenerationRef = useRef(abortGeneration);
  const abortGenerationForSceneIdsRef = useRef(abortGenerationForSceneIds);
  const getGeneratedImageRef = useRef(getGeneratedImage);
  const packageRef = useRef<AutoPostPackageSnapshot | null>(null);
  scenesRef.current = scenes;
  groupsRef.current = socialPostGroups;
  busyRef.current = busy;
  persistRef.current = persistGroupPublish;
  refreshPackageRef.current = refreshPackageQuota;
  abortGenerationRef.current = abortGeneration;
  abortGenerationForSceneIdsRef.current = abortGenerationForSceneIds;
  getGeneratedImageRef.current = getGeneratedImage;

  useEffect(() => {
    patchAutoPostRunState({ playBlocked: busy && !runningRef.current });
  }, [busy]);

  const startRef = useRef<() => Promise<void>>(async () => {});
  const startGroupRef = useRef<(groupId: string) => Promise<void>>(async () => {});
  const stopFnRef = useRef<() => void>(() => {});
  const stopGroupFnRef = useRef<(groupId: string) => void>(() => {});

  const stop = useCallback(() => {
    stopRef.current = true;
    void abortGenerationRef.current?.();
    const activeStatuses = new Set(["generating", "merging", "uploading"]);
    for (const [groupId, info] of Object.entries(getAutoPostRunState().groups)) {
      if (info?.status && activeStatuses.has(info.status)) {
        markAutoPostGroupStopped(groupId);
        setAutoPostGroupInfo(groupId, { status: "stopped", message: t("Đã dừng") });
      }
    }
    patchAutoPostRunState({ statusLabel: t("Đang dừng…") });
  }, [t]);

  const stopGroup = useCallback(
    (groupId: string) => {
      markAutoPostGroupStopped(groupId);
      setAutoPostGroupInfo(groupId, { status: "stopped", message: t("Đã dừng") });
      const allGroups = buildGroupsFromScenes(scenesRef.current, groupsRef.current);
      const group = allGroups.find((g) => g.id === groupId);
      if (group?.sceneIds.length) {
        void abortGenerationForSceneIdsRef.current?.(group.sceneIds);
      }
      patchAutoPostRunState({
        statusLabel: t("Đã dừng bài đăng — tiếp tục các bài khác…"),
      });
    },
    [t]
  );

  stopFnRef.current = stop;
  stopGroupFnRef.current = stopGroup;

  const validateReady = useCallback((): boolean => {
    if (!hydrated || !settings.enabled) {
      toast.info(t("Hãy bật Tự động đăng MXH trước"));
      return false;
    }
    const youtubeOn = settings.platforms.youtube?.enabled;
    const facebookOn = settings.platforms.facebook?.enabled;
    if (youtubeOn && !credentials.youtube?.active) {
      toast.warn(t("Chưa kết nối YouTube — mở Setting để thêm OAuth"));
      return false;
    }
    if (facebookOn && !credentials.facebook?.active) {
      toast.warn(t("Chưa kết nối Facebook — mở Setting để thêm Page Access Token"));
      return false;
    }
    return true;
  }, [
    credentials.facebook?.active,
    credentials.youtube?.active,
    hydrated,
    settings.enabled,
    settings.platforms.facebook?.enabled,
    settings.platforms.youtube?.enabled,
    t,
    toast,
  ]);

  const syncPackageQuota = useCallback(async (): Promise<AutoPostPackageSnapshot | null> => {
    try {
      const pkg = await refreshPackageRef.current?.();
      if (pkg) {
        packageRef.current = pkg;
        return pkg;
      }
    } catch {
      // fallback cache FE
    }
    return packageRef.current;
  }, []);

  /** Phase 2: nối + upload một bài đăng (không gen). */
  const publishOneGroup = useCallback(
    async (
      group: SocialPostGroup,
      displayIndex: number,
      platforms: PlatformUploadFlags
    ): Promise<GroupRunOutcome> => {
      const n = displayIndex + 1;
      const videosReady = await countScenesWithVideo(group.sceneIds, getGeneratedVideo);

      if (videosReady === 0) {
        setAutoPostGroupInfo(group.id, {
          status: "error",
          message: t("Chưa có video để đăng"),
        });
        return "error";
      }

      if (isAutoPostGroupStopped(group.id) || stopRef.current) {
        setAutoPostGroupInfo(group.id, { status: "stopped", message: t("Đã dừng") });
        return "stopped";
      }

      patchAutoPostRunState({
        currentGroupId: group.id,
        currentGroupIndex: displayIndex,
        statusLabel: t("Bài đăng #{{n}}: nối / chuẩn bị video…", { n }),
      });
      setAutoPostGroupInfo(group.id, {
        status: "merging",
        message: t("Đang nối video…"),
      });

      let blob: Blob;
      let videoCount = 0;
      try {
        const merged = await mergeSceneVideosToBlob({
          scenes: scenesRef.current,
          getGeneratedVideo,
          sceneIds: group.sceneIds,
          onProgress: (ratio, message) => {
            patchAutoPostRunState({
              statusLabel: t("Bài đăng #{{n}}: {{msg}} ({{pct}}%)", {
                n,
                msg: message,
                pct: Math.round(ratio * 100),
              }),
            });
          },
        });
        blob = merged.blob;
        videoCount = merged.count;
      } catch (err: any) {
        setAutoPostGroupInfo(group.id, {
          status: "error",
          message: err?.message || t("Lỗi nối video"),
        });
        return "error";
      }

      if (isAutoPostGroupStopped(group.id) || stopRef.current) {
        setAutoPostGroupInfo(group.id, { status: "stopped", message: t("Đã dừng") });
        return "stopped";
      }

      patchAutoPostRunState({
        statusLabel: t("Bài đăng #{{n}}: xóa logo AI…", { n }),
      });
      setAutoPostGroupInfo(group.id, {
        status: "merging",
        message: t("Đang xóa logo AI…"),
      });

      let clearWarning: string | undefined;
      try {
        const cleared = await clearVideoBlobWatermark({
          blob,
          clientId: `social-post-${group.id}`,
          name: `social-post-${n}.mp4`,
        });
        blob = cleared.blob;
        if (!cleared.cleared && cleared.warning) {
          clearWarning = cleared.warning;
          console.warn("[auto-post] clear watermark skipped:", cleared.warning);
        }
      } catch (err: any) {
        clearWarning = err?.message || t("Lỗi xóa logo AI");
        console.warn("[auto-post] clear watermark failed:", err);
      }

      if (isAutoPostGroupStopped(group.id) || stopRef.current) {
        setAutoPostGroupInfo(group.id, { status: "stopped", message: t("Đã dừng") });
        return "stopped";
      }

      const mergedVideoUrl = URL.createObjectURL(blob);
      const mergeMessage =
        videoCount >= 2
          ? t("Đã nối {{count}} video", { count: videoCount })
          : t("Đã chuẩn bị video");
      const clearSuffix = clearWarning ? ` (${clearWarning})` : "";
      if (videoCount >= 2) {
        setAutoPostGroupInfo(group.id, {
          status: "merging",
          mergedVideoUrl,
          message: mergeMessage + clearSuffix,
        });
      } else {
        setAutoPostGroupInfo(group.id, { mergedVideoUrl, message: mergeMessage + clearSuffix });
      }

      if (!hasAnyUploadPlatform(platforms)) {
        const message = t("Bỏ qua upload (không có nền tảng nào bật)");
        try {
          await persistRef.current?.({
            groupId: group.id,
            blob,
            videoCount,
            publish: { status: "ready", message },
          });
        } catch (err: any) {
          console.error("[auto-post] persist ready:", err);
        }
        setAutoPostGroupInfo(group.id, { status: "done", mergedVideoUrl, message });
        return "done";
      }

      if (isAutoPostGroupStopped(group.id) || stopRef.current) {
        setAutoPostGroupInfo(group.id, {
          status: "stopped",
          mergedVideoUrl,
          message: t("Đã dừng"),
        });
        return "stopped";
      }

      const uploadTargets: string[] = [];
      if (platforms.youtube) uploadTargets.push("YouTube");
      if (platforms.facebook) uploadTargets.push("Facebook");

      patchAutoPostRunState({
        statusLabel: t("Bài đăng #{{n}}: đăng {{platforms}}…", {
          n,
          platforms: uploadTargets.join(" + "),
        }),
      });
      setAutoPostGroupInfo(group.id, {
        status: "uploading",
        mergedVideoUrl,
        message: t("Đang upload {{platforms}}…", { platforms: uploadTargets.join(" + ") }),
      });

      try {
        const videoBase64 = await blobToRawBase64(blob);
        if (isAutoPostGroupStopped(group.id) || stopRef.current) {
          setAutoPostGroupInfo(group.id, {
            status: "stopped",
            mergedVideoUrl,
            message: t("Đã dừng"),
          });
          return "stopped";
        }

        const publishResult: {
          youtubeUrl?: string;
          facebookUrl?: string;
          messageParts: string[];
        } = { messageParts: [] };
        const errors: string[] = [];

        if (platforms.youtube) {
          try {
            const meta = toPostYoutubeVideoMeta(group.platforms?.youtube);
            const affiliateLink = normalizeSocialPostFields(group.platforms?.youtube).link;
            if (!meta.title?.trim()) {
              meta.title = t("Bài đăng #{{n}}", { n }).slice(0, 100);
            }
            const result = await youtubePostRepository.postYoutubeVideo({
              videoBase64,
              ...meta,
              affiliateLink: affiliateLink || undefined,
            });
            publishResult.youtubeUrl = result.url;
            if (result.linkCommentWarning) {
              publishResult.messageParts.push(t("YouTube (comment link thất bại)"));
            } else if (result.linkCommentId) {
              publishResult.messageParts.push(t("YouTube + comment link"));
            } else {
              publishResult.messageParts.push(t("YouTube"));
            }
          } catch (err: any) {
            errors.push(err?.message || t("Lỗi đăng YouTube"));
          }
        }

        if (platforms.facebook) {
          try {
            const meta = toPostFacebookPageVideoMeta(group.platforms?.facebook);
            const affiliateLink = normalizeSocialPostFields(group.platforms?.facebook).link;
            if (!meta.title?.trim()) {
              meta.title = t("Bài đăng #{{n}}", { n }).slice(0, 255);
            }
            const result = await facebookPostRepository.postFacebookPageVideo({
              videoBase64,
              ...meta,
              affiliateLink: affiliateLink || undefined,
            });
            publishResult.facebookUrl = result.url;
            if (!result.published) {
              publishResult.messageParts.push(t("Facebook (chưa công khai — đặt Riêng tư = public)"));
            } else if (result.linkCommentWarning) {
              publishResult.messageParts.push(t("Facebook (comment link thất bại)"));
            } else if (result.linkCommentId) {
              publishResult.messageParts.push(t("Facebook + comment link"));
            } else {
              publishResult.messageParts.push(t("Facebook"));
            }
          } catch (err: any) {
            errors.push(err?.message || t("Lỗi đăng Facebook"));
          }
        }

        if (!publishResult.youtubeUrl && !publishResult.facebookUrl) {
          const message = errors.join(" · ") || t("Lỗi upload");
          setAutoPostGroupInfo(group.id, {
            status: "error",
            mergedVideoUrl,
            message,
          });
          return "error";
        }

        const message = publishResult.messageParts.length
          ? t("Đã đăng {{platforms}}", { platforms: publishResult.messageParts.join(", ") })
          : t("Đã đăng");
        const partialError = errors.length ? ` (${errors.join(" · ")})` : "";
        const clearNote = clearWarning ? ` · ${t("Xóa logo")}: ${clearWarning}` : "";

        try {
          await persistRef.current?.({
            groupId: group.id,
            blob,
            videoCount,
            publish: {
              status: "posted",
              youtubeUrl: publishResult.youtubeUrl,
              facebookUrl: publishResult.facebookUrl,
              message: message + partialError + clearNote,
            },
          });
        } catch (err: any) {
          console.error("[auto-post] persist posted:", err);
        }

        setAutoPostGroupInfo(group.id, {
          status: "done",
          mergedVideoUrl,
          youtubeUrl: publishResult.youtubeUrl,
          facebookUrl: publishResult.facebookUrl,
          message: message + partialError + clearNote,
        });
        return errors.length ? "error" : "done";
      } catch (err: any) {
        setAutoPostGroupInfo(group.id, {
          status: "error",
          mergedVideoUrl,
          message: err?.message || t("Lỗi upload"),
        });
        return "error";
      }
    },
    [getGeneratedVideo, t]
  );

  /**
   * Phase 1: gom tất cả prompt, xen kẽ giữa các bài, chạy 1 pool song song.
   */
  const runGlobalGeneration = useCallback(
    async (
      groups: SocialPostGroup[],
      allGroups: SocialPostGroup[],
      options?: { onSceneComplete?: (sceneId: string) => void }
    ): Promise<"ok" | "stopped" | "quota_exhausted"> => {
      const allSceneIds = groups.flatMap((g) => g.sceneIds);
      const interleavedOrder = interleaveSceneIdsAcrossGroups(groups);
      const sceneToGroup = buildSceneToGroupMap(groups);
      const groupDisplayIndex = new Map(
        groups.map((g) => [g.id, Math.max(0, allGroups.findIndex((ag) => ag.id === g.id))])
      );
      const shouldAbortScene = (sceneId: string) => {
        const groupId = sceneToGroup.get(sceneId);
        return groupId ? isAutoPostGroupStopped(groupId) : false;
      };
      const genOptions = {
        shouldAbortScene,
        onSceneComplete: options?.onSceneComplete,
      };

      const makeOnSceneActive = (kind: "image" | "video") => (sceneId: string) => {
        const groupId = sceneToGroup.get(sceneId);
        if (!groupId || isAutoPostGroupStopped(groupId)) return;
        const displayIndex = groupDisplayIndex.get(groupId) ?? 0;
        const scene = scenesRef.current.find((s) => s.id === sceneId);
        const labelPrefix = kind === "video" ? t("tạo video") : t("tạo ảnh");
        setGroupGeneratingUnlessPublishing(groupId, {
          status: "generating",
          message:
            kind === "video"
              ? t("Đang tạo video cảnh #{{n}}…", { n: scene?.sceneNumber ?? "?" })
              : t("Đang tạo ảnh cảnh #{{n}}…", { n: scene?.sceneNumber ?? "?" }),
        });
        patchAutoPostRunState({
          currentGroupId: groupId,
          currentGroupIndex: displayIndex,
          statusLabel: t("Bài đăng #{{n}}: {{prefix}} #{{scene}}", {
            n: displayIndex + 1,
            prefix: labelPrefix,
            scene: scene?.sceneNumber ?? "?",
          }),
        });
      };

      for (const group of groups) {
        if (isAutoPostGroupStopped(group.id)) {
          setAutoPostGroupInfo(group.id, { status: "stopped", message: t("Đã dừng") });
          continue;
        }
        setGroupGeneratingUnlessPublishing(group.id, {
          status: "generating",
          message: t("Chờ lượt gen…"),
        });
      }

      const pkg = await syncPackageQuota();

      if (needsImageBeforeVideo && runGenerateImagesForSceneIds && getGeneratedImageRef.current) {
        const imageQuota = getAutoPostRemainingQuota(pkg, "image");
        let totalImagesNeeded = 0;
        for (const group of groups) {
          totalImagesNeeded += await countScenesNeedingImage(
            group.sceneIds,
            getGeneratedImageRef.current
          );
        }

        if (totalImagesNeeded > 0) {
          if (!imageQuota.unlimited && imageQuota.remaining <= 0) {
            for (const group of groups) {
              setAutoPostGroupInfo(group.id, {
                status: "error",
                message: t("Hết hạn mức ảnh"),
              });
            }
            return "quota_exhausted";
          }

          patchAutoPostRunState({
            statusLabel: t("Đang tạo ảnh ({{count}} bài, song song)…", { count: groups.length }),
          });
          for (const group of groups) {
            setGroupGeneratingUnlessPublishing(group.id, {
              status: "generating",
              message: t("Đang tạo ảnh…"),
            });
          }

          const maxImages = imageQuota.unlimited
            ? undefined
            : Math.min(totalImagesNeeded, imageQuota.remaining);
          const imageGen = await runGenerateImagesForSceneIds(allSceneIds, stopRef, {
            maxToGenerate: maxImages,
            sceneOrder: interleavedOrder,
            onSceneActive: makeOnSceneActive("image"),
            shouldAbortScene,
          });
          await syncPackageQuota();

          if (stopRef.current || imageGen.stopped) return "stopped";
        }
      }

      const freshPkg = await syncPackageQuota();
      const videoQuota = getAutoPostRemainingQuota(freshPkg, "video");
      let totalVideosNeeded = 0;
      for (const group of groups) {
        totalVideosNeeded += await countScenesNeedingVideoForPost(
          group.sceneIds,
          scenesRef.current,
          getGeneratedVideo
        );
      }

      if (totalVideosNeeded === 0) {
        for (const group of groups) {
          if (isAutoPostGroupStopped(group.id)) continue;
          for (const sceneId of group.sceneIds) {
            options?.onSceneComplete?.(sceneId);
          }
        }
        return "ok";
      }

      if (!videoQuota.unlimited && videoQuota.remaining <= 0) {
        for (const group of groups) {
          const hasVideo =
            (await countScenesWithVideo(group.sceneIds, getGeneratedVideo)) > 0;
          if (!hasVideo) {
            setAutoPostGroupInfo(group.id, {
              status: "error",
              message: t("Hết hạn mức video"),
            });
          }
        }
        return "quota_exhausted";
      }

      patchAutoPostRunState({
        statusLabel: t("Đang tạo video ({{count}} bài, song song)…", { count: groups.length }),
      });
      for (const group of groups) {
        setGroupGeneratingUnlessPublishing(group.id, {
          status: "generating",
          message: t("Đang tạo video…"),
        });
      }

      const maxVideos = videoQuota.unlimited
        ? undefined
        : Math.min(totalVideosNeeded, videoQuota.remaining);
      const videoGen = await runGenerateVideosForSceneIds(allSceneIds, stopRef, {
        maxToGenerate: maxVideos,
        sceneOrder: interleavedOrder,
        onSceneActive: makeOnSceneActive("video"),
        onSceneComplete: genOptions.onSceneComplete,
        shouldAbortScene,
      });
      await syncPackageQuota();

      if (stopRef.current || videoGen.stopped) return "stopped";
      return "ok";
    },
    [
      getGeneratedVideo,
      needsImageBeforeVideo,
      runGenerateImagesForSceneIds,
      runGenerateVideosForSceneIds,
      syncPackageQuota,
      t,
    ]
  );

  const startGroups = useCallback(
    async (groups: SocialPostGroup[], options?: { resetAll?: boolean }) => {
      if (runningRef.current || busyRef.current) return;
      if (!validateReady()) return;
      if (groups.length === 0) {
        toast.warn(t("Chưa có nhóm bài đăng — thêm dòng **Tiêu đề|...** trong prompt"));
        return;
      }

      const platformFlags: PlatformUploadFlags = {
        youtube: !!settings.platforms.youtube?.enabled,
        facebook: !!settings.platforms.facebook?.enabled,
      };
      const allGroups = buildGroupsFromScenes(scenesRef.current, groupsRef.current);

      if (options?.resetAll) {
        resetAutoPostRunState(false);
      } else {
        for (const group of groups) {
          clearAutoPostGroupStopped(group.id);
        }
      }

      runningRef.current = true;
      stopRef.current = false;
      patchAutoPostRunState({
        running: true,
        statusLabel: t("Bắt đầu đăng MXH…"),
        currentGroupIndex: 0,
      });

      packageRef.current = await syncPackageQuota();

      let posted = 0;
      let failed = 0;
      let skipped = 0;
      let quotaExhausted = false;
      const publishedGroupIds = new Set<string>();
      const publishInFlight = new Map<string, Promise<GroupRunOutcome>>();

      const recordOutcome = (outcome: GroupRunOutcome | null): boolean => {
        if (outcome === "stopped" && stopRef.current) return true;
        if (!outcome) return false;
        if (outcome === "done") posted += 1;
        else if (outcome === "skipped" || outcome === "stopped") skipped += 1;
        else failed += 1;
        return false;
      };

      const tryPublishGroup = async (group: SocialPostGroup): Promise<GroupRunOutcome | null> => {
        if (
          isAutoPostGroupStopped(group.id) ||
          stopRef.current ||
          publishedGroupIds.has(group.id) ||
          publishInFlight.has(group.id)
        ) {
          return null;
        }
        const ready = await isGroupReadyToPublish(
          group.sceneIds,
          scenesRef.current,
          getGeneratedVideo
        );
        if (!ready || stopRef.current) return null;
        if (publishedGroupIds.has(group.id) || publishInFlight.has(group.id)) return null;

        publishedGroupIds.add(group.id);
        const displayIndex = Math.max(
          0,
          allGroups.findIndex((g) => g.id === group.id)
        );
        const promise = publishOneGroup(group, displayIndex, platformFlags).finally(() => {
          publishInFlight.delete(group.id);
        });
        publishInFlight.set(group.id, promise);
        return promise;
      };

      const sceneToGroup = buildSceneToGroupMap(groups);
      const onSceneComplete = (sceneId: string) => {
        const groupId = sceneToGroup.get(sceneId);
        if (!groupId || isAutoPostGroupStopped(groupId)) return;
        const group = groups.find((g) => g.id === groupId);
        if (!group) return;
        void tryPublishGroup(group);
      };

      try {
        for (const group of groups) {
          if (isAutoPostGroupStopped(group.id)) continue;
          recordOutcome(await tryPublishGroup(group));
        }

        const genOutcome = await runGlobalGeneration(groups, allGroups, { onSceneComplete });
        if (genOutcome === "stopped" && stopRef.current) {
          for (const group of groups) {
            if (isAutoPostGroupStopped(group.id)) continue;
            const info = getAutoPostRunState().groups[group.id];
            if (info?.status === "generating") {
              setAutoPostGroupInfo(group.id, { status: "stopped", message: t("Đã dừng") });
            }
          }
          return;
        }
        if (genOutcome === "quota_exhausted") {
          quotaExhausted = true;
        }

        if (stopRef.current) return;

        patchAutoPostRunState({
          statusLabel: t("Đang nối và đăng {{count}} bài…", { count: groups.length }),
        });

        if (publishInFlight.size > 0) {
          const outcomes = await Promise.all(Array.from(publishInFlight.values()));
          for (const outcome of outcomes) {
            if (recordOutcome(outcome)) break;
          }
        }

        for (const group of groups) {
          if (stopRef.current) break;
          if (isAutoPostGroupStopped(group.id)) continue;
          if (recordOutcome(await tryPublishGroup(group))) break;
        }
      } finally {
        for (const group of groups) {
          if (isAutoPostGroupStopped(group.id)) {
            setAutoPostGroupInfo(group.id, { status: "stopped", message: t("Đã dừng") });
          }
        }
        const stopped = stopRef.current;
        runningRef.current = false;
        patchAutoPostRunState({
          running: false,
          currentGroupId: null,
          statusLabel: stopped
            ? t("Đã dừng — đăng {{posted}}, lỗi {{failed}}, bỏ qua {{skipped}}", {
                posted,
                failed,
                skipped,
              })
            : quotaExhausted
            ? t("Hết hạn mức — đăng {{posted}}, lỗi {{failed}}, bỏ qua {{skipped}}", {
                posted,
                failed,
                skipped,
              })
            : t("Hoàn thành — đăng {{posted}}, lỗi {{failed}}, bỏ qua {{skipped}}", {
                posted,
                failed,
                skipped,
              }),
        });
        if (stopped) {
          toast.info(t("Đã dừng auto-post MXH"));
        } else if (quotaExhausted) {
          toast.warn(
            t("Hết hạn mức gói — đăng {{posted}} bài, bỏ qua {{skipped}} bài", {
              posted,
              skipped,
            })
          );
        } else if (failed > 0 || skipped > 0) {
          toast.warn(
            t("Auto-post xong: {{posted}} thành công, {{failed}} lỗi, {{skipped}} bỏ qua", {
              posted,
              failed,
              skipped,
            })
          );
        } else {
          toast.success(t("Auto-post MXH hoàn thành ({{posted}} bài)", { posted }));
        }
      }
    },
    [
      publishOneGroup,
      runGlobalGeneration,
      settings.platforms.facebook?.enabled,
      settings.platforms.youtube?.enabled,
      syncPackageQuota,
      t,
      toast,
      validateReady,
    ]
  );

  const start = useCallback(async () => {
    const groups = buildGroupsFromScenes(scenesRef.current, groupsRef.current).filter(
      (g) => g.sceneIds.length > 0
    );
    await startGroups(groups, { resetAll: true });
  }, [startGroups]);

  startRef.current = start;

  const startGroup = useCallback(
    async (groupId: string) => {
      const groups = buildGroupsFromScenes(scenesRef.current, groupsRef.current).filter(
        (g) => g.sceneIds.length > 0
      );
      const group = groups.find((g) => g.id === groupId);
      if (!group) {
        toast.warn(t("Không tìm thấy bài đăng"));
        return;
      }
      await startGroups([group], { resetAll: false });
    },
    [startGroups, t, toast]
  );

  startGroupRef.current = startGroup;

  useEffect(() => {
    setAutoPostRunnerActions({
      startAll: () => {
        void startRef.current();
      },
      startGroup: (groupId: string) => {
        void startGroupRef.current(groupId);
      },
      stop: () => {
        stopFnRef.current();
      },
      stopGroup: (groupId: string) => {
        stopGroupFnRef.current(groupId);
      },
    });
    return () => {
      setAutoPostRunnerActions(null);
    };
  }, []);

  return {
    start,
    startGroup,
    stop,
    stopGroup,
    enabled: hydrated && settings.enabled,
  };
}

async function countScenesNeedingImage(
  sceneIds: string[],
  getGeneratedImage: (sceneId: string) => Promise<unknown>
): Promise<number> {
  let count = 0;
  for (const sceneId of sceneIds) {
    if (!(await getGeneratedImage(sceneId))) count += 1;
  }
  return count;
}
