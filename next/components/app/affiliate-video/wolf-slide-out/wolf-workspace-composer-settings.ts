import type { WolfImageModelKey, WolfMultiplier } from "./wolf-workspace-generation";

export type WolfComposerMediaType = "image" | "video";
export type WolfComposerVideoMode = "frame" | "component";
export type WolfComposerImageAspectRatio = "16:9" | "9:16";
export type WolfComposerVideoAspectRatio = "16:9" | "9:16";
export type WolfComposerDuration = "4s" | "6s" | "8s" | "10s";

export type WolfComposerSettings = {
  projectId: string;
  mediaType: WolfComposerMediaType;
  videoMode: WolfComposerVideoMode;
  imageAspectRatio: WolfComposerImageAspectRatio;
  videoAspectRatio: WolfComposerVideoAspectRatio;
  duration: WolfComposerDuration;
  imageModelKey: WolfImageModelKey;
  videoModelIndex: number;
  multiplier: WolfMultiplier;
  updatedAt: number;
};

export const DEFAULT_WOLF_COMPOSER_SETTINGS: Omit<WolfComposerSettings, "projectId" | "updatedAt"> = {
  mediaType: "video",
  videoMode: "component",
  imageAspectRatio: "16:9",
  videoAspectRatio: "16:9",
  duration: "10s",
  imageModelKey: "bananaPro",
  videoModelIndex: 0,
  multiplier: "x2",
};

const IMAGE_ASPECT_RATIOS: WolfComposerImageAspectRatio[] = ["16:9", "9:16"];
const VIDEO_ASPECT_RATIOS: WolfComposerVideoAspectRatio[] = ["16:9", "9:16"];
const DURATIONS: WolfComposerDuration[] = ["4s", "6s", "8s", "10s"];
const MULTIPLIERS: WolfMultiplier[] = ["1x", "x2", "x3", "x4", "x5", "x6", "x8", "x16"];
const IMAGE_MODEL_KEYS: WolfImageModelKey[] = ["bananaPro", "banana2"];

export function getWolfComposerSettingsKey(projectId?: string | null): string {
  return projectId || "default";
}

export function createDefaultWolfComposerSettings(projectId: string): WolfComposerSettings {
  return {
    projectId,
    ...DEFAULT_WOLF_COMPOSER_SETTINGS,
    updatedAt: Date.now(),
  };
}

export function normalizeWolfComposerSettings(
  raw: Partial<WolfComposerSettings> | null | undefined,
  projectId: string,
  videoModelCount: number
): WolfComposerSettings | null {
  if (!raw || typeof raw !== "object") return null;

  const mediaType: WolfComposerMediaType = raw.mediaType === "image" ? "image" : "video";
  const videoMode: WolfComposerVideoMode = raw.videoMode === "frame" ? "frame" : "component";
  const imageAspectRatio = IMAGE_ASPECT_RATIOS.includes(
    raw.imageAspectRatio as WolfComposerImageAspectRatio
  )
    ? (raw.imageAspectRatio as WolfComposerImageAspectRatio)
    : DEFAULT_WOLF_COMPOSER_SETTINGS.imageAspectRatio;
  const videoAspectRatio = VIDEO_ASPECT_RATIOS.includes(
    raw.videoAspectRatio as WolfComposerVideoAspectRatio
  )
    ? (raw.videoAspectRatio as WolfComposerVideoAspectRatio)
    : DEFAULT_WOLF_COMPOSER_SETTINGS.videoAspectRatio;
  const imageModelKey = IMAGE_MODEL_KEYS.includes(raw.imageModelKey as WolfImageModelKey)
    ? (raw.imageModelKey as WolfImageModelKey)
    : DEFAULT_WOLF_COMPOSER_SETTINGS.imageModelKey;
  const multiplier = MULTIPLIERS.includes(raw.multiplier as WolfMultiplier)
    ? (raw.multiplier as WolfMultiplier)
    : DEFAULT_WOLF_COMPOSER_SETTINGS.multiplier;

  const maxVideoModelIndex = Math.max(videoModelCount - 1, 0);
  const videoModelIndex =
    typeof raw.videoModelIndex === "number" && raw.videoModelIndex >= 0
      ? Math.min(raw.videoModelIndex, maxVideoModelIndex)
      : DEFAULT_WOLF_COMPOSER_SETTINGS.videoModelIndex;

  let duration = DURATIONS.includes(raw.duration as WolfComposerDuration)
    ? (raw.duration as WolfComposerDuration)
    : DEFAULT_WOLF_COMPOSER_SETTINGS.duration;

  if (videoModelIndex !== 0 && duration === "10s") {
    duration = "8s";
  }

  return {
    projectId,
    mediaType,
    videoMode,
    imageAspectRatio,
    videoAspectRatio,
    duration,
    imageModelKey,
    videoModelIndex,
    multiplier,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
  };
}

export function buildWolfComposerSettingsSnapshot(
  input: {
    projectId: string;
    mediaType: WolfComposerMediaType;
    videoMode: WolfComposerVideoMode;
    imageAspectRatio: WolfComposerImageAspectRatio;
    videoAspectRatio: WolfComposerVideoAspectRatio;
    duration: WolfComposerDuration;
    imageModelKey: WolfImageModelKey;
    videoModelIndex: number;
    multiplier: WolfMultiplier;
  },
  videoModelCount: number
): WolfComposerSettings {
  return normalizeWolfComposerSettings(
    { ...input, updatedAt: Date.now() },
    input.projectId,
    videoModelCount
  )!;
}
