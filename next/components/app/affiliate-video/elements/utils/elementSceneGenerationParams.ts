/**
 * Shared payloads for element image/video generation (single scene + batch).
 * Batch handlers must call these so each item uses the same API params as the per-scene UI.
 */
import {
  CopyVideoScene,
  ElementAnalysisData,
  ElementFormImage,
} from "../../constants";
import type { GeneratedImageData } from "../hook/useElementApi";
import type { GenerateImageParams, GenerateVideoParams } from "../hook/useElementApi";
import { productImageUrlsToApiImages, resolveElementReferenceImagesForApi } from "./elementFormImageUtils";

export type ElementScriptLike =
  | Pick<ElementAnalysisData, "aspectRatio" | "artStyle" | "artStyleId" | "serviceImageType">
  | null
  | undefined;

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
  selectedElementImageSlots?: (ElementFormImage | undefined)[]
): (ElementFormImage | undefined)[] | undefined {
  const sceneSlots = scene.elementImageSlots;
  if (!selectedElementImageSlots?.length && !sceneSlots?.length) return sceneSlots;
  return countFilledImageSlots(selectedElementImageSlots) >= countFilledImageSlots(sceneSlots)
    ? selectedElementImageSlots
    : sceneSlots ?? selectedElementImageSlots;
}

/** Video prompt – identical to handleGenerateVideo in useElementSceneMedia. */
export function buildElementVideoPrompt(scene: CopyVideoScene, isStitch?: boolean): string {
  const motionPrompt = (scene.motion_description || "").trim();
  const visualPrompt = scene.visual_prompt?.trim() || "";
  const dialogue = scene.translated_content || scene.original_content || "";
  const audio = scene.audio_description || "";

  if (isStitch) {
    return scene.voiceDisable
      ? `[VISUAL PROMPT]${visualPrompt} [MOTION]${motionPrompt}`
      : `[VISUAL PROMPT]${visualPrompt} [MOTION]${motionPrompt}, [AUDIO]${audio}, [DIALOGUE]${dialogue}`;
  }

  return scene.voiceDisable
    ? `[VISUAL PROMPT]${visualPrompt} [MOTION]${motionPrompt}`
    : `[VISUAL PROMPT]${visualPrompt} [MOTION]${motionPrompt}, [AUDIO]${audio}, [DIALOGUE]${dialogue}`;
}

/** Image generation params – identical to handleGenerateImage in useElementSceneMedia. */
export async function buildElementImageGenerateParams(options: {
  scene: CopyVideoScene;
  scriptData?: ElementScriptLike;
  thumbnailOriginImage?: string | null;
  selectedProductImages?: string[];
  noText?: boolean;
}): Promise<GenerateImageParams> {
  const { scene, scriptData, thumbnailOriginImage, selectedProductImages, noText } = options;
  const additionalImages = await productImageUrlsToApiImages(selectedProductImages);

  return {
    sceneId: scene.id,
    prompt: `${scene.visual_prompt || ""}`,
    noText: noText ?? scene.noText,
    aspectRatio: scriptData?.aspectRatio,
    artStyle: scriptData?.artStyle,
    artStyleId: scriptData?.artStyleId,
    referenceImage: parseThumbnailReferenceImage(thumbnailOriginImage),
    additionalImages: additionalImages.length > 0 ? additionalImages : undefined,
    productImages: selectedProductImages?.length ? selectedProductImages : undefined,
    productImagePrompt: scene.product_image_prompt || undefined,
    serviceImageType: scriptData?.serviceImageType,
  };
}

/** Video generation params – identical to handleGenerateVideo in useElementSceneMedia. */
export async function buildElementVideoGenerateParams(options: {
  scene: CopyVideoScene;
  scriptData?: ElementScriptLike;
  isStitch?: boolean;
  generatedImage?: GeneratedImageData | null;
  nextGeneratedImage?: GeneratedImageData | null;
  selectedProductImages?: string[];
  selectedElementImageSlots?: (ElementFormImage | undefined)[];
}): Promise<GenerateVideoParams> {
  const {
    scene,
    scriptData,
    isStitch,
    generatedImage,
    nextGeneratedImage,
    selectedProductImages,
    selectedElementImageSlots,
  } = options;

  let images: GenerateVideoParams["images"];

  if (isStitch) {
    if (!generatedImage || !nextGeneratedImage) {
      throw new Error("Missing start or end image for stitch video");
    }
    images = [
      { imageBytes: generatedImage.imageBytes, mimeType: generatedImage.mimeType },
      { imageBytes: nextGeneratedImage.imageBytes, mimeType: nextGeneratedImage.mimeType },
    ];
  } else {
    const slotsForVideo = pickElementImageSlotsForScene(scene, selectedElementImageSlots);
    images = await resolveElementReferenceImagesForApi({
      urls: selectedProductImages,
      slots: slotsForVideo,
    });
    if (!images?.length) {
      images = undefined;
    }
  }

  return {
    sceneId: isStitch ? scene.id + "::stitch" : scene.id,
    prompt: buildElementVideoPrompt(scene, isStitch),
    images,
    aspectRatio: scriptData?.aspectRatio,
    serviceImageType: scriptData?.serviceImageType,
    artStyleId: scriptData?.artStyleId,
    artStyle: scriptData?.artStyle,
  };
}
