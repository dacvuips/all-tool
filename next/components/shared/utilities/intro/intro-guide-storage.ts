/** Prefix localStorage cho trạng thái đã xem hướng dẫn intro */

const STORAGE_PREFIX = "intro-guide-seen:";



/** Mỗi tab / vùng UI có một key riêng */

export enum IntroGuideKey {

  COPY_VIDEO_SIDEBAR = "copy-video-sidebar",

  COPY_VIDEO_BATCH_LIST = "copy-video-batch-list",

  TRENDING_SIDEBAR = "trending-sidebar",

  TRENDING_BATCH_LIST = "trending-batch-list",

  SINGLE_SIDEBAR = "single-sidebar",

  SINGLE_BATCH_LIST = "single-batch-list",

  BATCH_SIDEBAR = "batch-sidebar",

  BATCH_BATCH_LIST = "batch-batch-list",

  APP_SIDEBAR = "app-sidebar",

  ELEMENT_SIDEBAR = "element-sidebar",

  ELEMENT_BATCH_LIST = "element-batch-list",

  ELEMENT_IMAGES_TO_VIDEO_BATCH_LIST = "element-images-to-video-batch-list",

  ELEMENT_VIDEO_TO_VIDEO_BATCH_LIST = "element-video-to-video-batch-list",

  REVIEW_SIDEBAR = "review-sidebar",

  REVIEW_BATCH_LIST = "review-batch-list",

  STORYBOARD_SIDEBAR = "storyboard-sidebar",
  STORYBOARD_BATCH_LIST = "storyboard-batch-list",
  CHATBOT_SIDEBAR = "chatbot-sidebar",
}



export function hasSeenIntroGuide(key: IntroGuideKey | string): boolean {

  try {

    if (typeof window === "undefined") return true;

    return localStorage.getItem(`${STORAGE_PREFIX}${key}`) === "1";

  } catch {

    return true;

  }

}



export function markIntroGuideSeen(key: IntroGuideKey | string): void {

  try {

    if (typeof window === "undefined") return;

    localStorage.setItem(`${STORAGE_PREFIX}${key}`, "1");

  } catch {

    // ignore quota / private mode

  }

}

