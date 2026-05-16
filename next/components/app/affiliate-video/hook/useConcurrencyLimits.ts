import { useAuth } from "../../../../lib/providers/auth-provider";

export const DEFAULT_IMAGE_CONCURRENCY = 2;
export const DEFAULT_VIDEO_CONCURRENCY = 2;

/**
 * Trả về giới hạn concurrency cho image/video generation
 * dựa trên plan (googlePackage) của user hiện tại.
 * Fallback về DEFAULT_* nếu chưa có thông tin plan.
 */
export function useConcurrencyLimits() {
  const { customer } = useAuth();
  return {
    IMAGE_CONCURRENCY:
      customer?.googlePackage?.imageStreamCount || DEFAULT_IMAGE_CONCURRENCY,
    VIDEO_CONCURRENCY:
      customer?.googlePackage?.videoStreamCount || DEFAULT_VIDEO_CONCURRENCY,
  };
}
