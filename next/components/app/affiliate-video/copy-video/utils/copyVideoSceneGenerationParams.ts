/**
 * Shared payloads for copy-video image/video generation (single scene + batch).
 */
import type { CopyVideoAnalysisData, CopyVideoScene, ElementFormImage } from "../../constants";
import { parseThumbnailReferenceImage } from "../../elements/utils/elementSceneGenerationParams";
import { generatedImageToApiBase64Input } from "../../shared/generatedMediaUtils";
import { buildAutoDownloadOptions } from "../../shared/autoDownloadUtils";
import type {
  GenerateImageParams,
  GenerateVideoParams,
  GeneratedImageData,
} from "../hook/useCopyVideoApi";

export type CopyVideoScriptLike = Pick<CopyVideoAnalysisData, "aspectRatio"> | null | undefined;

export { parseThumbnailReferenceImage };

export function buildCopyVideoImageGenerateParams(options: {
  scene: CopyVideoScene;
  scriptData?: CopyVideoScriptLike;
  thumbnailOriginImage?: string | null;
  selectedProductImages?: string[];
  noText?: boolean;
  objectToPersonifyImage?: ElementFormImage;
}): GenerateImageParams {
  const {
    scene,
    scriptData,
    thumbnailOriginImage,
    selectedProductImages,
    noText,
    objectToPersonifyImage,
  } = options;

  return {
    sceneId: scene.id,
    prompt: `${scene.visual_prompt || ""}`,
    noText: noText ?? scene.noText,
    aspectRatio: scriptData?.aspectRatio,
    referenceImage: parseThumbnailReferenceImage(thumbnailOriginImage),
    productImages: selectedProductImages?.length ? selectedProductImages : undefined,
    objectToPersonifyImage,
    productImagePrompt: scene.product_image_prompt || undefined,
    ...buildAutoDownloadOptions(scene),
  };
}

/** Video prompt – matches useCopyVideoSceneMedia.handleGenerateVideo. */
export function buildCopyVideoVideoPrompt(scene: CopyVideoScene, isStitch?: boolean): string {
  const motion = scene.motion_description || "";
  const dialogue = scene.translated_content || scene.original_content || "";
  const audio = scene.audio_description || "";

  if (isStitch) {
    return scene.voiceDisable
      ? motion
        ? `[MOTION]${motion}`
        : ""
      : `${motion ? `[MOTION]${motion}` : ""}, ${audio ? `[AUDIO]${audio}` : ""}, ${
          dialogue ? `[DIALOGUE]${dialogue}` : ""
        }`;
  }
  return scene.voiceDisable
    ? motion
      ? `[MOTION]${motion}`
      : ""
    : `${motion ? `[MOTION]${motion}` : ""}, ${audio ? `[AUDIO]${audio}` : ""}, ${
        dialogue ? `[DIALOGUE]${dialogue}` : ""
      }`;
}

export async function buildCopyVideoVideoGenerateParams(options: {
  scene: CopyVideoScene;
  scriptData?: CopyVideoScriptLike;
  isStitch?: boolean;
  generatedImage?: GeneratedImageData | null;
  nextGeneratedImage?: GeneratedImageData | null;
}): Promise<GenerateVideoParams> {
  const { scene, scriptData, isStitch, generatedImage, nextGeneratedImage } = options;

  let images: GenerateVideoParams["images"];
  if (isStitch) {
    if (!generatedImage || !nextGeneratedImage) {
      throw new Error("Missing start or end image for stitch video");
    }
    images = [
      await generatedImageToApiBase64Input(generatedImage),
      await generatedImageToApiBase64Input(nextGeneratedImage),
    ];
  } else if (generatedImage) {
    images = [await generatedImageToApiBase64Input(generatedImage)];
  }

  return {
    sceneId: isStitch ? scene.id + "::stitch" : scene.id,
    prompt: buildCopyVideoVideoPrompt(scene, isStitch),
    images,
    aspectRatio: scriptData?.aspectRatio,
    noText: scene.noText,
    voiceDisable: scene.voiceDisable,
    generateAudio: scene.voiceDisable ? false : undefined,
    ...buildAutoDownloadOptions(scene, isStitch),
  };
}
