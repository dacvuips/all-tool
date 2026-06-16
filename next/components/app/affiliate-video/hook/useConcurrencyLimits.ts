import { useAuth } from "../../../../lib/providers/auth-provider";

export const DEFAULT_IMAGE_CONCURRENCY = 1;
export const DEFAULT_VIDEO_CONCURRENCY = 1;

/**
 * Trả về giới hạn concurrency cho image/video generation
 * dựa trên plan (googlePackage) của user hiện tại.
 * Khớp backend: `imageStreamCount ?? 1` / `videoStreamCount ?? 1`.
 */
export function useConcurrencyLimits() {
  const { customer } = useAuth();
  return {
    IMAGE_CONCURRENCY:
      customer?.googlePackage?.imageStreamCount ?? DEFAULT_IMAGE_CONCURRENCY,
    VIDEO_CONCURRENCY:
      customer?.googlePackage?.videoStreamCount ?? DEFAULT_VIDEO_CONCURRENCY,
  };
}
