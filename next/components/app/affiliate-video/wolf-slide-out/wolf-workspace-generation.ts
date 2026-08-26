/**
 * Gọi API tạo ảnh/video cho Wolf Workspace Composer.
 *
 * - Image: POST /api/app/generate-image-wolf/
 * - Video: POST /api/app/generate-video-wolf/
 */
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { useMediaGenerationJob } from "../../../../lib/hooks/useMediaGenerationJob";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { useToast } from "../../../../lib/providers/toast-provider";
import { CustomerService } from "../../../../lib/repo/customer/customer.repo";
import { Flow2VideoModeEnum, uid, DB_NAME, STORE_NAME } from "../constants";
import { GeneratedImageData, GeneratedVideoData } from "../copy-video/hook/useCopyVideoApi";
import { useConcurrencyLimits } from "../hook/useConcurrencyLimits";
import { useIndexedDB } from "../hook/useIndexedDB";
import {
  enrichGeneratedImageWithBase64,
  enrichGeneratedVideoWithBase64,
  generatedImageToApiBase64Input,
  generatedVideoToApiBase64Input,
  persistGeneratedImageWithEnrichment,
  persistGeneratedVideoWithEnrichment,
} from "../shared/generatedMediaUtils";
import {
  createWolfPendingItems,
  WolfItemGenerationConfig,
  WolfProjectItem,
} from "./wolf-project-item";
import type { WolfMediaAsset } from "./wolf-media-library";

export const WOLF_MAX_IMAGE_REFERENCES = 10;
export const WOLF_MAX_COMPONENT_REFERENCES = 3;
/** Flow2 / Wolf: tối đa số ảnh mỗi lần gọi API — vượt quá sẽ chạy tuần tự theo lô */
export const WOLF_MAX_IMAGES_PER_REQUEST = 4;

export type WolfImageAspectRatio = "16:9" | "9:16";
export type WolfVideoAspectRatio = "16:9" | "9:16";
export type WolfMediaType = "image" | "video";
export type WolfVideoMode = "frame" | "component";

/** Preset chips trong UI — vẫn lưu dạng "1x" / "xN" */
export const WOLF_MULTIPLIER_PRESETS = ["1x", "x2", "x3", "x4", "x5", "x6", "x8", "x16"] as const;
export type WolfPresetMultiplier = (typeof WOLF_MULTIPLIER_PRESETS)[number];
/** Cho phép số tùy chỉnh ngoài preset (vd: "x7", "x10") */
export type WolfMultiplier = WolfPresetMultiplier | string;

export const WOLF_MIN_MULTIPLIER = 1;
/** Trần tuyệt đối (an toàn) — hạn mức thực tế lấy theo gói còn lại */
export const WOLF_MAX_MULTIPLIER = 99999;

export type WolfPackageQuotaInput = {
  mediaType: WolfMediaType;
  imageLimit?: number | null;
  imageCount?: number | null;
  videoLimit?: number | null;
  videoCount?: number | null;
};

/** Hạn mức còn lại theo gói — limit < 0 = không giới hạn; chưa có gói → trần tuyệt đối */
export function getWolfPackageRemainingQuota(input: WolfPackageQuotaInput): {
  remaining: number;
  unlimited: boolean;
} {
  const isImage = input.mediaType === "image";
  const limitRaw = isImage ? input.imageLimit : input.videoLimit;
  const usedRaw = isImage ? input.imageCount : input.videoCount;

  if (limitRaw === undefined || limitRaw === null) {
    return { remaining: WOLF_MAX_MULTIPLIER, unlimited: true };
  }

  const limit = Number(limitRaw);
  const used = Number(usedRaw ?? 0);
  if (limit < 0) {
    return { remaining: WOLF_MAX_MULTIPLIER, unlimited: true };
  }
  return { remaining: Math.max(0, limit - used), unlimited: false };
}

/** Trần số lượng gen lần này: min(còn lại, absoluteMax khi unlimited) */
export function getWolfMultiplierCap(input: WolfPackageQuotaInput): number {
  const { remaining, unlimited } = getWolfPackageRemainingQuota(input);
  if (unlimited) return WOLF_MAX_MULTIPLIER;
  return remaining;
}

export type WolfImageModelKey = "bananaPro" | "banana2";

export const WOLF_IMAGE_MODELS: { key: WolfImageModelKey; label: string; apiModel: string }[] = [
  { key: "bananaPro", label: "Nano Banana Pro", apiModel: "NANO_BANANA_PRO" },
  { key: "banana2", label: "Nano Banana 2", apiModel: "NANO_BANANA_2" },
];

export type WolfGenerationImageInput = {
  prompt: string;
  aspectRatio: WolfImageAspectRatio;
  imageModel: WolfImageModelKey;
  multiplier: WolfMultiplier;
  referenceAssets: WolfMediaAsset[];
};

export type WolfGenerationVideoInput = {
  prompt: string;
  aspectRatio: WolfVideoAspectRatio;
  videoMode: WolfVideoMode;
  multiplier: WolfMultiplier;
  referenceAssets: WolfMediaAsset[];
  startFrameAsset: WolfMediaAsset | null;
  endFrameAsset: WolfMediaAsset | null;
};

export type WolfGenerationSubmitInput = {
  mediaType: WolfMediaType;
  projectId?: string | null;
  image?: WolfGenerationImageInput;
  video?: WolfGenerationVideoInput;
  onItemsCreated?: (items: WolfProjectItem[]) => void;
  onItemUpdated?: (item: WolfProjectItem) => void;
  /** Cập nhật preview ảnh/video theo sceneId — không đụng item status */
  onSceneMediaUpdated?: (
    sceneId: string,
    media: { sceneImage?: GeneratedImageData; sceneVideo?: GeneratedVideoData }
  ) => void;
  /** Socket progress — cập nhật % lên từng item card (giống scene-batch-row) */
  onItemProgress?: (itemIds: string[], progress: number, message?: string) => void;
};

export type WolfGenerationResult =
  | { type: "image"; items: WolfProjectItem[]; data: GeneratedImageData[] }
  | { type: "video"; items: WolfProjectItem[]; data: GeneratedVideoData[] };

export function wolfMediaAssetsToApiImages(
  assets: WolfMediaAsset[]
): { imageBytes: string; mimeType: string }[] {
  return assets
    .filter((asset) => asset.type === "image" && asset.dataBase64)
    .map((asset) => ({
      imageBytes: asset.dataBase64,
      mimeType: asset.mimeType || "image/jpeg",
    }));
}

export function clampWolfMultiplierCount(count: number, max = WOLF_MAX_MULTIPLIER): number {
  if (!Number.isFinite(count)) return WOLF_MIN_MULTIPLIER;
  const upper = Math.max(WOLF_MIN_MULTIPLIER, max);
  return Math.min(upper, Math.max(WOLF_MIN_MULTIPLIER, Math.floor(count)));
}

export function formatWolfMultiplier(count: number, max = WOLF_MAX_MULTIPLIER): WolfMultiplier {
  const n = clampWolfMultiplierCount(count, max);
  return n === 1 ? "1x" : `x${n}`;
}

export function parseWolfMultiplier(
  multiplier: string | null | undefined,
  max = WOLF_MAX_MULTIPLIER
): number {
  if (!multiplier) return WOLF_MIN_MULTIPLIER;
  const value = String(multiplier).replace(/^x/i, "");
  const parsed = Number.parseInt(value, 10);
  return clampWolfMultiplierCount(
    Number.isFinite(parsed) && parsed > 0 ? parsed : WOLF_MIN_MULTIPLIER,
    max
  );
}

export function normalizeWolfMultiplier(raw: unknown, max = WOLF_MAX_MULTIPLIER): WolfMultiplier {
  if (typeof raw === "number") return formatWolfMultiplier(raw, max);
  if (typeof raw === "string" && raw.trim()) {
    return formatWolfMultiplier(parseWolfMultiplier(raw, max), max);
  }
  return formatWolfMultiplier(2, max);
}

export function isWolfMultiplierPreset(multiplier: string): multiplier is WolfPresetMultiplier {
  return (WOLF_MULTIPLIER_PRESETS as readonly string[]).includes(multiplier);
}

/** Chia tổng số ảnh thành các lô ≤ maxPerRequest (mặc định 4) — mỗi lô là một job */
export function splitWolfImageRequestCounts(
  total: number,
  maxPerRequest = WOLF_MAX_IMAGES_PER_REQUEST
): number[] {
  if (total <= 0) return [];
  const chunks: number[] = [];
  let remaining = total;
  while (remaining > 0) {
    const size = Math.min(remaining, maxPerRequest);
    chunks.push(size);
    remaining -= size;
  }
  return chunks;
}

/** Đếm số luồng tạo đang chạy (theo batch/job) — dùng check concurrency giống element tab */
export function countWolfActiveGenerationSlots(
  items: WolfProjectItem[],
  mediaType: WolfMediaType
): number {
  const slots = new Set<string>();
  for (const item of items) {
    if (item.status !== "generating" || item.mediaType !== mediaType) continue;
    slots.add(item.generationBatchId || item.jobId || item.id);
  }
  return slots.size;
}

/** Đếm từng item đang gen / chờ gen (status=generating) — dùng trừ hạn mức gói */
export function countWolfGeneratingItems(
  items: WolfProjectItem[],
  mediaType: WolfMediaType
): number {
  let count = 0;
  for (const item of items) {
    if (item.status === "generating" && item.mediaType === mediaType) count += 1;
  }
  return count;
}

/** Hạn mức còn dùng được = còn lại gói − đang gen/chờ gen */
export function getWolfEffectiveMultiplierCap(
  packageRemaining: number,
  generatingCount: number
): number {
  return Math.max(0, packageRemaining - Math.max(0, generatingCount));
}

/** Worker pool — số worker = min(concurrency, taskCount), mỗi worker lấy task kế tiếp */
async function runWolfConcurrencyPool(
  concurrency: number,
  taskCount: number,
  worker: (taskIndex: number) => Promise<void>
): Promise<void> {
  if (taskCount <= 0) return;
  let nextTaskIndex = 0;
  const poolSize = Math.min(Math.max(1, concurrency), taskCount);

  const runWorker = async () => {
    while (true) {
      const taskIndex = nextTaskIndex;
      nextTaskIndex += 1;
      if (taskIndex >= taskCount) return;
      await worker(taskIndex);
    }
  };

  await Promise.all(Array.from({ length: poolSize }, () => runWorker()));
}

export function resolveWolfImageApiModel(imageModel: WolfImageModelKey): string {
  return WOLF_IMAGE_MODELS.find((item) => item.key === imageModel)?.apiModel ?? "NANO_BANANA_PRO";
}

export function buildWolfImageGenerationBody(
  input: WolfGenerationImageInput,
  imageCount = parseWolfMultiplier(input.multiplier)
) {
  const images = wolfMediaAssetsToApiImages(input.referenceAssets);
  return {
    prompt: input.prompt.trim(),
    images: images.length > 0 ? images : undefined,
    config: {
      numberOfImages: imageCount,
      aspectRatio: input.aspectRatio,
      imageModel: resolveWolfImageApiModel(input.imageModel),
    },
  };
}

export function buildWolfVideoGenerationBody(input: WolfGenerationVideoInput) {
  let images: { imageBytes: string; mimeType: string }[] = [];

  if (input.videoMode === "frame") {
    if (input.startFrameAsset) {
      images.push({
        imageBytes: input.startFrameAsset.dataBase64,
        mimeType: input.startFrameAsset.mimeType || "image/jpeg",
      });
    }
    if (input.endFrameAsset) {
      images.push({
        imageBytes: input.endFrameAsset.dataBase64,
        mimeType: input.endFrameAsset.mimeType || "image/jpeg",
      });
    }
  } else {
    images = wolfMediaAssetsToApiImages(input.referenceAssets);
  }

  const videoMode =
    input.videoMode === "frame" ? Flow2VideoModeEnum.FRAME : Flow2VideoModeEnum.COMPONENT;

  return {
    prompt: input.prompt.trim(),
    images: images.length > 0 ? images : undefined,
    video_mode: videoMode,
    config: {
      aspectRatio: input.aspectRatio,
      videoMode,
    },
  };
}

export function buildWolfImageItemGenerationConfig(
  input: WolfGenerationImageInput
): WolfItemGenerationConfig {
  return {
    mediaType: "image",
    imageModel: input.imageModel,
    referenceAssetIds: input.referenceAssets.map((asset) => asset.id),
  };
}

export function buildWolfVideoItemGenerationConfig(
  input: WolfGenerationVideoInput
): WolfItemGenerationConfig {
  return {
    mediaType: "video",
    videoMode: input.videoMode,
    referenceAssetIds: input.referenceAssets.map((asset) => asset.id),
    startFrameAssetId: input.startFrameAsset?.id,
    endFrameAssetId: input.endFrameAsset?.id,
  };
}

async function loadWolfAssetsByIds(
  assetDB: { get: (key: string) => Promise<WolfMediaAsset | undefined> },
  ids: string[]
): Promise<WolfMediaAsset[]> {
  const assets: WolfMediaAsset[] = [];
  for (const id of ids) {
    const asset = await assetDB.get(id);
    if (asset) assets.push(asset);
  }
  return assets;
}

async function resolveWolfImageInputFromItem(
  item: WolfProjectItem,
  assetDB: { get: (key: string) => Promise<WolfMediaAsset | undefined> }
): Promise<WolfGenerationImageInput> {
  const config = item.generationConfig?.mediaType === "image" ? item.generationConfig : null;
  const referenceAssets = config
    ? await loadWolfAssetsByIds(assetDB, config.referenceAssetIds)
    : [];
  return {
    prompt: item.prompt,
    aspectRatio: item.aspectRatio ?? "16:9",
    imageModel: config?.imageModel ?? "bananaPro",
    multiplier: "1x",
    referenceAssets,
  };
}

async function resolveWolfVideoInputFromItem(
  item: WolfProjectItem,
  assetDB: { get: (key: string) => Promise<WolfMediaAsset | undefined> }
): Promise<WolfGenerationVideoInput> {
  const config = item.generationConfig?.mediaType === "video" ? item.generationConfig : null;
  const referenceAssets = config
    ? await loadWolfAssetsByIds(assetDB, config.referenceAssetIds)
    : [];
  const startFrameAsset = config?.startFrameAssetId
    ? (await assetDB.get(config.startFrameAssetId)) ?? null
    : null;
  const endFrameAsset = config?.endFrameAssetId
    ? (await assetDB.get(config.endFrameAssetId)) ?? null
    : null;
  return {
    prompt: item.prompt,
    aspectRatio: item.aspectRatio ?? "16:9",
    videoMode: config?.videoMode ?? "component",
    multiplier: "1x",
    referenceAssets,
    startFrameAsset,
    endFrameAsset,
  };
}

async function clearWolfItemGeneratedMedia(
  item: WolfProjectItem,
  stores: {
    sceneImageDB: { remove: (key: string) => Promise<void> };
    sceneVideoDB: { remove: (key: string) => Promise<void> };
    assetDB: { remove: (key: string) => Promise<void> };
  }
): Promise<void> {
  if (item.mediaType === "image") {
    await stores.sceneImageDB.remove(item.sceneId);
  } else {
    await stores.sceneVideoDB.remove(item.sceneId);
  }
  if (item.assetId) {
    await stores.assetDB.remove(item.assetId);
  }
}

export type WolfRetryItemInput = {
  item: WolfProjectItem;
  onItemUpdated?: (item: WolfProjectItem) => void;
  onSceneMediaUpdated?: (
    sceneId: string,
    media: { sceneImage?: GeneratedImageData; sceneVideo?: GeneratedVideoData }
  ) => void;
  onItemProgress?: (itemIds: string[], progress: number, message?: string) => void;
};

async function generatedImageToWolfAsset(
  projectId: string,
  data: GeneratedImageData,
  name: string
): Promise<WolfMediaAsset | null> {
  try {
    const enriched = await enrichGeneratedImageWithBase64(data);
    const { imageBytes, mimeType } = await generatedImageToApiBase64Input(enriched);
    if (!imageBytes) return null;
    return {
      id: uid(),
      projectId,
      name,
      type: "image",
      mimeType: mimeType || "image/jpeg",
      dataBase64: imageBytes,
      createdAt: Date.now(),
    };
  } catch {
    return null;
  }
}

async function generatedVideoToWolfAsset(
  projectId: string,
  data: GeneratedVideoData,
  name: string
): Promise<WolfMediaAsset | null> {
  try {
    const enriched = await enrichGeneratedVideoWithBase64(data);
    const { videoBytes, mimeType } = await generatedVideoToApiBase64Input(enriched);
    if (!videoBytes) return null;
    return {
      id: uid(),
      projectId,
      name,
      type: "video",
      mimeType: mimeType || "video/mp4",
      dataBase64: videoBytes,
      createdAt: Date.now(),
    };
  } catch {
    return null;
  }
}

export function useWolfWorkspaceGeneration() {
  const { t } = useTranslation();
  const toast = useToast();
  const { customer, setCustomer } = useAuth();
  const { IMAGE_CONCURRENCY, VIDEO_CONCURRENCY } = useConcurrencyLimits();
  const assetDB = useIndexedDB<WolfMediaAsset>(STORE_NAME.wolfAssets, DB_NAME.wolf);
  const itemDB = useIndexedDB<WolfProjectItem>(STORE_NAME.wolfItems, DB_NAME.wolf);
  const sceneImageDB = useIndexedDB<GeneratedImageData>(STORE_NAME.wolfSceneImages, DB_NAME.wolf);
  const sceneVideoDB = useIndexedDB<GeneratedVideoData>(STORE_NAME.wolfSceneVideos, DB_NAME.wolf);
  const imageJob = useMediaGenerationJob<{ images: GeneratedImageData[] }>();
  const videoJob = useMediaGenerationJob<GeneratedVideoData>();

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const finalizeImageItem = useCallback(
    async (
      item: WolfProjectItem,
      imageData: GeneratedImageData,
      projectId: string,
      callbacks?: {
        onItemUpdated?: (item: WolfProjectItem) => void;
        onSceneMediaUpdated?: WolfGenerationSubmitInput["onSceneMediaUpdated"];
      }
    ): Promise<WolfProjectItem> => {
      const { onItemUpdated, onSceneMediaUpdated } = callbacks ?? {};
      const persisted = await persistGeneratedImageWithEnrichment(
        item.sceneId,
        imageData,
        sceneImageDB,
        {
          waitForClear: true,
          onUpdate: (data) => onSceneMediaUpdated?.(item.sceneId, { sceneImage: data }),
        }
      );

      const asset = await generatedImageToWolfAsset(
        projectId,
        persisted || imageData,
        t("Ảnh đã tạo")
      );
      if (!asset) {
        const failedItem: WolfProjectItem = {
          ...item,
          status: "failed",
          errorMessage: t("Không thể lưu ảnh đã tạo"),
        };
        await itemDB.set(item.id, failedItem);
        onItemUpdated?.(failedItem);
        return failedItem;
      }

      await assetDB.set(asset.id, asset);
      const readyItem: WolfProjectItem = { ...item, status: "ready", assetId: asset.id };
      await itemDB.set(item.id, readyItem);
      onItemUpdated?.(readyItem);
      return readyItem;
    },
    [assetDB, itemDB, sceneImageDB, t]
  );

  const finalizeVideoItem = useCallback(
    async (
      item: WolfProjectItem,
      videoData: GeneratedVideoData,
      projectId: string,
      aspectRatio: WolfVideoAspectRatio,
      callbacks?: {
        onItemUpdated?: (item: WolfProjectItem) => void;
        onSceneMediaUpdated?: WolfGenerationSubmitInput["onSceneMediaUpdated"];
      }
    ): Promise<WolfProjectItem> => {
      const { onItemUpdated, onSceneMediaUpdated } = callbacks ?? {};
      await persistGeneratedVideoWithEnrichment(
        item.sceneId,
        { ...videoData, aspectRatio },
        sceneVideoDB,
        {
          onUpdate: (data) => onSceneMediaUpdated?.(item.sceneId, { sceneVideo: data }),
        }
      );

      const asset = await generatedVideoToWolfAsset(projectId, videoData, t("Video đã tạo"));
      if (!asset) {
        const failedItem: WolfProjectItem = {
          ...item,
          status: "failed",
          errorMessage: t("Không thể lưu video đã tạo"),
        };
        await itemDB.set(item.id, failedItem);
        onItemUpdated?.(failedItem);
        return failedItem;
      }

      await assetDB.set(asset.id, asset);
      const readyItem: WolfProjectItem = { ...item, status: "ready", assetId: asset.id };
      await itemDB.set(item.id, readyItem);
      onItemUpdated?.(readyItem);
      return readyItem;
    },
    [assetDB, itemDB, sceneVideoDB, t]
  );

  const submit = useCallback(
    async (input: WolfGenerationSubmitInput): Promise<WolfGenerationResult | undefined> => {
      const scopedProjectId = input.projectId || "default";
      const { onItemsCreated, onItemUpdated, onSceneMediaUpdated, onItemProgress } = input;
      let activeItems: WolfProjectItem[] = [];

      const markActiveItemsFailed = async (message: string) => {
        for (const item of activeItems) {
          const current = await itemDB.get(item.id);
          if (!current || current.status !== "generating") continue;
          const failedItem: WolfProjectItem = {
            ...current,
            status: "failed",
            errorMessage: message,
          };
          await itemDB.set(item.id, failedItem);
          onItemUpdated?.(failedItem);
        }
      };

      const bindJobProgress = (items: WolfProjectItem[]) => ({
        onProgress: (pct: number) => {
          setProgress((prev) => Math.max(prev, pct));
          onItemProgress?.(
            items.map((entry) => entry.id),
            pct
          );
        },
        onStatusMessage: (msg: string) => setStatusMessage(msg),
      });

      const attachJobIdToItems = async (items: WolfProjectItem[], jobId: string) => {
        const next: WolfProjectItem[] = [];
        for (const item of items) {
          const withJob: WolfProjectItem = { ...item, jobId };
          await itemDB.set(item.id, withJob);
          next.push(withJob);
          onItemUpdated?.(withJob);
        }
        return next;
      };

      if (input.mediaType === "image") {
        const imageInput = input.image;
        if (!imageInput?.prompt.trim()) {
          const message = t("Vui lòng nhập prompt");
          setError(message);
          toast.error(message);
          return undefined;
        }
        if (imageInput.referenceAssets.length > WOLF_MAX_IMAGE_REFERENCES) {
          const message = t("Tối đa {{count}} ảnh tham chiếu", {
            count: WOLF_MAX_IMAGE_REFERENCES,
          });
          setError(message);
          toast.error(message);
          return undefined;
        }
      } else {
        const videoInput = input.video;
        if (!videoInput?.prompt.trim()) {
          const message = t("Vui lòng nhập prompt");
          setError(message);
          toast.error(message);
          return undefined;
        }
        if (videoInput.videoMode === "component") {
          if (
            videoInput.referenceAssets.length > 0 &&
            videoInput.referenceAssets.length > WOLF_MAX_COMPONENT_REFERENCES
          ) {
            const message = t("Chế độ Thành phần chỉ hỗ trợ tối đa {{count}} ảnh", {
              count: WOLF_MAX_COMPONENT_REFERENCES,
            });
            setError(message);
            toast.error(message);
            return undefined;
          }
        }
      }

      // Lấy customer mới nhất trước khi check hạn mức — tránh spam khi FE còn cache cũ
      let pkg = customer?.googlePackage;
      try {
        const info = await CustomerService.customerGetInfo();
        if (info?.customer) {
          setCustomer?.(info.customer);
          pkg = info.customer.googlePackage ?? pkg;
        }
      } catch {
        // fallback dùng customer đang có trên FE
      }

      const allProjectItems = await itemDB.getAll();
      const packageRemaining = getWolfMultiplierCap({
        mediaType: input.mediaType,
        imageLimit: pkg?.imageLimit,
        imageCount: pkg?.imageCount,
        videoLimit: pkg?.videoLimit,
        videoCount: pkg?.videoCount,
      });
      const inFlightCount = countWolfGeneratingItems(allProjectItems, input.mediaType);
      const multiplierCap = getWolfEffectiveMultiplierCap(packageRemaining, inFlightCount);
      const requestedCount = parseWolfMultiplier(
        input.mediaType === "image" ? input.image?.multiplier : input.video?.multiplier,
        Math.max(multiplierCap, WOLF_MIN_MULTIPLIER)
      );

      if (multiplierCap < WOLF_MIN_MULTIPLIER) {
        const message =
          inFlightCount > 0
            ? t("Hạn mức còn lại đang được dùng cho các tác vụ đang tạo. Vui lòng chờ hoàn thành.")
            : input.mediaType === "image"
              ? t("Hết hạn mức ảnh. Vui lòng nâng cấp gói hoặc chờ reset.")
              : t("Hết hạn mức video. Vui lòng nâng cấp gói hoặc chờ reset.");
        setError(message);
        toast.error(message);
        return undefined;
      }

      if (requestedCount > multiplierCap) {
        const message = t("Số lượng vượt hạn mức còn lại (tối đa {{count}})", {
          count: multiplierCap,
        });
        setError(message);
        toast.error(message);
        return undefined;
      }

      setGenerating(true);
      setProgress(0);
      setStatusMessage("");
      setError(null);

      if (input.mediaType === "image") {
        const activeImageSlots = countWolfActiveGenerationSlots(allProjectItems, "image");
        if (activeImageSlots >= IMAGE_CONCURRENCY) {
          const message = t("Đang tạo ảnh tối đa {{max}} luồng cùng lúc. Vui lòng chờ hoàn thành.", {
            max: IMAGE_CONCURRENCY,
          });
          setError(message);
          toast.error(message);
          setGenerating(false);
          return undefined;
        }
      } else {
        const activeVideoSlots = countWolfActiveGenerationSlots(allProjectItems, "video");
        if (activeVideoSlots >= VIDEO_CONCURRENCY) {
          const message = t("Đang tạo video tối đa {{max}} luồng cùng lúc. Vui lòng chờ hoàn thành.", {
            max: VIDEO_CONCURRENCY,
          });
          setError(message);
          toast.error(message);
          setGenerating(false);
          return undefined;
        }
      }

      try {
        if (input.mediaType === "image" && input.image) {
          const imageCount = parseWolfMultiplier(input.image.multiplier, multiplierCap);
          const generationBatchId = uid();
          const imageGenerationConfig = buildWolfImageItemGenerationConfig(input.image);
          const pendingItems = await createWolfPendingItems(itemDB, {
            projectId: scopedProjectId,
            mediaType: "image",
            prompt: input.image.prompt.trim(),
            count: imageCount,
            aspectRatio: input.image.aspectRatio,
            generationBatchId,
            generationConfig: imageGenerationConfig,
          });
          activeItems = pendingItems;
          onItemsCreated?.(pendingItems);

          const chunkSizes = splitWolfImageRequestCounts(imageCount);
          const imageChunks: WolfProjectItem[][] = [];
          let itemOffset = 0;
          for (const chunkSize of chunkSizes) {
            imageChunks.push(pendingItems.slice(itemOffset, itemOffset + chunkSize));
            itemOffset += chunkSize;
          }

          const finalizedItems: WolfProjectItem[] = [];
          const allResultImages: GeneratedImageData[] = [];

          await runWolfConcurrencyPool(IMAGE_CONCURRENCY, imageChunks.length, async (chunkIndex) => {
            const chunkItems = imageChunks[chunkIndex];
            const chunkSize = chunkItems.length;
            if (chunkSize === 0) return;

            const chunkStates = await Promise.all(chunkItems.map((item) => itemDB.get(item.id)));
            if (chunkStates.some((entry) => !entry || entry.status !== "generating")) return;

            const sceneIds = chunkItems.map((item) => item.sceneId);
            const body = buildWolfImageGenerationBody(input.image!, chunkSize);
            const imageProgressHandlers = bindJobProgress(chunkItems);

            try {
              const { data } = await imageJob.run({
                url: "/api/app/generate-image-wolf/",
                body: {
                  ...body,
                  _metadata: {
                    projectId: scopedProjectId,
                    source: "wolf-workspace",
                    sceneIds,
                    generationBatchId,
                    chunkIndex,
                  },
                },
                onProgress: imageProgressHandlers.onProgress,
                onJobEnqueued: (jobId) => {
                  void attachJobIdToItems(chunkItems, jobId).then((updated) => {
                    activeItems = activeItems.map((item) => {
                      const match = updated.find((entry) => entry.id === item.id);
                      return match ?? item;
                    });
                  });
                },
              });

              const resultImages = (data?.images || []) as GeneratedImageData[];
              allResultImages.push(...resultImages);

              for (let i = 0; i < chunkItems.length; i++) {
                const item = chunkItems[i];
                const imageData = resultImages[i];
                if (!imageData) {
                  const failedItem: WolfProjectItem = {
                    ...item,
                    status: "failed",
                    errorMessage: t("Không nhận được ảnh từ API"),
                  };
                  await itemDB.set(item.id, failedItem);
                  onItemUpdated?.(failedItem);
                  finalizedItems.push(failedItem);
                  continue;
                }

                const readyItem = await finalizeImageItem(
                  item,
                  imageData,
                  scopedProjectId,
                  { onItemUpdated, onSceneMediaUpdated }
                );
                finalizedItems.push(readyItem);
              }
            } catch (err: any) {
              const message = err?.message || t("Lỗi tạo ảnh");
              for (const item of chunkItems) {
                const current = await itemDB.get(item.id);
                if (!current || current.status !== "generating") continue;
                const failedItem: WolfProjectItem = {
                  ...item,
                  status: "failed",
                  errorMessage: message,
                };
                await itemDB.set(item.id, failedItem);
                onItemUpdated?.(failedItem);
                finalizedItems.push(failedItem);
              }
            }
          });

          if (finalizedItems.length === 0 || finalizedItems.every((item) => item.status === "failed")) {
            throw new Error(t("Không nhận được ảnh từ API"));
          }

          setProgress(100);
          toast.success(t("Tạo ảnh thành công"));
          return {
            type: "image",
            items: finalizedItems,
            data: allResultImages,
          };
        }

        if (input.mediaType === "video" && input.video) {
          const videoCount = parseWolfMultiplier(input.video.multiplier, multiplierCap);
          const generationBatchId = uid();
          const videoGenerationConfig = buildWolfVideoItemGenerationConfig(input.video);
          const pendingItems = await createWolfPendingItems(itemDB, {
            projectId: scopedProjectId,
            mediaType: "video",
            prompt: input.video.prompt.trim(),
            count: videoCount,
            aspectRatio: input.video.aspectRatio,
            generationBatchId,
            generationConfig: videoGenerationConfig,
          });
          activeItems = pendingItems;
          onItemsCreated?.(pendingItems);

          const body = buildWolfVideoGenerationBody(input.video);
          const finalizedItems: WolfProjectItem[] = [];
          const allResultVideos: GeneratedVideoData[] = [];

          await runWolfConcurrencyPool(VIDEO_CONCURRENCY, pendingItems.length, async (itemIndex) => {
            const pendingItem = pendingItems[itemIndex];
            const current = await itemDB.get(pendingItem.id);
            if (!current || current.status !== "generating") return;

            const videoProgressHandlers = bindJobProgress([pendingItem]);

            try {
              const { data } = await videoJob.run({
                url: "/api/app/generate-video-wolf/",
                body: {
                  ...body,
                  _metadata: {
                    projectId: scopedProjectId,
                    source: "wolf-workspace",
                    sceneId: pendingItem.sceneId,
                    sceneIds: [pendingItem.sceneId],
                    generationBatchId,
                    itemIndex,
                  },
                },
                onProgress: videoProgressHandlers.onProgress,
                onStatusMessage: videoProgressHandlers.onStatusMessage,
                onJobEnqueued: (jobId) => {
                  void attachJobIdToItems([pendingItem], jobId).then((updated) => {
                    activeItems = activeItems.map((entry) => {
                      const match = updated.find((item) => item.id === entry.id);
                      return match ?? entry;
                    });
                  });
                },
              });

              if (!data) {
                const failedItem: WolfProjectItem = {
                  ...pendingItem,
                  status: "failed",
                  errorMessage: t("Không nhận được video từ API"),
                };
                await itemDB.set(pendingItem.id, failedItem);
                onItemUpdated?.(failedItem);
                finalizedItems.push(failedItem);
                return;
              }

              const videoData = data as GeneratedVideoData;
              allResultVideos.push(videoData);
              const readyItem = await finalizeVideoItem(
                pendingItem,
                videoData,
                scopedProjectId,
                input.video!.aspectRatio,
                { onItemUpdated, onSceneMediaUpdated }
              );
              finalizedItems.push(readyItem);
            } catch (err: any) {
              const failedItem: WolfProjectItem = {
                ...pendingItem,
                status: "failed",
                errorMessage: err?.message || t("Lỗi tạo video"),
              };
              await itemDB.set(pendingItem.id, failedItem);
              onItemUpdated?.(failedItem);
              finalizedItems.push(failedItem);
            }
          });

          if (finalizedItems.length === 0 || finalizedItems.every((item) => item.status === "failed")) {
            throw new Error(t("Không nhận được video từ API"));
          }

          setProgress(100);
          setStatusMessage(t("Hoàn thành!"));
          toast.success(t("Tạo video thành công"));
          return {
            type: "video",
            items: finalizedItems,
            data: allResultVideos,
          };
        }

        return undefined;
      } catch (err: any) {
        const message = err?.message || t("Lỗi tạo media");
        await markActiveItemsFailed(message);
        setError(message);
        setProgress(0);
        toast.error(message);
        return undefined;
      } finally {
        setGenerating(false);
        // Đồng bộ lại hạn mức sau khi gen (backend đã trừ lượt)
        try {
          const info = await CustomerService.customerGetInfo();
          if (info?.customer) setCustomer?.(info.customer);
        } catch {
          // ignore
        }
      }
    },
    [assetDB, customer, finalizeImageItem, finalizeVideoItem, imageJob, itemDB, sceneVideoDB, setCustomer, t, toast, videoJob, IMAGE_CONCURRENCY, VIDEO_CONCURRENCY]
  );

  const retryItem = useCallback(
    async (input: WolfRetryItemInput): Promise<WolfProjectItem | undefined> => {
      const { item, onItemUpdated, onSceneMediaUpdated, onItemProgress } = input;
      if (item.status === "generating") return undefined;

      const allProjectItems = await itemDB.getAll();
      const limit = item.mediaType === "image" ? IMAGE_CONCURRENCY : VIDEO_CONCURRENCY;
      const activeSlots = countWolfActiveGenerationSlots(allProjectItems, item.mediaType);
      if (activeSlots >= limit) {
        const label = item.mediaType === "image" ? t("ảnh") : t("video");
        const message = t("Đang tạo {{label}} tối đa {{max}} luồng cùng lúc. Vui lòng chờ hoàn thành.", {
          label,
          max: limit,
        });
        toast.error(message);
        return undefined;
      }

      await clearWolfItemGeneratedMedia(item, { sceneImageDB, sceneVideoDB, assetDB });

      const generationBatchId = uid();
      const retryingItem: WolfProjectItem = {
        ...item,
        status: "generating",
        jobId: undefined,
        assetId: undefined,
        errorMessage: undefined,
        generationBatchId,
      };
      await itemDB.set(item.id, retryingItem);
      onItemUpdated?.(retryingItem);

      const bindRetryProgress = (items: WolfProjectItem[]) => ({
        onProgress: (pct: number) => {
          onItemProgress?.(
            items.map((entry) => entry.id),
            pct
          );
        },
        onStatusMessage: () => undefined,
      });

      const attachJobId = async (jobId: string) => {
        const withJob: WolfProjectItem = { ...retryingItem, jobId };
        await itemDB.set(item.id, withJob);
        onItemUpdated?.(withJob);
        return withJob;
      };

      try {
        if (item.mediaType === "image") {
          const imageInput = await resolveWolfImageInputFromItem(item, assetDB);
          const body = buildWolfImageGenerationBody(imageInput, 1);
          const progressHandlers = bindRetryProgress([retryingItem]);

          const { data } = await imageJob.run({
            url: "/api/app/generate-image-wolf/",
            body: {
              ...body,
              _metadata: {
                projectId: item.projectId,
                source: "wolf-workspace",
                sceneIds: [item.sceneId],
                generationBatchId,
                retry: true,
              },
            },
            onProgress: progressHandlers.onProgress,
            onJobEnqueued: (jobId) => {
              void attachJobId(jobId);
            },
          });

          const imageData = (data?.images || [])[0] as GeneratedImageData | undefined;
          if (!imageData) {
            const failedItem: WolfProjectItem = {
              ...retryingItem,
              status: "failed",
              errorMessage: t("Không nhận được ảnh từ API"),
            };
            await itemDB.set(item.id, failedItem);
            onItemUpdated?.(failedItem);
            toast.error(t("Không nhận được ảnh từ API"));
            return failedItem;
          }

          const readyItem = await finalizeImageItem(
            retryingItem,
            imageData,
            item.projectId,
            { onItemUpdated, onSceneMediaUpdated }
          );
          toast.success(t("Tạo ảnh thành công"));
          return readyItem;
        }

        const videoInput = await resolveWolfVideoInputFromItem(item, assetDB);
        const body = buildWolfVideoGenerationBody(videoInput);
        const progressHandlers = bindRetryProgress([retryingItem]);

        const { data } = await videoJob.run({
          url: "/api/app/generate-video-wolf/",
          body: {
            ...body,
            _metadata: {
              projectId: item.projectId,
              source: "wolf-workspace",
              sceneId: item.sceneId,
              sceneIds: [item.sceneId],
              generationBatchId,
              retry: true,
            },
          },
          onProgress: progressHandlers.onProgress,
          onStatusMessage: progressHandlers.onStatusMessage,
          onJobEnqueued: (jobId) => {
            void attachJobId(jobId);
          },
        });

        if (!data) {
          const failedItem: WolfProjectItem = {
            ...retryingItem,
            status: "failed",
            errorMessage: t("Không nhận được video từ API"),
          };
          await itemDB.set(item.id, failedItem);
          onItemUpdated?.(failedItem);
          toast.error(t("Không nhận được video từ API"));
          return failedItem;
        }

        const readyItem = await finalizeVideoItem(
          retryingItem,
          data as GeneratedVideoData,
          item.projectId,
          videoInput.aspectRatio,
          { onItemUpdated, onSceneMediaUpdated }
        );
        toast.success(t("Tạo video thành công"));
        return readyItem;
      } catch (err: any) {
        const failedItem: WolfProjectItem = {
          ...retryingItem,
          status: "failed",
          errorMessage: err?.message || t("Lỗi tạo media"),
        };
        await itemDB.set(item.id, failedItem);
        onItemUpdated?.(failedItem);
        toast.error(failedItem.errorMessage!);
        return failedItem;
      }
    },
    [
      IMAGE_CONCURRENCY,
      VIDEO_CONCURRENCY,
      assetDB,
      finalizeImageItem,
      finalizeVideoItem,
      imageJob,
      itemDB,
      sceneImageDB,
      sceneVideoDB,
      t,
      toast,
      videoJob,
    ]
  );

  const cancel = useCallback(
    async (jobId: string) => {
      await imageJob.cancel(jobId);
      await videoJob.cancel(jobId);
    },
    [imageJob, videoJob]
  );

  return {
    generating,
    progress,
    statusMessage,
    error,
    submit,
    retryItem,
    cancel,
  };
}
