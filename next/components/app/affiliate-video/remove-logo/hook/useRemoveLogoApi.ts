/**
 * API client — POST /api/app/clean-watermark/
 */
import { useCallback } from "react";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { RemoveLogoMediaKind } from "../constants";
import { requestCleanWatermark } from "./cleanWatermarkClient";

export type CleanWatermarkRequestItem = {
  clientId: string;
  kind: RemoveLogoMediaKind;
  mediaBase64: string;
  mimeType: string;
  name: string;
};

export type CleanWatermarkProcessed = {
  clientId?: string;
  name?: string;
  success: true;
  kind: RemoveLogoMediaKind;
  mimeType: string;
  mediaBase64: string;
  url?: string;
  requestId?: string;
  elapsedSeconds?: number;
  originalByteLength: number;
};

export type CleanWatermarkSkipped = {
  clientId?: string;
  name?: string;
  kind: RemoveLogoMediaKind;
  success: false;
  reason: string;
  code: "QUOTA_EXCEEDED" | "VALIDATION" | "API_ERROR";
};

export type CleanWatermarkResponse = {
  success: boolean;
  processed: CleanWatermarkProcessed[];
  skipped: CleanWatermarkSkipped[];
  summary: {
    total: number;
    successCount: number;
    skippedCount: number;
    imagesUsed: number;
    videosUsed: number;
    imageQuotaExceeded: number;
    videoQuotaExceeded: number;
  };
  quota?: {
    imageCount: number;
    imageLimit: number;
    imageRemaining: number;
    videoCount: number;
    videoLimit: number;
    videoRemaining: number;
  };
  message?: string;
};

export function useRemoveLogoApi() {
  const { loadCustomer } = useAuth();

  const cleanWatermark = useCallback(
    async (
      items: CleanWatermarkRequestItem[],
      options?: { refreshCustomer?: boolean }
    ): Promise<CleanWatermarkResponse> => {
      const data = await requestCleanWatermark(items);

      // Chỉ refresh gói sau từng file khi gọi 1 item (tránh gọi quá nhiều)
      if (options?.refreshCustomer !== false && items.length === 1) {
        try {
          await loadCustomer?.();
        } catch {
          // ignore
        }
      } else if (options?.refreshCustomer) {
        try {
          await loadCustomer?.();
        } catch {
          // ignore
        }
      }

      return data;
    },
    [loadCustomer]
  );

  return { cleanWatermark };
}
