/**
 * Shared payloads for copy-video image/video generation (single scene + batch).
 */
import type { CopyVideoScene } from "../../constants";
import type { CopyVideoAnalysisData } from "../../constants";
import type {
  GenerateImageParams,
  GenerateVideoParams,
  GeneratedImageData,
} from "../hook/useCopyVideoApi";
import type { ElementFormImage } from "../../constants";
import { parseThumbnailReferenceImage } from "../../elements/utils/elementSceneGenerationParams";
import { productImageUrlsToApiImages } from "../../elements/utils/elementFormImageUtils";

export type CopyVideoScriptLike =
  | Pick<CopyVideoAnalysisData, "aspectRatio">
  | null
  | undefined;

export { parseThumbnailReferenceImage };

export async function buildCopyVideoImageGenerateParams(options: {
  scene: CopyVideoScene;
  scriptData?: CopyVideoScriptLike;
  thumbnailOriginImage?: string | null;
  selectedProductImages?: string[];
  noText?: boolean;
  objectToPersonifyImage?: ElementFormImage;
}): Promise<GenerateImageParams> {
  const {
    scene,
    scriptData,
    thumbnailOriginImage,
    selectedProductImages,
    noText,
    objectToPersonifyImage,
  } = options;
  const additionalImages = await productImageUrlsToApiImages(selectedProductImages);

  return {
    sceneId: scene.id,
    prompt: `${scene.visual_prompt || ""}`,
    noText: noText ?? scene.noText,
    aspectRatio: scriptData?.aspectRatio,
    referenceImage: parseThumbnailReferenceImage(thumbnailOriginImage),
    additionalImages: additionalImages.length > 0 ? additionalImages : undefined,
    productImages: selectedProductImages?.length ? selectedProductImages : undefined,
    objectToPersonifyImage,
    productImagePrompt: scene.product_image_prompt || undefined,
  };
}

/** Video prompt – matches useCopyVideoSceneMedia.handleGenerateVideo. */
export function buildCopyVideoVideoPrompt(scene: CopyVideoScene, isStitch?: boolean): string {
  const motion = scene.motion_description || "";
  const dialogue = scene.translated_content || scene.original_content || "";
  const audio = scene.audio_description || "";

  if (isStitch) {
    return scene.voiceDisable
      ? `[MOTION]${motion}`
      : `[MOTION]${motion}, [AUDIO]${audio}, [DIALOGUE]${dialogue}`;
  }
  return scene.voiceDisable
    ? `[MOTION]${motion}`
    : `[MOTION]${motion}, [AUDIO]${audio}, [DIALOGUE]${dialogue}`;
}

export function buildCopyVideoVideoGenerateParams(options: {
  scene: CopyVideoScene;
  scriptData?: CopyVideoScriptLike;
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
    prompt: buildCopyVideoVideoPrompt(scene, isStitch),
    images,
    aspectRatio: scriptData?.aspectRatio,
  };
}
