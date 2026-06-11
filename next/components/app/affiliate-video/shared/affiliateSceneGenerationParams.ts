/**
 * Shared payloads for affiliate (single/trending) image/video generation.
 */
import type { ElementFormImage, SceneScript } from "../constants";
import type { GeneratedImageData } from "../copy-video/hook/useCopyVideoApi";
import { productImageUrlsToApiImages } from "../elements/utils/elementFormImageUtils";
import type { GenerateImageParams, GenerateVideoParams } from "../hook/useAffiliateVideoApi";

export type AffiliateScriptLike =
  | {
      aspectRatio?: string;
      voiceGender?: string;
      voiceStyle?: string;
      voiceTone?: string;
    }
  | null
  | undefined;

function buildAffiliateAudioDesc(scriptData?: AffiliateScriptLike): string {
  return [scriptData?.voiceGender, scriptData?.voiceStyle, scriptData?.voiceTone]
    .filter(Boolean)
    .join(", ");
}

/** Video prompt – matches useSceneMedia.handleGenerateVideo. */
export function buildAffiliateVideoPrompt(
  scene: SceneScript,
  scriptData?: AffiliateScriptLike,
  isStitch?: boolean
): string {
  const audioDesc = buildAffiliateAudioDesc(scriptData);
  if (isStitch) {
    return scene.voiceDisable
      ? `${scene.motionPrompt ? `[MOTION]${scene.motionPrompt}` : ""}`
      : `${scene.motionPrompt ? `[MOTION]${scene.motionPrompt}` : ""}, ${
          scene.audio ? `[AUDIO]${scene.audio}` : ""
        }, ${scene.dialogue ? `[DIALOGUE]${scene.dialogue}` : ""}`;
  }
  return scene.voiceDisable
    ? `${scene.motionPrompt ? `[MOTION]${scene.motionPrompt}` : ""}`
    : `${scene.motionPrompt ? `[MOTION]${scene.motionPrompt}` : ""}, ${
        scene.audio ? `[AUDIO]${scene.audio}` : ""
      }, ${scene.dialogue ? `[DIALOGUE]${scene.dialogue}` : ""}`;
}

export async function buildAffiliateImageGenerateParams(options: {
  scene: SceneScript;
  scriptData?: AffiliateScriptLike;
  /** Fallback khi scriptData chưa có aspectRatio */
  aspectRatio?: string;
  selectedProductImages?: string[];
  noText?: boolean;
  objectToPersonifyImage?: ElementFormImage;
}): Promise<GenerateImageParams> {
  const { scene, scriptData, aspectRatio, selectedProductImages, noText, objectToPersonifyImage } =
    options;
  const additionalImages = await productImageUrlsToApiImages(selectedProductImages);

  const storyboardReference = scene.storyboardCropImage
    ? {
        imageBytes: scene.storyboardCropImage.imageBytes,
        mimeType: scene.storyboardCropImage.mimeType,
      }
    : undefined;

  return {
    sceneId: scene.id,
    prompt: scene.imageGenPrompt || "",
    aspectRatio: scriptData?.aspectRatio ?? aspectRatio,
    referenceImage: storyboardReference,
    additionalImages: additionalImages.length > 0 ? additionalImages : undefined,
    productImages: selectedProductImages?.length ? selectedProductImages : undefined,
    objectToPersonifyImage,
    productImagePrompt: scene.product_image_prompt || undefined,
    noText: noText ?? scene.noText,
  };
}

export function buildAffiliateVideoGenerateParams(options: {
  scene: SceneScript;
  scriptData?: AffiliateScriptLike;
  /** Fallback khi scriptData chưa có aspectRatio */
  aspectRatio?: string;
  isStitch?: boolean;
  generatedImage?: GeneratedImageData | null;
  nextGeneratedImage?: GeneratedImageData | null;
}): GenerateVideoParams {
  const { scene, scriptData, aspectRatio, isStitch, generatedImage, nextGeneratedImage } = options;

  let images: GenerateVideoParams["images"];
  if (isStitch) {
    if (!generatedImage || !nextGeneratedImage) {
      throw new Error("Missing start or end image for stitch video");
    }
    images = [
      { imageBytes: generatedImage.imageBytes, mimeType: generatedImage.mimeType },
      { imageBytes: nextGeneratedImage.imageBytes, mimeType: nextGeneratedImage.mimeType },
    ];
  } else if (generatedImage) {
    images = [{ imageBytes: generatedImage.imageBytes, mimeType: generatedImage.mimeType }];
  }

  return {
    sceneId: isStitch ? scene.id + "::stitch" : scene.id,
    prompt: buildAffiliateVideoPrompt(scene, scriptData, isStitch),
    images,
    aspectRatio: scriptData?.aspectRatio ?? aspectRatio,
    noText: scene.noText,
    voiceDisable: scene.voiceDisable,
    generateAudio: scene.voiceDisable ? false : undefined,
  };
}
