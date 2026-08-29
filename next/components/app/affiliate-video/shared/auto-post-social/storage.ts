import { AutoPostSocialSettings, createDefaultAutoPostSettings } from "./types";

/** Chỉ lưu preference UI (bật/tắt, đăng ngay). Credential OAuth lưu MongoDB qua GraphQL. */
const SETTINGS_KEY = "affiliate-auto-post-social-settings";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadAutoPostSettings(): AutoPostSocialSettings {
  if (typeof window === "undefined") return createDefaultAutoPostSettings();
  const parsed = safeParse(localStorage.getItem(SETTINGS_KEY), null as AutoPostSocialSettings | null);
  if (!parsed) return createDefaultAutoPostSettings();
  const defaults = createDefaultAutoPostSettings();
  return {
    enabled: !!parsed.enabled,
    platforms: {
      youtube: { ...defaults.platforms.youtube, ...(parsed.platforms?.youtube || {}) },
      facebook: { ...defaults.platforms.facebook, ...(parsed.platforms?.facebook || {}) },
      tiktok: { ...defaults.platforms.tiktok, ...(parsed.platforms?.tiktok || {}) },
    },
  };
}

export function saveAutoPostSettings(settings: AutoPostSocialSettings) {
  if (typeof window === "undefined") return;
  // Không persist credentialId nếu còn từ bản localStorage cũ
  const cleaned: AutoPostSocialSettings = {
    enabled: settings.enabled,
    platforms: {
      youtube: {
        enabled: !!settings.platforms.youtube.enabled,
        postImmediately: !!settings.platforms.youtube.postImmediately,
      },
      facebook: {
        enabled: !!settings.platforms.facebook.enabled,
        postImmediately: !!settings.platforms.facebook.postImmediately,
      },
      tiktok: {
        enabled: !!settings.platforms.tiktok.enabled,
        postImmediately: !!settings.platforms.tiktok.postImmediately,
      },
    },
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(cleaned));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("affiliate-auto-post-settings-changed"));
  }
}
