/**
 * Row chính trong bảng MXH — header gọn: step icons + mũi tên;
 * metadata + video nằm trong panel mở rộng.
 */
import type { MouseEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiArrowUpSLine,
  RiCheckLine,
  RiCloseCircleLine,
  RiEditLine,
  RiEyeLine,
  RiHashtag,
  RiLink,
  RiLoader4Line,
  RiParentLine,
  RiPauseFill,
  RiPlayFill,
  RiPriceTag3Line,
  RiStackLine,
  RiStopCircleLine,
  RiText,
  RiUploadCloud2Line,
  RiVideoLine,
} from "react-icons/ri";
import { extractYoutubeVideoId } from "../../../../../../lib/helpers/ck-editor-content";
import {
  AutoPostGroupPhase,
  isAutoPostGroupStopped,
  useAutoPostGroupRunInfo,
  useAutoPostRunState,
  useAutoPostRunnerActions,
} from "../auto-post-social-run-store";
import { socialPostPublishedVideoKey } from "../social-post-published-video-storage";
import {
  toggleSocialPostGroupScenesExpanded,
  useSocialPostGroupScenesExpanded,
} from "../social-post-scenes-collapse-store";
import { SocialPostScenesCollapseSwitch } from "../social-post-scenes-collapse-switch";
import { useSocialPostGroupVideoReady } from "../use-social-post-group-video-ready";
import { useSocialPostPublishedVideoUrl } from "../use-social-post-published-video-url";

import {
  getSocialPostFieldMeta,
  getSocialPostHeaderFieldKeys,
  SOCIAL_POST_HEADER_FIELD_META,
  SocialPostGroup,
  SocialPostGroupPlatformMeta,
  SocialPostHeaderFieldKey,
  SocialPostPlatformFields,
  applyFieldsToAllPlatforms,
  normalizeSocialPostFields,
  normalizeSocialPostPublish,
} from "./types";
import { useAutoPostSocialSettings } from "../use-auto-post-social-settings";
import type { SocialPlatform } from "../types";

const FIELD_ICONS: Record<SocialPostHeaderFieldKey, ReactNode> = {
  title: <RiText className="text-xs" />,
  description: <RiText className="text-xs" />,
  hashtag: <RiHashtag className="text-xs" />,
  link: <RiLink className="text-xs" />,
  privacyStatus: <RiEyeLine className="text-xs" />,
  madeForKids: <RiParentLine className="text-xs" />,
  categoryId: <RiPriceTag3Line className="text-xs" />,
};

const FIELD_PLACEHOLDERS: Record<SocialPostHeaderFieldKey, string> = {
  title: "Tiêu đề",
  description: "Mô tả",
  hashtag: "#tag",
  link: "https://",
  privacyStatus: "private",
  madeForKids: "false",
  categoryId: "22",
};

function isPlaceholderFieldValue(key: SocialPostHeaderFieldKey, value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return (
    trimmed === FIELD_PLACEHOLDERS[key] ||
    trimmed === SOCIAL_POST_HEADER_FIELD_META[key].templateValue
  );
}

function buildGroupBadgeLabel(groupIndex: number, title: string): string {
  const n = groupIndex + 1;
  if (isPlaceholderFieldValue("title", title)) {
    return `#${n}`;
  }
  return `#${n} ${title.trim()}`;
}

function buildGroupBadgeTooltip(description: string): string | undefined {
  if (isPlaceholderFieldValue("description", description)) {
    return undefined;
  }
  return description.trim();
}

type StepKey = "generate" | "merge" | "upload" | "done";
type StepState = "pending" | "active" | "done" | "error" | "stopped" | "skipped";

const STOPPED_ROW_CLASS = "bg-danger-light border-b border-gray-300";
const STOPPED_STATUS_CLASS = "text-danger-dark bg-danger-light";

function getGroupRowSurfaceClass(
  runStatus: AutoPostGroupPhase | undefined,
  isVideoPosted: boolean,
  hasPublished: boolean,
  isGroupStopped: boolean
): string {
  if (isGroupStopped || runStatus === "stopped") {
    return STOPPED_ROW_CLASS;
  }
  if (isVideoPosted || hasPublished || runStatus === "done") {
    return "bg-success-light border-b border-gray-300";
  }
  switch (runStatus) {
    case "error":
      return "bg-danger-light border-b border-gray-300";
    case "generating":
    case "merging":
    case "uploading":
      return "bg-indigo-50 border-b border-gray-300";
    default:
      return "bg-purple-light border-b border-gray-300";
  }
}

function getRunStatusMessageClass(
  runStatus: AutoPostGroupPhase | undefined,
  hasPublished: boolean,
  isVideoPosted: boolean,
  isGroupStopped: boolean
): string {
  if (isGroupStopped || runStatus === "stopped") {
    return STOPPED_STATUS_CLASS;
  }
  if (runStatus === "done" || hasPublished || isVideoPosted) {
    return "text-success-dark bg-success-light";
  }
  if (runStatus === "error") {
    return "text-danger-dark bg-danger-light";
  }
  return "text-indigo-800 bg-white";
}

function inferErrorPhase(message?: string): StepKey {
  const m = (message || "").toLowerCase();
  if (
    m.includes("youtube") ||
    m.includes("facebook") ||
    m.includes("đăng") ||
    m.includes("upload")
  ) {
    return "upload";
  }
  if (m.includes("nối") || m.includes("merge")) return "merge";
  return "generate";
}

function resolveStepStates(
  runStatus: AutoPostGroupPhase | undefined,
  message: string | undefined,
  hasPublished: boolean,
  publishStatus: "posted" | "ready" | undefined,
  sceneCount: number,
  runExtras?: {
    mergedVideoUrl?: string;
    youtubeUrl?: string;
    facebookUrl?: string;
    allScenesHaveVideo?: boolean;
    hasMergedVideo?: boolean;
  }
): Record<StepKey, StepState> {
  const mergeSkipped = sceneCount <= 1;
  const skipMerge = mergeSkipped ? "skipped" : "pending";
  const allScenesHaveVideo = !!runExtras?.allScenesHaveVideo;
  const hasMergedVideo = !!(runExtras?.hasMergedVideo || runExtras?.mergedVideoUrl);

  if (hasPublished) {
    return {
      generate: "done",
      merge: mergeSkipped ? "skipped" : "done",
      upload: publishStatus === "posted" ? "done" : "skipped",
      done: "done",
    };
  }

  if (!runStatus || runStatus === "idle") {
    const generate: StepState = allScenesHaveVideo ? "done" : "pending";
    let merge: StepState = skipMerge as StepState;
    if (!mergeSkipped) {
      merge = hasMergedVideo ? "done" : "pending";
    }
    return {
      generate,
      merge,
      upload: "pending",
      done: "pending",
    };
  }

  if (runStatus === "error") {
    const failed = inferErrorPhase(message);
    const states: Record<StepKey, StepState> = {
      generate: "pending",
      merge: skipMerge as StepState,
      upload: "pending",
      done: "pending",
    };
    const order: StepKey[] = ["generate", "merge", "upload", "done"];
    for (const key of order) {
      if (key === failed) {
        states[key] = "error";
        break;
      }
      if (key === "merge" && mergeSkipped) continue;
      states[key] = "done";
    }
    return states;
  }

  if (runStatus === "stopped") {
    const states: Record<StepKey, StepState> = {
      generate: allScenesHaveVideo ? "done" : "stopped",
      merge: skipMerge as StepState,
      upload: "pending",
      done: "pending",
    };
    if (runExtras?.mergedVideoUrl || hasMergedVideo) {
      if (!mergeSkipped) states.merge = "done";
      states.upload = "stopped";
    } else if (allScenesHaveVideo && !mergeSkipped) {
      states.merge = "pending";
    }
    return states;
  }

  switch (runStatus) {
    case "generating":
      return {
        generate: "active",
        merge: skipMerge as StepState,
        upload: "pending",
        done: "pending",
      };
    case "merging":
      return {
        generate: "done",
        merge: "active",
        upload: "pending",
        done: "pending",
      };
    case "uploading":
      return {
        generate: "done",
        merge: mergeSkipped ? "skipped" : "done",
        upload: "active",
        done: "pending",
      };
    case "done":
      return {
        generate: "done",
        merge: mergeSkipped ? "skipped" : "done",
        upload: "done",
        done: "done",
      };
    default:
      return {
        generate: "pending",
        merge: skipMerge as StepState,
        upload: "pending",
        done: "pending",
      };
  }
}

function PipelineStepIcon({
  icon,
  label,
  state,
}: {
  icon: ReactNode;
  label: string;
  state: StepState;
}) {
  const shellClass =
    state === "done"
      ? "text-success bg-success-light border-success shadow-sm"
      : state === "active"
      ? "text-indigo-600 bg-indigo-50 border-indigo-300 ring-2 ring-indigo-100"
      : state === "error"
      ? "text-red-600 bg-red-50 border-red-200"
      : state === "stopped"
      ? "text-danger-dark bg-danger-light"
      : state === "skipped"
      ? "text-gray-300 bg-transparent border-transparent opacity-40"
      : "text-gray-400 bg-white border-gray-200";

  return (
    <span
      title={label}
      className={`inline-flex justify-center items-center w-6 h-5 rounded-md border transition-colors shrink-0 ${shellClass}`}
    >
      {state === "active" ? (
        <span className="flex relative justify-center items-center">
          <RiLoader4Line className="absolute text-sm opacity-40 animate-spin" />
          <span className="relative text-sm">{icon}</span>
        </span>
      ) : state === "error" ? (
        <RiCloseCircleLine className="text-sm" />
      ) : state === "stopped" ? (
        <RiStopCircleLine className="text-sm" />
      ) : (
        <span className="text-sm">{icon}</span>
      )}
    </span>
  );
}

function EditableMetaField({
  fieldKey,
  label,
  value,
  placeholder,
  disabled,
  wide,
  onCommit,
}: {
  fieldKey: SocialPostHeaderFieldKey;
  label: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  wide?: boolean;
  onCommit: (key: SocialPostHeaderFieldKey, next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    if (next === (value || "").trim()) {
      setDraft(value);
      return;
    }
    onCommit(fieldKey, next);
  };

  const empty = !value.trim();

  if (!editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setDraft(value);
          setEditing(true);
        }}
        title={`${label}: ${value || placeholder || "—"}`}
        className={`group/meta inline-flex items-center gap-1.5 max-w-xs px-2 py-1 rounded-md border text-left cursor-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          wide ? "min-w-[160px]" : "min-w-[100px]"
        } ${
          empty
            ? "text-purple-400 bg-white border-purple-200 border-dashed hover:border-purple-300"
            : "text-gray-700 bg-white border-purple-200 shadow-sm hover:border-purple-300"
        }`}
      >
        <span className="text-purple-500 shrink-0">{FIELD_ICONS[fieldKey]}</span>
        <span className="font-semibold tracking-wide text-purple-500 uppercase shrink-0 text-10">
          {label}
        </span>
        <span
          className={`text-xs font-medium truncate ${empty ? "text-purple-300" : "text-gray-800"}`}
        >
          {value || "—"}
        </span>
        {!disabled && (
          <RiEditLine className="shrink-0 text-xs text-purple-400 opacity-0 group-hover/meta:opacity-100 transition-opacity ml-0.5" />
        )}
      </button>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 max-w-sm px-2 py-1 rounded-md border bg-white border-indigo-400 shadow-sm ring-2 ring-indigo-100 ${
        wide ? "min-w-[180px]" : "min-w-[120px]"
      }`}
    >
      <span className="text-purple-500 shrink-0">{FIELD_ICONS[fieldKey]}</span>
      <span className="font-semibold tracking-wide text-purple-500 uppercase shrink-0 text-10">
        {label}
      </span>
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        placeholder={placeholder}
        className="flex-1 min-w-0 text-xs font-medium placeholder-purple-300 text-gray-800 bg-transparent border-0 outline-none"
      />
    </div>
  );
}

export function SocialPostGroupLabel({
  group,
  groupIndex,
  sceneCount = 0,
  onPlatformsChange,
}: {
  group: SocialPostGroup;
  groupIndex: number;
  sceneCount?: number;
  onPlatformsChange?: (groupId: string, platforms: SocialPostGroupPlatformMeta) => void;
}) {
  const { t } = useTranslation();
  const { settings: autoPostSettings } = useAutoPostSocialSettings();
  const f = normalizeSocialPostFields(group.platforms?.youtube);

  const metadataPlatform: SocialPlatform = useMemo(() => {
    if (autoPostSettings.platforms.youtube?.enabled) return "youtube";
    if (autoPostSettings.platforms.facebook?.enabled) return "facebook";
    if (autoPostSettings.platforms.tiktok?.enabled) return "tiktok";
    return "youtube";
  }, [
    autoPostSettings.platforms.facebook?.enabled,
    autoPostSettings.platforms.tiktok?.enabled,
    autoPostSettings.platforms.youtube?.enabled,
  ]);

  const visibleFieldKeys = useMemo(
    () => getSocialPostHeaderFieldKeys(metadataPlatform),
    [metadataPlatform]
  );
  const publish = normalizeSocialPostPublish(group.publish);
  const runInfo = useAutoPostGroupRunInfo(group.id);
  const runState = useAutoPostRunState();
  const actions = useAutoPostRunnerActions();
  const [expanded, setExpanded] = useState(false);
  const scenesExpanded = useSocialPostGroupScenesExpanded(group.id);
  const { url: publishedVideoUrl, loading: publishedVideoLoading } = useSocialPostPublishedVideoUrl(
    publish?.videoStorageKey,
    publish ? socialPostPublishedVideoKey(group.id) : undefined
  );
  const { allReady: allScenesHaveVideo } = useSocialPostGroupVideoReady(group.sceneIds);

  const hasPublished = publish?.status === "posted" || publish?.status === "ready";
  const hasMergedVideo = !!(publish?.videoStorageKey || runInfo?.mergedVideoUrl);
  const runStatus = runInfo?.status;
  const stepStates = resolveStepStates(
    runStatus,
    runInfo?.message,
    hasPublished,
    publish?.status,
    sceneCount,
    {
      mergedVideoUrl: runInfo?.mergedVideoUrl,
      youtubeUrl: runInfo?.youtubeUrl,
      facebookUrl: runInfo?.facebookUrl,
      allScenesHaveVideo,
      hasMergedVideo,
    }
  );

  const videoPreviewUrl = publishedVideoUrl || runInfo?.mergedVideoUrl || null;
  const youtubeUrl = publish?.youtubeUrl || runInfo?.youtubeUrl;
  const facebookUrl = publish?.facebookUrl || runInfo?.facebookUrl;
  const youtubeVideoId = extractYoutubeVideoId(youtubeUrl || "");
  const youtubeEmbedUrl = youtubeVideoId ? `https://www.youtube.com/embed/${youtubeVideoId}` : null;
  const isVideoPosted =
    publish?.status === "posted" ||
    (!!youtubeUrl && runInfo?.status === "done") ||
    (!!facebookUrl && runInfo?.status === "done");
  const hasStoredVideo = !!(publish?.videoStorageKey || publish?.status);
  const showVideoInPanel =
    videoPreviewUrl ||
    publishedVideoLoading ||
    hasStoredVideo ||
    youtubeUrl ||
    facebookUrl ||
    runInfo?.mergedVideoUrl;

  const isThisRunning = runState.running && runState.currentGroupId === group.id;
  const groupPipelineActive =
    runState.running &&
    !!runInfo?.status &&
    (runInfo.status === "generating" ||
      runInfo.status === "merging" ||
      runInfo.status === "uploading");
  const showPause = isThisRunning || groupPipelineActive;
  const playDisabled = !actions || (runState.playBlocked && !runState.running);
  const fieldsDisabled = runState.running || !onPlatformsChange;

  const commitField = (key: SocialPostHeaderFieldKey, next: string) => {
    if (!onPlatformsChange) return;
    const patched: SocialPostPlatformFields = { ...f, [key]: next };
    onPlatformsChange(group.id, applyFieldsToAllPlatforms(patched));
  };

  const onPlayClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (!actions) return;
    if (runState.running && showPause) {
      actions.stopGroup(group.id);
      return;
    }
    if (playDisabled) return;
    actions.startGroup(group.id);
  };

  const pipelineSteps: { key: StepKey; icon: ReactNode; label: string }[] = [
    { key: "generate", icon: <RiVideoLine />, label: t("Tạo video") },
    { key: "merge", icon: <RiStackLine />, label: t("Nối file") },
    { key: "upload", icon: <RiUploadCloud2Line />, label: t("Đăng video") },
    { key: "done", icon: <RiCheckLine />, label: t("Thành công") },
  ];

  const visibleSteps = pipelineSteps.filter((s) => s.key !== "merge" || sceneCount > 1);
  const isGroupStopped = runStatus === "stopped" || isAutoPostGroupStopped(group.id);
  const rowSurfaceClass = getGroupRowSurfaceClass(
    runStatus,
    isVideoPosted,
    hasPublished,
    isGroupStopped
  );
  const showRunStatusMessage =
    !!runInfo && runInfo.status !== "idle" && !!runInfo.message && !isVideoPosted;
  const runStatusMessageClass = getRunStatusMessageClass(
    runStatus,
    hasPublished,
    isVideoPosted,
    isGroupStopped
  );
  const groupBadgeLabel = buildGroupBadgeLabel(groupIndex, f.title);
  const groupBadgeTooltip = buildGroupBadgeTooltip(f.description);

  return (
    <div className={rowSurfaceClass}>
      <div className="flex min-w-full flex-row flex-nowrap items-center gap-2 px-3 py-2.5">
        <span
          className="inline-flex shrink-0 items-center max-w-2xs truncate px-2 py-0.5 text-10 font-bold tracking-wide text-white bg-purple rounded-md"
          title={groupBadgeTooltip}
        >
          {groupBadgeLabel}
        </span>
        {sceneCount > 0 && (
          <span className="inline-flex shrink-0 items-center px-2 py-0.5 text-10 font-semibold text-purple-700 bg-white rounded-md border border-purple-200">
            {t("{{count}} cảnh", { count: sceneCount })}
          </span>
        )}

        {/* Play + pipeline — gói chung bên trái */}
        <div className="inline-flex shrink-0 flex-row flex-nowrap items-center gap-0.5 border p-1 rounded-md bg-white">
          <button
            type="button"
            id={`auto-post-group-play-${group.id}`}
            title={showPause ? t("Dừng bài đăng này") : t("Chạy bài đăng này (gen → nối → đăng)")}
            onClick={onPlayClick}
            disabled={!showPause && playDisabled}
            className={`flex shrink-0 items-center justify-center w-6 h-5 rounded-md border cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              showPause
                ? "text-white bg-red-500 border-red-500 hover:bg-red-600"
                : "text-white bg-indigo-600 border-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {showPause ? <RiPauseFill className="text-sm" /> : <RiPlayFill className="text-sm" />}
          </button>

          {visibleSteps.map((step, i) => (
            <span key={step.key} className="inline-flex items-center gap-0.5">
              <RiArrowRightSLine className="text-xs text-purple-300 shrink-0" aria-hidden />
              <PipelineStepIcon icon={step.icon} label={step.label} state={stepStates[step.key]} />
            </span>
          ))}
        </div>

        {showRunStatusMessage && (
          <span
            className={`inline-flex shrink-0 items-center max-w-[12rem] truncate text-10 font-semibold ${
              isGroupStopped
                ? "text-danger-dark"
                : `px-2 py-0.5 rounded-md ${runStatusMessageClass}`
            }`}
            title={runInfo.message}
          >
            {runInfo.message}
          </span>
        )}

        <div className="flex-1 min-w-0" aria-hidden />

        <SocialPostScenesCollapseSwitch
          compact
          expanded={scenesExpanded}
          onToggle={() => toggleSocialPostGroupScenesExpanded(group.id)}
          className="shrink-0 px-1.5 py-0.5 rounded-md     "
        />

        {/* Mũi tên — luôn ở cuối */}
        <button
          type="button"
          title={expanded ? t("Thu gọn") : t("Xem metadata & video")}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="flex justify-center items-center w-6 h-6 text-purple-600 bg-white rounded-md border border-purple-200 transition-colors shrink-0 hover:bg-purple-50"
        >
          {expanded ? (
            <RiArrowUpSLine className="text-base" />
          ) : (
            <RiArrowDownSLine className="text-base" />
          )}
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pl-12 space-y-3">
          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-1.5">
            {visibleFieldKeys.map((key) => {
              const meta = getSocialPostFieldMeta(metadataPlatform, key);
              return (
                <EditableMetaField
                  key={key}
                  fieldKey={key}
                  label={t(meta.label)}
                  value={f[key] || ""}
                  placeholder={
                    key === "title"
                      ? t("Bài đăng #{{n}}", { n: groupIndex + 1 })
                      : FIELD_PLACEHOLDERS[key]
                  }
                  disabled={fieldsDisabled}
                  wide={key === "title" || key === "description"}
                  onCommit={commitField}
                />
              );
            })}
          </div>

          {/* Thông báo trạng thái — ẩn text khi đã đăng thành công */}
          {showRunStatusMessage && (
            <p
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-md w-full ${
                isGroupStopped ? STOPPED_STATUS_CLASS : runStatusMessageClass
              }`}
            >
              {runInfo.message}
            </p>
          )}

          {/* Video nối (Blob) + YouTube embed */}
          {showVideoInPanel && (
            <div className="flex flex-col gap-2 p-3 bg-white rounded-lg border border-purple-200 shadow-sm">
              {(isVideoPosted || youtubeUrl || facebookUrl || publish?.postedAt) && (
                <div className="flex flex-wrap gap-y-1 gap-x-2 items-center min-w-0 text-gray-500 text-10">
                  {isVideoPosted ? (
                    <span className="inline-flex gap-1 items-center text-xs font-semibold shrink-0 text-success">
                      <RiCheckLine className="text-sm" />
                      {t("Đã đăng video")}
                    </span>
                  ) : null}
                  {youtubeUrl ? (
                    <a
                      href={youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={youtubeUrl}
                      className="text-xs font-semibold text-red-600 shrink-0 hover:text-red-700 hover:underline"
                    >
                      {t("YouTube")}
                    </a>
                  ) : null}
                  {facebookUrl ? (
                    <a
                      href={facebookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={facebookUrl}
                      className="text-xs font-semibold text-blue-600 shrink-0 hover:text-blue-700 hover:underline"
                    >
                      {t("Facebook")}
                    </a>
                  ) : null}
                  {publish?.postedAt ? (
                    <>
                      {youtubeUrl || facebookUrl ? (
                        <span className="text-gray-300 shrink-0" aria-hidden>
                          ·
                        </span>
                      ) : null}
                      <span className="text-gray-400 shrink-0">
                        {t("Đăng lúc")}: {new Date(publish.postedAt).toLocaleString()}
                      </span>
                    </>
                  ) : null}
                </div>
              )}

              <div className="flex flex-wrap gap-3 items-start">
                {(videoPreviewUrl || publishedVideoLoading || hasStoredVideo) && (
                  <div className="relative shrink-0 rounded-lg border border-purple-200 bg-purple-50/50 p-1.5">
                    {publishedVideoLoading && !videoPreviewUrl ? (
                      <span className="flex gap-1 items-center px-2 py-6 text-xs text-gray-500">
                        <RiLoader4Line className="animate-spin" />
                        {t("Đang tải video…")}
                      </span>
                    ) : videoPreviewUrl ? (
                      <div className="relative">
                        {isVideoPosted ? (
                          <span
                            className="inline-flex absolute top-1 left-1 z-10 justify-center items-center w-5 h-5 rounded-full border shadow-sm border-success bg-success-light text-success"
                            title={t("Đã đăng video")}
                          >
                            <RiCheckLine className="text-xs" />
                          </span>
                        ) : null}
                        <video
                          src={videoPreviewUrl}
                          controls
                          className="object-contain w-48 max-w-full h-28 bg-black rounded-md"
                        />
                      </div>
                    ) : (
                      <span className="px-2 py-6 text-xs text-gray-400">
                        {t("Không tải được video")}
                      </span>
                    )}
                  </div>
                )}

                {youtubeUrl && youtubeEmbedUrl ? (
                  <div className="shrink-0 rounded-lg border border-red-200 bg-red-50/50 p-1.5">
                    <div className="overflow-hidden w-48 h-28 bg-black rounded-md border border-red-200">
                      <iframe
                        src={youtubeEmbedUrl}
                        title={t("YouTube")}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
