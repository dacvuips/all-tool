/**
 * Shared payloads for element image/video generation (single scene + batch).
 * Batch handlers must call these so each item uses the same API params as the per-scene UI.
 */
import { CopyVideoScene, ElementAnalysisData, ElementFormConfig, ElementFormImage } from "../../constants";
import { ServiceImageEnum } from "../constants";
import type {
  GeneratedImageData,
  GenerateImageParams,
  GenerateVideoParams,
} from "../hook/useElementApi";
import {
  ELEMENT_COMPONENT_IMAGE_SLOT_COUNT,
  getSceneImageSlotCount,
  resolveElementReferenceImagesForApi,
} from "./elementFormImageUtils";
import { matchElementImagesForScene } from "./matchElementImagesInPrompt";
import {
  pickSceneSavedImageSlots,
  resolveActionImageType,
} from "./elementActionImageUtils";
import { generatedImageToApiBase64Input } from "../../shared/generatedMediaUtils";
import { buildAutoDownloadOptions } from "../../shared/autoDownloadUtils";

export type ElementScriptLike =
  | Pick<ElementAnalysisData, "aspectRatio" | "artStyle" | "artStyleId" | "serviceImageType">
  | null
  | undefined;

/** Ưu tiên aspectRatio trong script; fallback sidebar config khi script chưa có hoặc đổi sau submit. */
export function resolveElementAspectRatio(
  scriptData?: ElementScriptLike,
  fallbackAspectRatio?: string
): string | undefined {
  return scriptData?.aspectRatio ?? fallbackAspectRatio;
}

/** Ưu tiên sidebar config (live); fallback scriptData khi sidebar chưa có giá trị. */
export function resolveElementServiceImageType(
  scriptData?: ElementScriptLike,
  fallbackServiceImageType?: ServiceImageEnum
): ServiceImageEnum | undefined {
  return fallbackServiceImageType ?? scriptData?.serviceImageType;
}

/** Parse scene thumbnail data URL → reference image for image API. */
export function parseThumbnailReferenceImage(
  thumbnailOriginImage?: string | null
): { imageBytes: string; mimeType: string } | undefined {
  if (!thumbnailOriginImage) return undefined;
  const match = thumbnailOriginImage.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return undefined;
  return { mimeType: match[1], imageBytes: match[2] };
}

function countFilledImageSlots(arr?: (ElementFormImage | undefined)[]) {
  return arr?.filter((s) => s && (s.imageBytes || s.fifeUrl)).length ?? 0;
}

/** Pick element image slots (same logic as useElementSceneMedia). */
export function pickElementImageSlotsForScene(
  scene: CopyVideoScene,
  selectedElementImageSlots?: (ElementFormImage | undefined)[],
  elementFormConfig?: ElementFormConfig
): (ElementFormImage | undefined)[] | undefined {
  const actionImageType = resolveActionImageType(elementFormConfig);
  const sceneSlots = pickSceneSavedImageSlots(scene, actionImageType);
  if (!selectedElementImageSlots?.length && !sceneSlots?.length) {
    if (!elementFormConfig) return sceneSlots;
    return matchElementImagesForScene(
      scene.sceneNumber ?? 1,
      scene.visual_prompt || "",
      elementFormConfig
    );
  }
  const picked =
    countFilledImageSlots(selectedElementImageSlots) >= countFilledImageSlots(sceneSlots)
      ? selectedElementImageSlots
      : sceneSlots ?? selectedElementImageSlots;
  if (countFilledImageSlots(picked) > 0 || !elementFormConfig) return picked;
  return matchElementImagesForScene(
    scene.sceneNumber ?? 1,
    scene.visual_prompt || "",
    elementFormConfig
  );
}

/** Video prompt – identical to handleGenerateVideo in useElementSceneMedia. */
export function buildElementVideoPrompt(scene: CopyVideoScene, isStitch?: boolean): string {
  const motionPrompt = (scene.motion_description || "").trim();
  const visualPrompt = scene.visual_prompt?.trim() || "";
  const dialogue = scene.translated_content || scene.original_content || "";
  const audio = scene.audio_description || "";

  if (isStitch) {
    return scene.voiceDisable
      ? `${visualPrompt ? `[VISUAL PROMPT]${visualPrompt}` : ""} ${
          motionPrompt ? `[MOTION]${motionPrompt}` : ""
        }`
      : `${visualPrompt ? `[VISUAL PROMPT]${visualPrompt}` : ""} ${
          motionPrompt ? `[MOTION]${motionPrompt}` : ""
        }, ${audio ? `[AUDIO]${audio}` : ""}, ${dialogue ? `[DIALOGUE]${dialogue}` : ""}`;
  }

  return scene.voiceDisable
    ? `${visualPrompt ? `[VISUAL PROMPT]${visualPrompt}` : ""} ${
        motionPrompt ? `[MOTION]${motionPrompt}` : ""
      }`
    : `${visualPrompt ? `[VISUAL PROMPT]${visualPrompt}` : ""} ${
        motionPrompt ? `[MOTION]${motionPrompt}` : ""
      }, ${audio ? `[AUDIO]${audio}` : ""}, ${dialogue ? `[DIALOGUE]${dialogue}` : ""}`;
}

/** Image generation params – identical to handleGenerateImage in useElementSceneMedia. */
export async function buildElementImageGenerateParams(options: {
  scene: CopyVideoScene;
  scriptData?: ElementScriptLike;
  /** Fallback khi scriptData chưa có aspectRatio */
  aspectRatio?: string;
  /** Fallback khi scriptData chưa có serviceImageType */
  serviceImageType?: ServiceImageEnum;
  thumbnailOriginImage?: string | null;
  selectedProductImages?: string[];
  /** 3 ô ảnh tham chiếu trên scene row */
  selectedElementImageSlots?: (ElementFormImage | undefined)[];
  elementFormConfig?: ElementFormConfig;
  /** Tab Thành phần: luôn 3 slot ảnh tham chiếu */
  componentTab?: boolean;
  noText?: boolean;
}): Promise<GenerateImageParams> {
  const {
    scene,
    scriptData,
    aspectRatio,
    serviceImageType,
    thumbnailOriginImage,
    selectedProductImages,
    selectedElementImageSlots,
    elementFormConfig,
    componentTab,
    noText,
  } = options;
  const resolvedServiceImageType = resolveElementServiceImageType(scriptData, serviceImageType);
  const slotCount = componentTab
    ? ELEMENT_COMPONENT_IMAGE_SLOT_COUNT
    : getSceneImageSlotCount(resolvedServiceImageType);
  const slotsForImage = pickElementImageSlotsForScene(
    scene,
    selectedElementImageSlots,
    elementFormConfig
  );
  const additionalImages = await resolveElementReferenceImagesForApi({
    urls: selectedProductImages,
    slots: slotsForImage,
    slotCount,
  });

  return {
    sceneId: scene.id,
    prompt: `${scene.visual_prompt || ""}`,
    noText: noText ?? scene.noText,
    aspectRatio: resolveElementAspectRatio(scriptData, aspectRatio),
    artStyle: scriptData?.artStyle,
    artStyleId: scriptData?.artStyleId,
    referenceImage: parseThumbnailReferenceImage(thumbnailOriginImage),
    additionalImages: additionalImages.length > 0 ? additionalImages : undefined,
    productImages: selectedProductImages?.length ? selectedProductImages : undefined,
    productImagePrompt: scene.product_image_prompt || undefined,
    serviceImageType: resolvedServiceImageType,
    ...buildAutoDownloadOptions(scene),
  };
}

/** Video generation params – identical to handleGenerateVideo in useElementSceneMedia. */
export async function buildElementVideoGenerateParams(options: {
  scene: CopyVideoScene;
  scriptData?: ElementScriptLike;
  /** Fallback khi scriptData chưa có aspectRatio */
  aspectRatio?: string;
  /** Fallback khi scriptData chưa có serviceImageType */
  serviceImageType?: ServiceImageEnum;
  isStitch?: boolean;
  generatedImage?: GeneratedImageData | null;
  nextGeneratedImage?: GeneratedImageData | null;
  selectedProductImages?: string[];
  selectedElementImageSlots?: (ElementFormImage | undefined)[];
  /** Fallback slot auto-match khi scene chưa lưu elementImageSlots */
  elementFormConfig?: ElementFormConfig;
  /** Tab Thành phần: luôn component mode (start_add_end) + 3 slot ảnh tham chiếu */
  componentTab?: boolean;
}): Promise<GenerateVideoParams> {
  const {
    scene,
    scriptData,
    aspectRatio,
    serviceImageType,
    isStitch,
    generatedImage,
    nextGeneratedImage,
    selectedProductImages,
    selectedElementImageSlots,
    elementFormConfig,
    componentTab,
  } = options;

  const resolvedServiceImageType = componentTab
    ? ServiceImageEnum.startAddEnd
    : resolveElementServiceImageType(scriptData, serviceImageType);
  let images: GenerateVideoParams["images"];

  if (isStitch) {
    if (!generatedImage || !nextGeneratedImage) {
      throw new Error("Missing start or end image for stitch video");
    }
    images = [
      await generatedImageToApiBase64Input(generatedImage),
      await generatedImageToApiBase64Input(nextGeneratedImage),
    ];
  } else {
    const slotCount = componentTab
      ? ELEMENT_COMPONENT_IMAGE_SLOT_COUNT
      : getSceneImageSlotCount(resolvedServiceImageType);
    const slotsForVideo = pickElementImageSlotsForScene(
      scene,
      selectedElementImageSlots,
      elementFormConfig
    );
    images = await resolveElementReferenceImagesForApi({
      urls: selectedProductImages,
      slots: slotsForVideo,
      slotCount,
    });
    if (!images?.length) {
      images = undefined;
    }
  }

  return {
    sceneId: isStitch ? scene.id + "::stitch" : scene.id,
    prompt: buildElementVideoPrompt(scene, isStitch),
    images,
    aspectRatio: resolveElementAspectRatio(scriptData, aspectRatio),
    serviceImageType: resolvedServiceImageType,
    artStyleId: scriptData?.artStyleId,
    artStyle: scriptData?.artStyle,
    noText: scene.noText,
    voiceDisable: scene.voiceDisable,
    generateAudio: scene.voiceDisable ? false : undefined,
    ...buildAutoDownloadOptions(scene, isStitch),
  };
}
