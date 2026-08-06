/**
 * Shared payloads for affiliate (single/trending) image/video generation.
 */
import { Flow2VideoModeEnum, type ElementFormImage, type SceneScript } from "../constants";
import type { GeneratedImageData } from "../copy-video/hook/useCopyVideoApi";
import type { GenerateImageParams, GenerateVideoParams } from "../hook/useAffiliateVideoApi";
import { buildAutoDownloadOptions } from "./autoDownloadUtils";
import { generatedImageToApiBase64Input } from "./generatedMediaUtils";
import { normalizeSceneAudioField } from "./sceneAudioUtils";

/** Chuyển ảnh storyboard crop → shape dùng cho gen video */
export function elementFormImageToGeneratedImage(
  img?: ElementFormImage | null
): GeneratedImageData | null {
  if (!(img?.imageBytes || "").trim()) return null;
  return {
    imageBytes: img!.imageBytes,
    mimeType: img!.mimeType || "image/png",
    fifeUrl: img!.fifeUrl || "",
  };
}

/**
 * Ảnh tham chiếu khi tạo video.
 * Storyboard + requireImageBeforeVideo !== true → ưu tiên ảnh gốc (crop).
 * Ngược lại dùng ảnh đã gen ở tab Ảnh.
 */
export function resolveAffiliateVideoReferenceImage(
  scene: SceneScript,
  generatedImage?: GeneratedImageData | null,
  requireImageBeforeVideo?: boolean
): GeneratedImageData | null {
  if (requireImageBeforeVideo !== true) {
    const origin = elementFormImageToGeneratedImage(scene.storyboardCropImage);
    if (origin) return origin;
  }
  return generatedImage ?? null;
}

/**
 * videoMode:
 * - Ảnh gốc storyboard (không bắt buộc gen ảnh trước) → component (thành phần)
 * - Video nối (start/end) hoặc ảnh gen từ tab Ảnh → frame (khung ảnh)
 */
export function resolveAffiliateVideoMode(options: {
  isStitch?: boolean;
  scene: SceneScript;
  requireImageBeforeVideo?: boolean;
}): Flow2VideoModeEnum {
  const { isStitch, scene, requireImageBeforeVideo } = options;
  if (isStitch) return Flow2VideoModeEnum.FRAME;
  if (
    requireImageBeforeVideo !== true &&
    !!(scene.storyboardCropImage?.imageBytes || "").trim()
  ) {
    return Flow2VideoModeEnum.COMPONENT;
  }
  return Flow2VideoModeEnum.FRAME;
}

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
  const audioText = normalizeSceneAudioField(scene.audio);
  if (isStitch) {
    return scene.voiceDisable
      ? `${scene.motionPrompt ? `[MOTION]${scene.motionPrompt}` : ""}`
      : `${scene.motionPrompt ? `[MOTION]${scene.motionPrompt}` : ""}, ${
          audioText ? `[AUDIO]${audioText}` : ""
        }, ${scene.dialogue ? `[DIALOGUE]${scene.dialogue}` : ""}`;
  }
  return scene.voiceDisable
    ? `${scene.motionPrompt ? `[MOTION]${scene.motionPrompt}` : ""}`
    : `${scene.motionPrompt ? `[MOTION]${scene.motionPrompt}` : ""}, ${
        audioText ? `[AUDIO]${audioText}` : ""
      }, ${scene.dialogue ? `[DIALOGUE]${scene.dialogue}` : ""}`;
}

export function buildAffiliateImageGenerateParams(options: {
  scene: SceneScript;
  scriptData?: AffiliateScriptLike;
  /** Fallback khi scriptData chưa có aspectRatio */
  aspectRatio?: string;
  selectedProductImages?: string[];
  noText?: boolean;
  objectToPersonifyImage?: ElementFormImage;
}): GenerateImageParams {
  const { scene, scriptData, aspectRatio, selectedProductImages, noText, objectToPersonifyImage } =
    options;

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
    productImages: selectedProductImages?.length ? selectedProductImages : undefined,
    objectToPersonifyImage,
    productImagePrompt: scene.product_image_prompt || undefined,
    noText: noText ?? scene.noText,
    ...buildAutoDownloadOptions(scene),
  };
}

export async function buildAffiliateVideoGenerateParams(options: {
  scene: SceneScript;
  scriptData?: AffiliateScriptLike;
  /** Fallback khi scriptData chưa có aspectRatio */
  aspectRatio?: string;
  isStitch?: boolean;
  generatedImage?: GeneratedImageData | null;
  nextGeneratedImage?: GeneratedImageData | null;
  /**
   * Storyboard: false → dùng ảnh gốc + videoMode component (thành phần).
   * true / undefined ngoài storyboard → frame (khung ảnh).
   */
  requireImageBeforeVideo?: boolean;
}): Promise<GenerateVideoParams> {
  const {
    scene,
    scriptData,
    aspectRatio,
    isStitch,
    generatedImage,
    nextGeneratedImage,
    requireImageBeforeVideo,
  } = options;

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
    prompt: buildAffiliateVideoPrompt(scene, scriptData, isStitch),
    images,
    aspectRatio: scriptData?.aspectRatio ?? aspectRatio,
    videoMode: resolveAffiliateVideoMode({ isStitch, scene, requireImageBeforeVideo }),
    noText: scene.noText,
    voiceDisable: scene.voiceDisable,
    generateAudio: scene.voiceDisable ? false : undefined,
    ...buildAutoDownloadOptions(scene, isStitch),
  };
}
