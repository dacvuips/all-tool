/**
 * Shared payloads for affiliate (single/trending) image/video generation.
 */
import type { ElementFormImage } from "../constants";
import type { SceneScript } from "../constants";
import type {
  GenerateImageParams,
  GenerateVideoParams,
} from "../hook/useAffiliateVideoApi";
import type { GeneratedImageData } from "../copy-video/hook/useCopyVideoApi";
import { productImageUrlsToApiImages } from "../elements/utils/elementFormImageUtils";

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
      ? `[MOTION]${scene.motionPrompt}`
      : `[MOTION]${scene.motionPrompt}, [AUDIO]${scene.audio}, [DIALOGUE]${scene.dialogue}`;
  }
  return scene.voiceDisable
    ? `[MOTION]${scene.motionPrompt}`
    : `[MOTION]${scene.motionPrompt}, [AUDIO]${audioDesc || scene.audio}, [DIALOGUE]${scene.dialogue}`;
}

export async function buildAffiliateImageGenerateParams(options: {
  scene: SceneScript;
  scriptData?: AffiliateScriptLike;
  selectedProductImages?: string[];
  noText?: boolean;
  objectToPersonifyImage?: ElementFormImage;
}): Promise<GenerateImageParams> {
  const { scene, scriptData, selectedProductImages, noText, objectToPersonifyImage } = options;
  const additionalImages = await productImageUrlsToApiImages(selectedProductImages);

  return {
    sceneId: scene.id,
    prompt: scene.imageGenPrompt || "",
    aspectRatio: scriptData?.aspectRatio,
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
  isStitch?: boolean;
  generatedImage?: GeneratedImageData | null;
  nextGeneratedImage?: GeneratedImageData | null;
}): GenerateVideoParams {
  const { scene, scriptData, isStitch, generatedImage, nextGeneratedImage } = options;

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
    aspectRatio: scriptData?.aspectRatio,
    noText: scene.noText,
    voiceDisable: scene.voiceDisable,
    generateAudio: scene.voiceDisable ? false : undefined,
  };
}
