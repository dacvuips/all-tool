/**
 * Client thuần — POST /api/app/clean-watermark/ (không phụ thuộc React hook).
 */
import { toDataUrl } from "../constants";
import type {
  CleanWatermarkRequestItem,
  CleanWatermarkResponse,
} from "./useRemoveLogoApi";

export async function requestCleanWatermark(
  items: CleanWatermarkRequestItem[]
): Promise<CleanWatermarkResponse> {
  const payload = {
    items: items.map((item) => ({
      clientId: item.clientId,
      kind: item.kind,
      mediaBase64: toDataUrl(item.mediaBase64, item.mimeType),
      mimeType: item.mimeType,
      name: item.name,
    })),
    returnMode: "both" as const,
  };

  const resp = await fetch("/api/app/clean-watermark/", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await resp.json().catch(() => ({}))) as CleanWatermarkResponse;

  if (!resp.ok) {
    throw new Error(data?.message || `Lỗi xóa watermark (${resp.status})`);
  }

  return data;
}
