import type { ElementFormImage } from "../constants";
import type { GeneratedImageData } from "../copy-video/hook/useCopyVideoApi";

/** Ảnh giấy trắng mặc định khi không upload ảnh nền */
export const AUDIO_IMAGE_DEFAULT_BG_URL = "/assets/img/bg-audio.jpg";
/** Ảnh bàn tay cầm bút — tham chiếu khi bật "Bàn tay đang vẽ" */
export const AUDIO_IMAGE_DRAWING_HAND_URL = "/assets/img/draw-audio.jpg";

let cachedDefaultBg: ElementFormImage | null = null;
let defaultBgLoading: Promise<ElementFormImage> | null = null;
let cachedDrawingHand: ElementFormImage | null = null;
let drawingHandLoading: Promise<ElementFormImage> | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    // Không dùng spread TypedArray (cần downlevelIteration / target ES2015+)
    let part = "";
    for (let j = 0; j < slice.length; j += 1) {
      part += String.fromCharCode(slice[j]);
    }
    binary += part;
  }
  return btoa(binary);
}

async function loadCachedAssetImage(
  url: string,
  name: string,
  getCache: () => ElementFormImage | null,
  setCache: (img: ElementFormImage) => void,
  getLoading: () => Promise<ElementFormImage> | null,
  setLoading: (p: Promise<ElementFormImage> | null) => void
): Promise<ElementFormImage> {
  const hit = getCache();
  if (hit?.imageBytes) return hit;
  const inflight = getLoading();
  if (inflight) return inflight;

  const loading = (async () => {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Không tải được ảnh ${name}`);
    }
    const blob = await res.blob();
    const imageBytes = arrayBufferToBase64(await blob.arrayBuffer());
    const img: ElementFormImage = {
      imageBytes,
      mimeType: blob.type || "image/jpeg",
      fifeUrl: url,
      name,
    };
    setCache(img);
    return img;
  })();
  setLoading(loading);

  try {
    return await loading;
  } finally {
    setLoading(null);
  }
}

/** Convert bg-audio.jpg → base64 một lần rồi cache trong memory. */
export async function loadDefaultAudioImageBackground(): Promise<ElementFormImage> {
  return loadCachedAssetImage(
    AUDIO_IMAGE_DEFAULT_BG_URL,
    "bg-audio.jpg",
    () => cachedDefaultBg,
    (img) => {
      cachedDefaultBg = img;
    },
    () => defaultBgLoading,
    (p) => {
      defaultBgLoading = p;
    }
  );
}

/** Convert draw-audio.jpg → base64 (cache) — chỉ dùng khi bật bàn tay đang vẽ. */
export async function loadDrawingHandReferenceImage(): Promise<ElementFormImage> {
  return loadCachedAssetImage(
    AUDIO_IMAGE_DRAWING_HAND_URL,
    "draw-audio.jpg",
    () => cachedDrawingHand,
    (img) => {
      cachedDrawingHand = img;
    },
    () => drawingHandLoading,
    (p) => {
      drawingHandLoading = p;
    }
  );
}

/** GeneratedImageData từ draw-audio.jpg — gửi kèm gen video khi showDrawingHand. */
export async function resolveDrawingHandVideoReference(): Promise<GeneratedImageData> {
  const el = await loadDrawingHandReferenceImage();
  const converted = elementFormImageToVideoBackground(el);
  if (!converted) {
    throw new Error("Không lấy được ảnh bàn tay tham chiếu");
  }
  return converted;
}

export function elementFormImageToVideoBackground(
  img?: ElementFormImage | null
): GeneratedImageData | null {
  if (!(img?.imageBytes || "").trim()) return null;
  return {
    imageBytes: img!.imageBytes,
    mimeType: img!.mimeType || "image/jpeg",
    fifeUrl: img!.fifeUrl || "",
  };
}

/**
 * Ảnh nền: upload nếu có, không thì lấy bg-audio.jpg (base64 đã cache).
 */
export async function resolveAudioImageBackgroundElement(
  uploaded?: ElementFormImage | ElementFormImage[] | null
): Promise<ElementFormImage> {
  const first = Array.isArray(uploaded) ? uploaded[0] : uploaded;
  if ((first?.imageBytes || "").trim()) {
    return first as ElementFormImage;
  }
  return loadDefaultAudioImageBackground();
}

/** Dùng cho gen video (GeneratedImageData). */
export async function resolveAudioImageVideoBackground(
  uploaded?: ElementFormImage | ElementFormImage[] | null
): Promise<GeneratedImageData> {
  const el = await resolveAudioImageBackgroundElement(uploaded);
  const converted = elementFormImageToVideoBackground(el);
  if (!converted) {
    throw new Error("Không lấy được ảnh nền video");
  }
  return converted;
}
