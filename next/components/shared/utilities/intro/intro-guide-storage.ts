/** Prefix localStorage cho trạng thái đã xem hướng dẫn intro */

const STORAGE_PREFIX = "intro-guide-seen:";



/** Mỗi tab / vùng UI có một key riêng */

export enum IntroGuideKey {

  COPY_VIDEO_SIDEBAR = "copy-video-sidebar",

  /** @deprecated Dùng BATCH_LIST — giữ để tương thích localStorage cũ */
  COPY_VIDEO_BATCH_LIST = "copy-video-batch-list",

  TRENDING_SIDEBAR = "trending-sidebar",

  /** @deprecated Dùng BATCH_LIST */
  TRENDING_BATCH_LIST = "trending-batch-list",

  SINGLE_SIDEBAR = "single-sidebar",

  /** @deprecated Dùng BATCH_LIST */
  SINGLE_BATCH_LIST = "single-batch-list",

  BATCH_SIDEBAR = "batch-sidebar",

  /** @deprecated Dùng BATCH_LIST */
  BATCH_BATCH_LIST = "batch-batch-list",

  APP_SIDEBAR = "app-sidebar",

  ELEMENT_SIDEBAR = "element-sidebar",

  /** @deprecated Dùng BATCH_LIST */
  ELEMENT_BATCH_LIST = "element-batch-list",

  /** @deprecated Dùng BATCH_LIST */
  ELEMENT_IMAGES_TO_VIDEO_BATCH_LIST = "element-images-to-video-batch-list",

  /** @deprecated Dùng BATCH_LIST */
  ELEMENT_VIDEO_TO_VIDEO_BATCH_LIST = "element-video-to-video-batch-list",

  REVIEW_SIDEBAR = "review-sidebar",

  /** @deprecated Dùng BATCH_LIST */
  REVIEW_BATCH_LIST = "review-batch-list",

  STORYBOARD_SIDEBAR = "storyboard-sidebar",
  /** @deprecated Dùng BATCH_LIST */
  STORYBOARD_BATCH_LIST = "storyboard-batch-list",
  CHATBOT_SIDEBAR = "chatbot-sidebar",

  /** Batch list right panel — dùng chung 1 key cho mọi tab */
  BATCH_LIST = "affiliate-batch-list",
}



const LEGACY_BATCH_LIST_KEYS: IntroGuideKey[] = [
  IntroGuideKey.COPY_VIDEO_BATCH_LIST,
  IntroGuideKey.TRENDING_BATCH_LIST,
  IntroGuideKey.SINGLE_BATCH_LIST,
  IntroGuideKey.BATCH_BATCH_LIST,
  IntroGuideKey.ELEMENT_BATCH_LIST,
  IntroGuideKey.ELEMENT_IMAGES_TO_VIDEO_BATCH_LIST,
  IntroGuideKey.ELEMENT_VIDEO_TO_VIDEO_BATCH_LIST,
  IntroGuideKey.REVIEW_BATCH_LIST,
  IntroGuideKey.STORYBOARD_BATCH_LIST,
];

export function hasSeenIntroGuide(key: IntroGuideKey | string): boolean {
  try {
    if (typeof window === "undefined") return true;

    if (localStorage.getItem(`${STORAGE_PREFIX}${key}`) === "1") return true;

    if (key === IntroGuideKey.BATCH_LIST) {
      return LEGACY_BATCH_LIST_KEYS.some(
        (legacyKey) => localStorage.getItem(`${STORAGE_PREFIX}${legacyKey}`) === "1"
      );
    }

    return false;
  } catch {
    return true;
  }
}



export function markIntroGuideSeen(key: IntroGuideKey | string): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, "1");
    window.dispatchEvent(new CustomEvent("affiliate-intro-guide-seen", { detail: { key } }));
  } catch {
    // ignore quota / private mode
  }
}

