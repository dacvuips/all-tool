/**
 * Film short-project IndexedDB — database riêng, tách biệt hoàn toàn
 * với affiliate-video / video-affiliate-manager / wolf / ...
 *
 * Database : film-short-projects
 * Version  : 6
 *
 * Object stores
 * ─────────────────────────────────────────────────────────────
 * projects   – metadata dự án phim ngắn (list home)
 * episodes   – tập phim thuộc project
 * characters – nhân vật thuộc project
 * props      – vật phẩm thuộc project
 * sceneImages – ảnh bối cảnh / địa điểm
 * scenes     – phân cảnh gốc thuộc tập (storyboard / ảnh / video / giọng)
 * studioTimelines – timeline Studio riêng theo tập (edit độc lập, không ghi đè scenes)
 * meta       – key/value cấu hình local (tuỳ chọn)
 *
 * Quan hệ
 * ─────────────────────────────────────────────────────────────
 * projects 1 ──* episodes 1 ──* scenes
 * episodes 1 ── 1 studioTimelines (key = episodeId)
 * projects 1 ──* characters
 * projects 1 ──* props
 * projects 1 ──* sceneImages
 * scenes.projectId + scenes.episodeId (denormalized để query nhanh)
 */

// ── DB constants ─────────────────────────────────────────────────────────────

export const FILM_DB_NAME = "film-short-projects";
/** Bump khi thêm store/index — v6: ép upgrade + migrate Studio isolation */
export const FILM_DB_VERSION = 6;

export const FILM_STORE = {
  projects: "projects",
  episodes: "episodes",
  characters: "characters",
  props: "props",
  sceneImages: "sceneImages",
  scenes: "scenes",
  /** Timeline Studio per episode — không đụng store scenes gốc */
  studioTimelines: "studioTimelines",
  meta: "meta",
} as const;

export type FilmStoreName = (typeof FILM_STORE)[keyof typeof FILM_STORE];

// ── Domain types ─────────────────────────────────────────────────────────────

export type FilmAspectRatio = "16:9" | "9:16";
/** Ngôi kể dự án — ảnh hưởng prompt trích xuất dialogues / lời dẫn. */
export type FilmNarration = "dialogue" | "third_person" | "pov";
export type FilmEntityStatus = "draft" | "in_progress" | "done";

export function normalizeFilmNarration(raw?: string | null): FilmNarration {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "third_person" || v === "third-person" || v === "ngoi_3") return "third_person";
  if (v === "pov" || v === "first_person" || v === "first-person" || v === "ngoi_1") return "pov";
  return "dialogue";
}

/** Dự án phim ngắn — store: projects (keyPath: id) */
export type FilmProjectRecord = {
  id: string;
  name: string;
  episodeCount: number;
  /** Để trống = auto chia khi generate */
  scenesPerEpisode?: number;
  artStyleId: string;
  artStyleLabel: string;
  aspectRatio: FilmAspectRatio;
  narration: FilmNarration;
  /**
   * Prompt mẫu tạo ảnh — per project (Setting).
   * Rỗng / thiếu → dùng template code mặc định.
   * Placeholder: xem film-*-image-prompt.ts
   */
  characterImagePromptTemplate?: string;
  propImagePromptTemplate?: string;
  locationImagePromptTemplate?: string;
  /**
   * Prompt storyboard chung (Setting).
   * Khi lưu Setting — field có giá trị sẽ ghi vào mọi phân cảnh (imagePrompt / videoPrompt / audioPrompt).
   * Dùng cho Ảnh cảnh quay (kèm tham chiếu ảnh nhân vật/vật phẩm/bối cảnh).
   */
  storyboardImagePrompt?: string;
  storyboardVideoPrompt?: string;
  storyboardAudioPrompt?: string;
  /** 0–100, denormalized cho progress bar ở list */
  progress: number;
  /** Denormalized count cho card list */
  characterCount: number;
  /** Denormalized count cho card list */
  sceneCount: number;
  coverImageId?: string;
  /**
   * Studio: cấu hình phụ đề (vị trí, cỡ chữ, màu, hiện/ẩn).
   * Persist theo project — giữ khi reload / mở lại tab Studio.
   */
  studioSubtitleConfig?: FilmStudioSubtitleConfig;
  /**
   * Studio: âm lượng tiếng gốc track Video (0–100, preview + xuất MP4).
   * Track Audio (thoại) vẫn phát / mux bình thường.
   */
  studioVideoAudioVolume?: number;
  /** @deprecated Dùng studioVideoAudioVolume = 0 */
  studioMuteVideoAudio?: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Cấu hình phụ đề Studio (preview + burn export) */
export type FilmStudioSubtitleStyle = {
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  fontSizePx: number;
  textColor: string;
  bgColor: string;
  bgTransparent: boolean;
  borderColor: string;
  borderTransparent: boolean;
};

export type FilmStudioSubtitleConfig = {
  showOverlay: boolean;
  style: FilmStudioSubtitleStyle;
};

export const DEFAULT_FILM_STUDIO_SUBTITLE_STYLE: FilmStudioSubtitleStyle = {
  xPercent: 50,
  yPercent: 88,
  widthPercent: 90,
  fontSizePx: 11,
  textColor: "#ffffff",
  bgColor: "#000000",
  bgTransparent: true,
  borderColor: "#ffffff",
  borderTransparent: true,
};

/** Âm lượng clip/timeline — 0–100, mặc định 100 */
export function normalizeFilmAudioVolume(input?: number | null): number {
  if (input == null || !Number.isFinite(input)) return 100;
  return Math.max(0, Math.min(100, Math.round(input)));
}

/** Âm lượng tiếng gốc video Studio — migrate từ studioMuteVideoAudio */
export function resolveStudioVideoAudioVolume(
  project?: Pick<FilmProjectRecord, "studioVideoAudioVolume" | "studioMuteVideoAudio"> | null
): number {
  if (
    project?.studioVideoAudioVolume != null &&
    Number.isFinite(project.studioVideoAudioVolume)
  ) {
    return normalizeFilmAudioVolume(project.studioVideoAudioVolume);
  }
  if (project?.studioMuteVideoAudio) return 0;
  return 100;
}

export function normalizeFilmStudioSubtitleConfig(
  input?: FilmStudioSubtitleConfig | null
): FilmStudioSubtitleConfig {
  const style = input?.style || DEFAULT_FILM_STUDIO_SUBTITLE_STYLE;
  return {
    showOverlay: input?.showOverlay !== false,
    style: {
      xPercent: clampNum(style.xPercent, 0, 100, DEFAULT_FILM_STUDIO_SUBTITLE_STYLE.xPercent),
      yPercent: clampNum(style.yPercent, 0, 100, DEFAULT_FILM_STUDIO_SUBTITLE_STYLE.yPercent),
      widthPercent: clampNum(
        style.widthPercent,
        20,
        100,
        DEFAULT_FILM_STUDIO_SUBTITLE_STYLE.widthPercent
      ),
      fontSizePx: clampNum(
        style.fontSizePx,
        11,
        40,
        DEFAULT_FILM_STUDIO_SUBTITLE_STYLE.fontSizePx
      ),
      textColor: String(style.textColor || DEFAULT_FILM_STUDIO_SUBTITLE_STYLE.textColor),
      bgColor: String(style.bgColor || DEFAULT_FILM_STUDIO_SUBTITLE_STYLE.bgColor),
      bgTransparent:
        style.bgTransparent ?? DEFAULT_FILM_STUDIO_SUBTITLE_STYLE.bgTransparent,
      borderColor: String(style.borderColor || DEFAULT_FILM_STUDIO_SUBTITLE_STYLE.borderColor),
      borderTransparent:
        style.borderTransparent ?? DEFAULT_FILM_STUDIO_SUBTITLE_STYLE.borderTransparent,
    },
  };
}

function clampNum(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, v));
}

/** Tập phim — store: episodes (keyPath: id, index: projectId, projectId_index) */
export type FilmEpisodeRecord = {
  id: string;
  projectId: string;
  /** Thứ tự tập, 1-based */
  index: number;
  title: string;
  status: FilmEntityStatus;
  sceneCount: number;
  /** Nội dung gốc (tiểu thuyết / tóm tắt) — panel script */
  originalContent?: string;
  createdAt: string;
  updatedAt: string;
};

/** Bước workspace sidebar */
export type FilmWorkspaceStepId =
  | "original_content"
  | "storyboard"
  | "character_images"
  | "props"
  | "scene_images"
  | "voice"
  | "shot_images"
  | "create_video"
  | "studio"
  | "settings";

export type FilmWorkspaceStepSection = "script" | "production" | "settings";

export type FilmWorkspaceStep = {
  id: FilmWorkspaceStepId;
  section: FilmWorkspaceStepSection;
  label: string;
  /** Hiển thị số bước kiểu "01" cho script items */
  stepNo?: string;
  /** Đánh dấu hoàn thành (UI) */
  done?: boolean;
};

/** Nhân vật — store: characters (keyPath: id, index: projectId) */
export type FilmCharacterRole = "main" | "antagonist" | "supporting" | "extra";

export type FilmCharacterStatus = "pending" | "creating" | "created" | "failed";

export type FilmCharacterRecord = {
  id: string;
  projectId: string;
  name: string;
  /** Main / Antagonist / Supporting... */
  role?: FilmCharacterRole | string;
  /** Ngoại hình / tính cách (không gồm trang phục) */
  description?: string;
  /** Clothing & Accessories — trang phục, phụ kiện */
  clothingAccessories?: string;
  /**
   * Tên vật phẩm gợi ý / gắn cho nhân vật (khớp FilmPropRecord.name trong tab Vật phẩm).
   */
  propNames?: string[];
  /**
   * Gắn thẻ tập phim — ảnh / gắn nhân vật trong Chuỗi Cảnh quay
   * chỉ hiện khi episode hiện tại nằm trong danh sách này.
   * Rỗng / thiếu → chưa gán (không hiện trong attach theo tập).
   */
  episodeIds?: string[];
  /** Prompt instruction khi tạo ảnh character sheet */
  imagePrompt?: string;
  /** Ảnh chính */
  imageUrl?: string;
  /** Gallery poses */
  imageUrls?: string[];
  /** Binary local (IndexedDB) — ưu tiên preview, tránh CORS URL Flow2 */
  imageBlob?: Blob;
  status?: FilmCharacterStatus;
  /** Media job đang chạy (đổi tab / đóng dialog vẫn resume) */
  mediaJobId?: string;
  mediaJobProgress?: number;
  /** Lỗi generate ảnh — hiển thị inline trên card (không toast) */
  mediaError?: string;
  /** Voice_id gắn nhân vật (TTS / clone từ tab Voice) */
  voiceId?: string;
  /** Tên hiển thị của giọng */
  voiceLabel?: string;
  /** Audio mẫu để nghe tại chỗ trong modal sửa */
  voicePreviewBlob?: Blob;
  voiceResultId?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

/** Vật phẩm — store: props (keyPath: id, index: projectId) */
export type FilmPropCategory = "weapon" | "container" | "prop" | "clothing" | "other";

export type FilmPropStatus = "pending" | "creating" | "created" | "failed";

export type FilmPropRecord = {
  id: string;
  projectId: string;
  name: string;
  category?: FilmPropCategory | string;
  description?: string;
  /**
   * Vật phẩm kèm / phụ kiện liên quan (khớp FilmPropRecord.name khác).
   * Dùng gợi ý AI + ref khi gen ảnh vật phẩm.
   */
  propNames?: string[];
  /**
   * Gắn thẻ tập — Gắn Vật phẩm trong Chuỗi Cảnh quay theo tập.
   * Rỗng → chưa gán (không hiện trong attach theo tập).
   */
  episodeIds?: string[];
  /** Prompt instruction khi tạo ảnh prop product shot */
  imagePrompt?: string;
  imageUrl?: string;
  imageUrls?: string[];
  imageBlob?: Blob;
  status?: FilmPropStatus;
  mediaJobId?: string;
  mediaJobProgress?: number;
  /** Lỗi generate ảnh — hiển thị inline trên card */
  mediaError?: string;
  locked?: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

/** Ảnh bối cảnh (Ảnh Cảnh) — store: sceneImages */
export type FilmSceneImageStatus = "pending" | "creating" | "created" | "failed";

export type FilmSceneImageRecord = {
  id: string;
  projectId: string;
  /** Tên địa điểm / cảnh (vd. Hoa Quả Sơn) */
  name: string;
  /** Ngữ cảnh tình huống: sau mưa, sau trận chiến... */
  context?: string;
  /**
   * Time of Day / ánh sáng điện ảnh
   * e.g. Golden Hour, Harsh Noon, Rainy Night, Blue Hour
   */
  timeOfDay?: string;
  description?: string;
  /**
   * Vật phẩm / set dressing gợi ý gắn bối cảnh (khớp FilmPropRecord.name).
   */
  propNames?: string[];
  /**
   * Gắn thẻ tập — Gắn Cảnh trong Chuỗi Cảnh quay theo tập.
   */
  episodeIds?: string[];
  /** Prompt instruction khi tạo ảnh location sheet */
  imagePrompt?: string;
  imageUrl?: string;
  imageUrls?: string[];
  imageBlob?: Blob;
  status?: FilmSceneImageStatus;
  mediaJobId?: string;
  mediaJobProgress?: number;
  /** Lỗi generate ảnh — hiển thị inline trên card */
  mediaError?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

/** Một bản audio TTS đã tạo cho câu thoại — tab Tạo giọng */
export type FilmDialogueVoiceTakeRecord = {
  id: string;
  voiceBlob?: Blob;
  voiceUrl?: string;
  voiceId?: string;
  voiceLabel?: string;
  createdAt?: string;
  /** Chỉ một take được đánh dấu mặc định */
  isDefault?: boolean;
};

/** Một lời thoại (tách từ field dialogue) — dùng tab Tạo giọng */
export type FilmDialogueLineRecord = {
  id: string;
  character: string;
  line: string;
  voiceStatus?: "pending" | "creating" | "ready" | "error";
  voiceUrl?: string;
  /** Audio đã tạo — lưu IDB */
  voiceBlob?: Blob;
  voiceError?: string;
  voiceSource?: "catalog" | "custom_id" | "minimax";
  voiceId?: string;
  voiceLabel?: string;
  /** Giọng riêng cho câu thoại này (khác giọng mặc định nhân vật) */
  voiceCustom?: boolean;
  /** Các bản audio đã tạo — `voiceBlob`/`voiceUrl` trên line sync từ take mặc định */
  voiceTakes?: FilmDialogueVoiceTakeRecord[];
  /**
   * Studio: mốc bắt đầu tuyệt đối trên timeline Audio/Phụ đề (giây), độc lập video.
   * Có giá trị → dùng trực tiếp. Không set → xem timelineOffsetSec (legacy) hoặc auto-pack.
   */
  timelineStartSec?: number;
  /**
   * @deprecated Legacy: offset so với đầu phân cảnh video. Chỉ dùng khi chưa có timelineStartSec.
   */
  timelineOffsetSec?: number;
  /** Studio: độ dài clip trên track Audio/Phụ đề (giây), độc lập duration video */
  timelineDurationSec?: number;
  /**
   * Studio: mốc bắt đầu riêng cho track Phụ đề (giây).
   * Có giá trị → phụ đề lệch độc lập audio. Không set → dùng timelineStartSec.
   */
  subtitleStartSec?: number;
  /**
   * Studio: độ dài riêng track Phụ đề (giây).
   * Có giá trị → cắt/kéo mép phụ đề không đụng audio.
   */
  subtitleDurationSec?: number;
  /** Studio: trim vào trong file audio nguồn (giây) — cắt bỏ phần đầu audio */
  voiceTrimInSec?: number;
  /** Studio: âm lượng clip audio trên timeline (0–100, mặc định 100) */
  voiceVolume?: number;
  /**
   * Studio: dòng chèn từ Studio (audio/phụ đề độc lập) — chỉ hiện trên timeline,
   * không ghi vào field Thoại / không hiện tab Tạo giọng / Chuỗi phân cảnh.
   */
  studioOnly?: boolean;
  /**
   * Studio: bật/tắt riêng block phụ đề (preview + burn).
   * Mặc định true khi không set. false = ẩn / không burn clip này.
   */
  subtitleEnabled?: boolean;
};

/** Phân cảnh / cảnh quay — store: scenes (keyPath: id, indexes: projectId, episodeId) */
export type FilmSceneRecord = {
  id: string;
  projectId: string;
  episodeId: string;
  /** Thứ tự trong tập, 1-based */
  index: number;
  /** Tiêu đề ngắn */
  title?: string;
  /** Tóm tắt / overview */
  summary?: string;
  /** Cỡ cảnh: Toàn cảnh, Trung cảnh... */
  shotSize?: string;
  /** Góc máy */
  cameraAngle?: string;
  /** Lia máy */
  cameraMovement?: string;
  /** Địa điểm */
  location?: string;
  /** Thời lượng giây (độ dài clip trên Studio timeline) */
  durationSec?: number;
  /**
   * Studio: trim vào trong file video nguồn (giây).
   * Playhead local = timelineSec - sceneStart + videoTrimInSec.
   */
  videoTrimInSec?: number;
  /** Studio: điểm cắt cuối trong file nguồn (giây). Không set = hết clip timeline / hết file. */
  videoTrimOutSec?: number;
  /** Tên nhân vật gắn */
  characterNames?: string[];
  /** Tên vật phẩm gắn */
  propNames?: string[];
  /** Tên bối cảnh gắn (multi — cùng pattern characterNames) */
  locationNames?: string[];
  /** Gắn cảnh (tag) — legacy / primary, đồng bộ với locationNames[0] */
  sceneTag?: string;
  /** Hành động */
  action?: string;
  /** Mô tả hình ảnh cảnh quay */
  visualDescription?: string;
  /** Không khí / cảm xúc cảnh */
  atmosphere?: string;
  /** Thoại / kể chuyện — format "Tên: thoại" mỗi dòng */
  dialogue?: string;
  /**
   * Thoại đã tách từng lời (Tạo giọng).
   * Đồng bộ từ `dialogue` khi save / mở tab voice.
   */
  dialogueLines?: FilmDialogueLineRecord[];
  /** Prompt ảnh */
  imagePrompt?: string;
  /** User đã sửa tay Prompt ảnh — không tự ghép đè */
  imagePromptCustom?: boolean;
  /** Prompt video */
  videoPrompt?: string;
  /** User đã sửa tay Prompt video — không tự ghép đè */
  videoPromptCustom?: boolean;
  /**
   * Tạo video: nhép miệng theo [DIALOGUE], không phát tiếng nói.
   * Prompt giữ thoại + ghi chú silent; generateAudio = false.
   */
  videoSilentLipSync?: boolean;
  /**
   * Giọng Flow2 khi Tạo video mode Thành phần (vd. achernar).
   * Chỉ dùng khi video_mode=component và có ảnh tham chiếu.
   */
  videoVoice?: string;
  /** Prompt âm thanh */
  audioPrompt?: string;
  /** User đã sửa tay Prompt âm thanh — không tự ghép đè */
  audioPromptCustom?: boolean;
  /** [MOTION] chuyển động camera + nhân vật */
  motionPrompt?: string;
  /** [AUDIO] ambience / nền âm */
  audioAmbience?: string;
  /** [SFX] */
  sfx?: string;
  /** [MUSIC] */
  music?: string;
  /** [VOICE] giới tính, pitch, tốc độ, tuổi giọng, cảm xúc (không phải lời thoại) */
  voiceDirection?: string;
  /** Trạng thái media preview (storyboard) */
  mediaStatus?: "pending" | "ready" | "error";
  /** Khung hình Ảnh Cảnh quay */
  frameStatus?: "pending" | "creating" | "ready" | "error";
  frameImageUrl?: string;
  /** Binary local khung hình */
  frameImageBlob?: Blob;
  frameMediaJobId?: string;
  frameMediaProgress?: number;
  /** Lỗi tạo khung hình — hiển thị trên card */
  frameError?: string;
  /**
   * Prompt AI viết lại để tránh content policy (Ảnh Cảnh quay).
   * Không ghi đè `imagePrompt` chính của phân cảnh.
   */
  frameSuggestedPrompt?: string;
  /** Tóm tắt thay đổi từ AI */
  frameSuggestSummary?: string;
  /**
   * Prompt dùng khi gen ảnh:
   * - suggested (mặc định nếu có frameSuggestedPrompt)
   * - main = imagePrompt / prompt phân cảnh
   */
  framePromptSource?: "main" | "suggested";
  frameSuggestStatus?: "idle" | "loading" | "ready" | "error";
  frameSuggestError?: string;
  /** Video tạo từ khung hình */
  videoStatus?: "pending" | "creating" | "ready" | "error";
  videoUrl?: string;
  /** Binary local video (IndexedDB) — ưu tiên preview/export, tránh CORS URL Flow */
  videoBlob?: Blob;
  /** Flow2 request_id — upscale tải 1080p */
  videoFlow2RequestId?: string;
  /**
   * Clip phát sinh trong timeline Studio (cắt / chèn file).
   * Chỉ tồn tại trong store `studioTimelines` — không ghi vào `scenes` gốc.
   */
  studioDerived?: boolean;
  /** Job poll resume (FILM_GENERATION_VIDEO) */
  videoMediaJobId?: string;
  videoMediaProgress?: number;
  /** Lỗi tạo video — hiển thị trên card */
  videoError?: string;
  /**
   * Ảnh tham chiếu khi Tạo video (số slot: Bắt đầu=1, Start-End=2, Thành phần=3).
   * Mặc định slot đầu = ảnh khung phân cảnh.
   */
  videoRefSlots?: Array<{
    imageUrl?: string;
    imageBlob?: Blob;
    name?: string;
  } | null>;
  /** Giọng / TTS cho thoại */
  voiceStatus?: "pending" | "creating" | "ready" | "error";
  voiceUrl?: string;
  /** Lỗi tạo giọng — hiển thị trên card */
  voiceError?: string;
  /** Nguồn giọng: catalog | custom_id | minimax */
  voiceSource?: "catalog" | "custom_id" | "minimax";
  voiceId?: string;
  voiceLabel?: string;
  /** Studio: âm lượng audio cấp scene (0–100) khi không gắn dialogue line */
  voiceVolume?: number;
  /** Tên nhân vật nói thoại (hiển thị badge) */
  speakerName?: string;
  status: FilmEntityStatus;
  createdAt: string;
  updatedAt: string;
};

/** Meta key/value — store: meta (không keyPath, key do caller) */
export type FilmMetaRecord = {
  value: unknown;
  updatedAt: string;
};

/**
 * Timeline Studio theo tập — store: studioTimelines (keyPath: episodeId).
 * Chỉ đọc media từ scenes gốc; mọi cắt/chèn/xóa chỉ lưu ở đây.
 */
export type FilmStudioTimelineRecord = {
  episodeId: string;
  projectId: string;
  scenes: FilmSceneRecord[];
  updatedAt: string;
};

// ── Input types (UI) ─────────────────────────────────────────────────────────

export type FilmProjectCreateInput = {
  name: string;
  episodeCount: number;
  scenesPerEpisode?: number;
  artStyleId: string;
  artStyleLabel: string;
  aspectRatio: FilmAspectRatio;
  narration: FilmNarration;
};

/** @deprecated alias – dùng FilmProjectRecord */
export type FilmProject = FilmProjectRecord;

export const FILM_ART_STYLE_FREE = "";

/** localStorage legacy (migrate 1 lần sang IDB) */
export const FILM_PROJECTS_STORAGE_KEY = "film-projects-v1";

// ── Helpers ──────────────────────────────────────────────────────────────────

export function createFilmId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function buildFilmProjectRecord(input: FilmProjectCreateInput): FilmProjectRecord {
  const now = new Date().toISOString();
  const sceneCount =
    input.scenesPerEpisode != null
      ? input.episodeCount * input.scenesPerEpisode
      : input.episodeCount * 3;

  return {
    id: createFilmId("film"),
    name: input.name,
    episodeCount: Math.max(1, input.episodeCount || 1),
    scenesPerEpisode: input.scenesPerEpisode,
    artStyleId: input.artStyleId || FILM_ART_STYLE_FREE,
    artStyleLabel: input.artStyleLabel || "",
    aspectRatio: input.aspectRatio,
    narration: normalizeFilmNarration(input.narration),
    progress: 5,
    characterCount: 0,
    sceneCount,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildFilmEpisodesForProject(project: FilmProjectRecord): FilmEpisodeRecord[] {
  const now = project.createdAt || new Date().toISOString();
  const scenesPerEp = project.scenesPerEpisode ?? Math.max(1, Math.ceil(project.sceneCount / project.episodeCount) || 3);

  return Array.from({ length: project.episodeCount }, (_, i) => ({
    id: createFilmId("ep"),
    projectId: project.id,
    index: i + 1,
    title: `Tập ${i + 1}`,
    status: "draft" as FilmEntityStatus,
    sceneCount: scenesPerEp,
    originalContent: "",
    createdAt: now,
    updatedAt: now,
  }));
}

export function buildFilmScenesForEpisode(
  projectId: string,
  episode: FilmEpisodeRecord
): FilmSceneRecord[] {
  const now = episode.createdAt || new Date().toISOString();
  const count = Math.max(0, episode.sceneCount || 0);

  return Array.from({ length: count }, (_, i) => ({
    id: createFilmId("sc"),
    projectId,
    episodeId: episode.id,
    index: i + 1,
    title: `Cảnh quay #${i + 1}`,
    summary: "",
    shotSize: "Toàn cảnh",
    cameraAngle: "",
    cameraMovement: "",
    location: "",
    durationSec: 8,
    characterNames: [],
    propNames: [],
    locationNames: [],
    sceneTag: "",
    action: "",
    visualDescription: "",
    atmosphere: "",
    dialogue: "",
    dialogueLines: [],
    imagePrompt: "",
    videoPrompt: "",
    audioPrompt: "",
    mediaStatus: "pending" as const,
    frameStatus: "pending" as const,
    frameImageUrl: "",
    videoStatus: "pending" as const,
    videoUrl: "",
    voiceStatus: "pending" as const,
    voiceUrl: "",
    speakerName: "",
    status: "draft" as FilmEntityStatus,
    createdAt: now,
    updatedAt: now,
  }));
}

/** Tạo scene storyboard placeholder từ nội dung gốc (client-side, chưa gọi AI) */
export function buildStoryboardScenesFromContent(
  projectId: string,
  episode: FilmEpisodeRecord,
  originalContent: string,
  preferredCount?: number
): FilmSceneRecord[] {
  const now = new Date().toISOString();
  const paragraphs = originalContent
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);

  const chunks =
    paragraphs.length > 0
      ? paragraphs
      : originalContent
          .split(/[.!?。]\s+/)
          .map((p) => p.trim())
          .filter((p) => p.length > 15);

  const target =
    preferredCount && preferredCount > 0
      ? preferredCount
      : Math.min(12, Math.max(3, chunks.length || 3));

  const list: FilmSceneRecord[] = [];
  for (let i = 0; i < target; i++) {
    const text = chunks[i % Math.max(1, chunks.length)] || `Cảnh quay ${i + 1}`;
    const snippet = text.length > 160 ? `${text.slice(0, 160)}…` : text;
    list.push({
      id: createFilmId("sc"),
      projectId,
      episodeId: episode.id,
      index: i + 1,
      title: `Cảnh quay #${i + 1}`,
      summary: snippet,
      shotSize: i % 2 === 0 ? "Toàn cảnh" : "Trung cảnh",
      cameraAngle: i % 3 === 0 ? "Phía sau" : "Chính diện",
      cameraMovement: i % 2 === 0 ? "Theo sau" : "Tĩnh",
      location: "",
      durationSec: 8 + (i % 5),
      characterNames: [],
      propNames: [],
      locationNames: [],
      sceneTag: "",
      action: snippet,
      visualDescription: snippet,
      atmosphere: "",
      dialogue: "",
      dialogueLines: [],
      imagePrompt: "",
      videoPrompt: "",
      audioPrompt: "",
      mediaStatus: "pending",
      frameStatus: "pending",
      frameImageUrl: "",
      videoStatus: "pending",
      videoUrl: "",
      voiceStatus: "pending",
      voiceUrl: "",
      speakerName: "",
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
  }
  return list;
}

export function filmScenesTotalDuration(scenes: FilmSceneRecord[]): number {
  return scenes.reduce((sum, s) => sum + (s.durationSec || 0), 0);
}

const DEFAULT_ROLES: FilmCharacterRole[] = ["main", "antagonist", "supporting", "supporting", "extra"];

/** Gộp tên nhân vật từ scenes + trích thô từ thoại trong nội dung */
export function collectCharacterNamesFromScenes(scenes: FilmSceneRecord[]): string[] {
  const set = new Set<string>();
  for (const s of scenes) {
    for (const n of s.characterNames || []) {
      const t = n.trim();
      if (t) set.add(t);
    }
    // "Tên: lời thoại" — mọi dòng
    const dialogue = s.dialogue || "";
    const re = /(?:^|\n)\s*([^:\n]{2,40}?)\s*:/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(dialogue))) {
      const n = m[1]?.trim();
      if (n) set.add(n);
    }
    for (const dl of s.dialogueLines || []) {
      const n = dl.character?.trim();
      if (n) set.add(n);
    }
  }
  return Array.from(set);
}

/** Trích tên nhân vật thô từ nội dung (pattern thường gặp) */
export function extractCharacterNamesFromText(text: string): string[] {
  if (!text?.trim()) return [];
  const set = new Set<string>();
  // "Tên: " trên đầu dòng
  const re = /(?:^|\n)\s*([A-ZÀ-Ỹ][\wÀ-ỹ' ]{1,30})\s*:/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const n = m[1]?.trim();
    if (n && n.length >= 2 && n.length <= 40) set.add(n);
  }
  // Một số tên nổi tiếng (fallback demo) — bỏ nếu đã đủ
  return Array.from(set);
}

export function buildFilmCharactersFromNames(
  projectId: string,
  names: string[]
): FilmCharacterRecord[] {
  const now = new Date().toISOString();
  const unique = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
  return unique.map((name, i) => ({
    id: createFilmId("ch"),
    projectId,
    name,
    role: DEFAULT_ROLES[Math.min(i, DEFAULT_ROLES.length - 1)],
    description: "",
    clothingAccessories: "",
    propNames: [],
    episodeIds: [],
    imagePrompt: "",
    imageUrl: "",
    imageUrls: [],
    status: "pending" as FilmCharacterStatus,
    sortOrder: i,
    createdAt: now,
    updatedAt: now,
  }));
}

export function filmCharacterRoleLabel(role?: string): string {
  switch (role) {
    case "main":
      return "Main";
    case "antagonist":
      return "Antagonist";
    case "supporting":
      return "Supporting";
    case "extra":
      return "Extra";
    default:
      return role || "Supporting";
  }
}

export function createEmptyFilmCharacter(
  projectId: string,
  index: number,
  name?: string,
  episodeIds?: string[]
): FilmCharacterRecord {
  const now = new Date().toISOString();
  return {
    id: createFilmId("ch"),
    projectId,
    name: name || `Nhân vật ${index + 1}`,
    role: "supporting",
    description: "",
    clothingAccessories: "",
    propNames: [],
    episodeIds: episodeIds?.length ? [...episodeIds] : [],
    imagePrompt: "",
    imageUrl: "",
    imageUrls: [],
    status: "pending",
    sortOrder: index,
    createdAt: now,
    updatedAt: now,
  };
}

/** Entity (NV / VP / Bối cảnh) gắn thẻ tập → hiện trong attach của tập đó */
export function filmEntityLinkedToEpisode(
  entity: { episodeIds?: string[] },
  episodeId: string | null | undefined
): boolean {
  if (!episodeId) return true;
  const ids = entity.episodeIds;
  if (!ids || ids.length === 0) return false;
  return ids.includes(episodeId);
}

/** Nhân vật gắn thẻ tập phim → hiện trong Gắn Nhân vật của tập đó */
export function filmCharacterLinkedToEpisode(
  character: Pick<FilmCharacterRecord, "episodeIds">,
  episodeId: string | null | undefined
): boolean {
  return filmEntityLinkedToEpisode(character, episodeId);
}

export function filmPropLinkedToEpisode(
  prop: Pick<FilmPropRecord, "episodeIds">,
  episodeId: string | null | undefined
): boolean {
  return filmEntityLinkedToEpisode(prop, episodeId);
}

export function filmLocationLinkedToEpisode(
  location: Pick<FilmSceneImageRecord, "episodeIds">,
  episodeId: string | null | undefined
): boolean {
  return filmEntityLinkedToEpisode(location, episodeId);
}

/** Tên clone không trùng trong list hiện có */
export function nextFilmEntityCloneName(
  baseName: string,
  existingNames: string[],
  fallback = "Bản sao"
): string {
  const taken = new Set(existingNames.map((n) => n.trim().toLowerCase()).filter(Boolean));
  const root = (baseName || fallback).trim() || fallback;
  let n = 1;
  while (true) {
    const candidate = n === 1 ? `${root} (bản sao)` : `${root} (bản sao ${n})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
    n += 1;
  }
}

export function nextFilmCharacterCloneName(
  baseName: string,
  existingNames: string[]
): string {
  return nextFilmEntityCloneName(baseName, existingNames, "Nhân vật");
}

export function nextFilmPropCloneName(
  baseName: string,
  existingNames: string[]
): string {
  return nextFilmEntityCloneName(baseName, existingNames, "Vật phẩm");
}

export function nextFilmLocationCloneName(
  baseName: string,
  existingNames: string[]
): string {
  return nextFilmEntityCloneName(baseName, existingNames, "Bối cảnh");
}

const DEFAULT_PROP_CATEGORIES: FilmPropCategory[] = [
  "weapon",
  "container",
  "prop",
  "clothing",
  "other",
];

export function collectPropNamesFromScenes(scenes: FilmSceneRecord[]): string[] {
  const set = new Set<string>();
  for (const s of scenes) {
    for (const n of s.propNames || []) {
      const t = n.trim();
      if (t) set.add(t);
    }
  }
  return Array.from(set);
}

export function buildFilmPropsFromNames(
  projectId: string,
  names: string[],
  categories?: (FilmPropCategory | string)[]
): FilmPropRecord[] {
  const now = new Date().toISOString();
  const unique = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
  return unique.map((name, i) => ({
    id: createFilmId("pr"),
    projectId,
    name,
    category: categories?.[i] || DEFAULT_PROP_CATEGORIES[Math.min(i, DEFAULT_PROP_CATEGORIES.length - 1)],
    description: "",
    propNames: [],
    episodeIds: [],
    imagePrompt: "",
    imageUrl: "",
    imageUrls: [],
    status: "pending" as FilmPropStatus,
    locked: false,
    sortOrder: i,
    createdAt: now,
    updatedAt: now,
  }));
}

export function filmPropCategoryLabel(category?: string): string {
  switch (category) {
    case "weapon":
      return "Weapon";
    case "container":
      return "Container";
    case "prop":
      return "prop";
    case "clothing":
      return "Clothing";
    case "other":
      return "Other";
    default:
      return category || "prop";
  }
}

export function createEmptyFilmProp(
  projectId: string,
  index: number,
  name?: string,
  episodeIds?: string[]
): FilmPropRecord {
  const now = new Date().toISOString();
  return {
    id: createFilmId("pr"),
    projectId,
    name: name || `Vật phẩm ${index}`,
    category: "prop",
    description: "",
    propNames: [],
    episodeIds: episodeIds?.length ? [...episodeIds] : [],
    imagePrompt: "",
    imageUrl: "",
    imageUrls: [],
    status: "pending",
    locked: false,
    sortOrder: index,
    createdAt: now,
    updatedAt: now,
  };
}

/** Gộp địa điểm từ scenes (unique theo location / tag / title) */
export function collectLocationsFromScenes(
  scenes: FilmSceneRecord[]
): { name: string; context: string }[] {
  const map = new Map<string, string>();
  for (const s of scenes) {
    const name = (s.location || s.sceneTag || s.title || "").trim();
    if (!name) continue;
    const ctx = (s.summary || s.action || s.visualDescription || "").trim().slice(0, 60);
    if (!map.has(name)) map.set(name, ctx || "Ngày");
  }
  return Array.from(map.entries()).map(([name, context]) => ({ name, context }));
}

export function buildFilmSceneImagesFromLocations(
  projectId: string,
  locations: { name: string; context?: string }[]
): FilmSceneImageRecord[] {
  const now = new Date().toISOString();
  return locations.map((loc, i) => ({
    id: createFilmId("loc"),
    projectId,
    name: loc.name,
    context: loc.context || "Ngày",
    timeOfDay: loc.context || "Daylight",
    description: "",
    propNames: [],
    episodeIds: [],
    imagePrompt: "",
    imageUrl: "",
    imageUrls: [],
    status: "pending" as FilmSceneImageStatus,
    sortOrder: i,
    createdAt: now,
    updatedAt: now,
  }));
}

export function createEmptyFilmSceneImage(
  projectId: string,
  index: number,
  name?: string,
  episodeIds?: string[]
): FilmSceneImageRecord {
  const now = new Date().toISOString();
  return {
    id: createFilmId("loc"),
    projectId,
    name: name || `Cảnh ${index}`,
    context: "Ngày",
    timeOfDay: "Daylight",
    description: "",
    propNames: [],
    episodeIds: episodeIds?.length ? [...episodeIds] : [],
    imagePrompt: "",
    imageUrl: "",
    imageUrls: [],
    status: "pending",
    sortOrder: index,
    createdAt: now,
    updatedAt: now,
  };
}
