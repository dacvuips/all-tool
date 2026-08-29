import { AiProviderKeyEnum } from "../../../../../lib/repo/product/productApp.repo";

export type SocialPlatform = "youtube" | "facebook" | "tiktok";

export interface SocialCredentialState {
  id: string | null;
  active: boolean;
  loaded: boolean;
}

export interface PlatformAutoPostConfig {
  /** Bật đăng lên nền tảng này khi master switch ON */
  enabled: boolean;
  /** Đăng ngay khi xong từng phần; tắt = chờ xong hết rồi đăng hàng loạt */
  postImmediately: boolean;
}

export interface AutoPostSocialSettings {
  enabled: boolean;
  platforms: Record<SocialPlatform, PlatformAutoPostConfig>;
}

export const SOCIAL_PLATFORM_CREDENTIAL_KEY: Record<SocialPlatform, AiProviderKeyEnum> = {
  youtube: AiProviderKeyEnum.YOUTUBE_OAUTH_KEY,
  facebook: AiProviderKeyEnum.FACEBOOK_OAUTH_KEY,
  tiktok: AiProviderKeyEnum.TIKTOK_OAUTH_KEY,
};

export const SOCIAL_PLATFORMS: {
  id: SocialPlatform;
  label: string;
  credentialKey: AiProviderKeyEnum;
}[] = [
  {
    id: "youtube",
    label: "Youtube",
    credentialKey: AiProviderKeyEnum.YOUTUBE_OAUTH_KEY,
  },
  {
    id: "facebook",
    label: "Facebook",
    credentialKey: AiProviderKeyEnum.FACEBOOK_OAUTH_KEY,
  },
  {
    id: "tiktok",
    label: "Tiktok",
    credentialKey: AiProviderKeyEnum.TIKTOK_OAUTH_KEY,
  },
];

export function createDefaultPlatformConfig(): PlatformAutoPostConfig {
  return {
    enabled: true,
    postImmediately: false,
  };
}

export function createDefaultAutoPostSettings(): AutoPostSocialSettings {
  return {
    enabled: false,
    platforms: {
      youtube: createDefaultPlatformConfig(),
      facebook: createDefaultPlatformConfig(),
      tiktok: createDefaultPlatformConfig(),
    },
  };
}

export function createEmptyCredentialState(): SocialCredentialState {
  return { id: null, active: false, loaded: false };
}
