/**
 * Shared payloads for affiliate (single/trending) image/video generation.
 */
import { Flow2VideoModeEnum, type ElementFormImage, type SceneScript } from "../constants";
import type { GeneratedImageData } from "../copy-video/hook/useCopyVideoApi";
import type { GenerateImageParams, GenerateVideoParams } from "../hook/useAffiliateVideoApi";
import {
  DRAWING_HAND_REFERENCE_PROMPT,
  ensureMotionStartsFromBlankPaper,
} from "../audio-image-to-video/default-art-style";
import { buildAutoDownloadOptions } from "./autoDownloadUtils";
import { generatedImageToApiBase64Input } from "./generatedMediaUtils";
import { resolveComponentVideoVoiceParam } from "./scene-component-video-voice-select";
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
  isStitch?: boolean,
  /**
   * Audio/Image to Video (component): chỉ [MOTION] + [DIALOGUE],
   * không gắn rule nền / visualPrompt / AUDIO.
   */
  useComponentVideo?: boolean,
  /** Có ảnh draw-audio.jpg → gắn rule dùng bàn tay tham chiếu */
  useDrawingHandReference?: boolean
): string {
  const audioText = normalizeSceneAudioField(scene.audio);
  let motion = (scene.motionPrompt || "").trim();
  if (useComponentVideo) {
    motion = ensureMotionStartsFromBlankPaper(motion);
    if (useDrawingHandReference) {
      const note = DRAWING_HAND_REFERENCE_PROMPT;
      if (!motion.toLowerCase().includes("hand-holding-pen reference")) {
        motion = motion ? `${motion} ${note}` : note;
      }
    }
    const motionPart = motion ? `[MOTION]${motion}` : "";
    if (scene.voiceDisable) return motionPart;
    const dialoguePart = scene.dialogue ? `[DIALOGUE]${scene.dialogue}` : "";
    return [motionPart, dialoguePart].filter(Boolean).join(", ");
  }
  const motionPart = motion ? `[MOTION]${motion}` : "";
  if (isStitch) {
    return scene.voiceDisable
      ? `${motionPart}`
      : `${motionPart}, ${audioText ? `[AUDIO]${audioText}` : ""}, ${
          scene.dialogue ? `[DIALOGUE]${scene.dialogue}` : ""
        }`;
  }
  return scene.voiceDisable
    ? `${motionPart}`
    : `${motionPart}, ${audioText ? `[AUDIO]${audioText}` : ""}, ${
        scene.dialogue ? `[DIALOGUE]${scene.dialogue}` : ""
      }`;
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
  /** Audio/Image to Video: ảnh nền làm reference khi gen ảnh */
  backgroundImage?: ElementFormImage | null;
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
    backgroundImage,
  } = options;

  const storyboardReference = scene.storyboardCropImage
    ? {
        imageBytes: scene.storyboardCropImage.imageBytes,
        mimeType: scene.storyboardCropImage.mimeType,
      }
    : undefined;

  const backgroundReference =
    !storyboardReference && backgroundImage?.imageBytes
      ? {
          imageBytes: backgroundImage.imageBytes,
          mimeType: backgroundImage.mimeType || "image/jpeg",
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

  // Audio-image (có ảnh nền): IMAGE PROMPT chỉ gửi visual — không gắn rule nền / no-hand / no-text.
  // Các tab khác vẫn áp no-hand note khi cần.
  const imagePrompt = backgroundReference
    ? rawPrompt.trim()
    : applyNoDrawingHandToImagePrompt(rawPrompt, resolvedArtStyle.artStyle);

  return {
    sceneId: scene.id,
    prompt: imagePrompt,
    aspectRatio: scriptData?.aspectRatio ?? aspectRatio,
    referenceImage: storyboardReference || backgroundReference,
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
  /**
   * Audio/Image to Video: mode `component` (thành phần).
   * generatedImage = ảnh đầu (nền), nextGeneratedImage = ảnh cuối (gen tab Ảnh) — cả hai bắt buộc.
   */
  useComponentVideo?: boolean;
  generatedImage?: GeneratedImageData | null;
  nextGeneratedImage?: GeneratedImageData | null;
  /**
   * Ảnh bàn tay (draw-audio.jpg) — chỉ khi bật "Bàn tay đang vẽ".
   * Gửi thêm làm ảnh tham chiếu thành phần thứ 3 + gắn prompt khớp bàn tay.
   */
  drawingHandImage?: GeneratedImageData | null;
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
    useComponentVideo,
    generatedImage,
    nextGeneratedImage,
    drawingHandImage,
    requireImageBeforeVideo,
    artStyle,
    artStyleId,
  } = options;

  const useDrawingHandReference =
    useComponentVideo === true && !!(drawingHandImage && hasDrawingHandBinary(drawingHandImage));

  let images: GenerateVideoParams["images"];
  if (useComponentVideo) {
    if (!generatedImage) {
      throw new Error("Thiếu ảnh đầu (ảnh nền) cho video thành phần");
    }
    if (!nextGeneratedImage) {
      throw new Error("Thiếu ảnh cuối (ảnh gen tab Ảnh) cho video thành phần");
    }
    images = [
      await generatedImageToApiBase64Input(generatedImage),
      await generatedImageToApiBase64Input(nextGeneratedImage),
    ];
    if (useDrawingHandReference && drawingHandImage) {
      images.push(await generatedImageToApiBase64Input(drawingHandImage));
    }
  } else if (isStitch) {
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
  const imageCount = images?.length ?? 0;
  const voice = resolveComponentVideoVoiceParam({
    voice: scene.videoVoice,
    componentTab: useComponentVideo === true,
    imageCount,
    voiceDisable: scene.voiceDisable,
  });

  return {
    sceneId: isStitch ? scene.id + "::stitch" : scene.id,
    prompt: buildAffiliateVideoPrompt(
      scene,
      scriptData,
      isStitch,
      useComponentVideo,
      useDrawingHandReference
    ),
    images,
    aspectRatio: scriptData?.aspectRatio ?? aspectRatio,
    videoMode: useComponentVideo
      ? Flow2VideoModeEnum.COMPONENT
      : resolveAffiliateVideoMode({ isStitch, scene, requireImageBeforeVideo }),
    noText: scene.noText,
    voiceDisable: scene.voiceDisable,
    voice,
    generateAudio: scene.voiceDisable ? false : undefined,
    // Component audio-image: không gửi artStyle (tránh lẫn visual vào prompt video)
    artStyle: useComponentVideo ? undefined : resolvedArtStyle.artStyle,
    artStyleId: useComponentVideo ? undefined : resolvedArtStyle.artStyleId,
    ...buildAutoDownloadOptions(scene, isStitch),
  };
}

function hasDrawingHandBinary(img: GeneratedImageData): boolean {
  return !!(img.mediaBlob || (img.imageBytes || "").trim());
}
