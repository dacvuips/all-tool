/**
 * Shared payloads for affiliate (single/trending) image/video generation.
 */
import { Flow2VideoModeEnum, type ElementFormImage, type SceneScript } from "../constants";
import type { GeneratedImageData } from "../copy-video/hook/useCopyVideoApi";
import type { GenerateImageParams, GenerateVideoParams } from "../hook/useAffiliateVideoApi";
import { buildAutoDownloadOptions } from "./autoDownloadUtils";
import { generatedImageToApiBase64Input } from "./generatedMediaUtils";
import { normalizeSceneAudioField } from "./sceneAudioUtils";

const NO_DRAWING_HAND_IMAGE_NOTE =
  "IMPORTANT: still image only — do NOT show any human hand, fingers, arm, pen, marker, pencil, or drawing utensil.";

function stripDrawingHandPhrases(text: string): string {
  if (!text?.trim()) return text || "";
  return text
    .replace(/\b(realistic|stylized|cartoon|2d|human)?\s*(right|left)?\s*hand[s]?\b[^.\[;\n]{0,120}/gi, " ")
    .replace(/\b(holding|gripping|grasping)\s+(a\s+)?(grey|gray|white|black)?\s*(dry-?erase\s+)?(marker|pen|pencil|brush)\b[^.\[;\n]{0,80}/gi, " ")
    .replace(/\b(as if|currently|progressively)\s+(drawing|writing|sketching)[^.\[;\n]{0,80}/gi, " ")
    .replace(/\bdrawing[- ]in[- ]progress\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function shouldForceNoDrawingHand(options: {
  prompt?: string;
  artStyle?: string;
}): boolean {
  const blob = `${options.prompt || ""} ${options.artStyle || ""}`.toLowerCase();
  return (
    blob.includes("whiteboard") ||
    blob.includes("2d flat") ||
    blob.includes("stil image") ||
    blob.includes("still image") ||
    blob.includes("no human hand") ||
    blob.includes("style lock") ||
    blob.includes("explainer")
  );
}

function applyNoDrawingHandToImagePrompt(prompt: string, artStyle?: string): string {
  if (!shouldForceNoDrawingHand({ prompt, artStyle })) return prompt || "";
  const cleaned = stripDrawingHandPhrases(prompt || "");
  if (cleaned.toLowerCase().includes("do not show any human hand")) return cleaned;
  return `${cleaned} ${NO_DRAWING_HAND_IMAGE_NOTE}`.trim();
}

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
      artStyle?: string;
      artStyleId?: string;
    }
  | null
  | undefined;

export type AffiliateArtStyleOptions = {
  artStyle?: string;
  artStyleId?: string;
};

/** Ưu tiên art style đang chọn trên form (live), fallback scriptData. */
export function resolveAffiliateArtStyle(
  formConfig?: AffiliateArtStyleOptions | null,
  scriptData?: AffiliateScriptLike
): AffiliateArtStyleOptions {
  const artStyle =
    formConfig?.artStyle !== undefined ? formConfig.artStyle : scriptData?.artStyle;
  const artStyleId =
    formConfig?.artStyleId !== undefined ? formConfig.artStyleId : scriptData?.artStyleId;
  return {
    artStyle: artStyle || undefined,
    artStyleId: artStyleId || undefined,
  };
}

/** Video prompt – matches useSceneMedia.handleGenerateVideo. */
export function buildAffiliateVideoPrompt(
  scene: SceneScript,
  scriptData?: AffiliateScriptLike,
  isStitch?: boolean
): string {
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
  /** Art style live từ form sidebar — ưu tiên hơn scriptData */
  artStyle?: string;
  artStyleId?: string;
}): GenerateImageParams {
  const {
    scene,
    scriptData,
    aspectRatio,
    selectedProductImages,
    noText,
    objectToPersonifyImage,
    artStyle,
    artStyleId,
  } = options;

  const storyboardReference = scene.storyboardCropImage
    ? {
        imageBytes: scene.storyboardCropImage.imageBytes,
        mimeType: scene.storyboardCropImage.mimeType,
      }
    : undefined;

  const resolvedArtStyle = resolveAffiliateArtStyle({ artStyle, artStyleId }, scriptData);
  const rawPrompt = scene.imageGenPrompt || "";
  const safeArtStyle = shouldForceNoDrawingHand({
    prompt: rawPrompt,
    artStyle: resolvedArtStyle.artStyle,
  })
    ? stripDrawingHandPhrases(resolvedArtStyle.artStyle || "")
    : resolvedArtStyle.artStyle;

  return {
    sceneId: scene.id,
    prompt: applyNoDrawingHandToImagePrompt(rawPrompt, resolvedArtStyle.artStyle),
    aspectRatio: scriptData?.aspectRatio ?? aspectRatio,
    referenceImage: storyboardReference,
    productImages: selectedProductImages?.length ? selectedProductImages : undefined,
    objectToPersonifyImage,
    productImagePrompt: scene.product_image_prompt || undefined,
    noText: noText ?? scene.noText,
    artStyle: safeArtStyle || undefined,
    artStyleId: resolvedArtStyle.artStyleId,
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
  /** Art style live từ form sidebar — ưu tiên hơn scriptData */
  artStyle?: string;
  artStyleId?: string;
}): Promise<GenerateVideoParams> {
  const {
    scene,
    scriptData,
    aspectRatio,
    isStitch,
    generatedImage,
    nextGeneratedImage,
    requireImageBeforeVideo,
    artStyle,
    artStyleId,
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

  const resolvedArtStyle = resolveAffiliateArtStyle({ artStyle, artStyleId }, scriptData);

  return {
    sceneId: isStitch ? scene.id + "::stitch" : scene.id,
    prompt: buildAffiliateVideoPrompt(scene, scriptData, isStitch),
    images,
    aspectRatio: scriptData?.aspectRatio ?? aspectRatio,
    videoMode: resolveAffiliateVideoMode({ isStitch, scene, requireImageBeforeVideo }),
    noText: scene.noText,
    voiceDisable: scene.voiceDisable,
    generateAudio: scene.voiceDisable ? false : undefined,
    artStyle: resolvedArtStyle.artStyle,
    artStyleId: resolvedArtStyle.artStyleId,
    ...buildAutoDownloadOptions(scene, isStitch),
  };
}
