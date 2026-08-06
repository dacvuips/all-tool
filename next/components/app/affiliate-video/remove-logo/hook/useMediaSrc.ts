/**
 * Convert base64 (+ optional http url fallback) → blob:/http URL for <img>/<video>.
 * Revoke blob URLs on change/unmount.
 */
import { useEffect, useState } from "react";
import { base64ToObjectUrl, toDataUrl } from "../constants";

export function useMediaSrc(
  base64: string | undefined | null,
  mimeType: string,
  fallbackUrl?: string | null
): string {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    const apply = (value: string) => {
      if (!cancelled) setSrc(value);
    };

    // Prefer decoded blob — more reliable than multi-MB data: URLs
    if (base64 && stripHasPayload(base64)) {
      objectUrl = base64ToObjectUrl(base64, mimeType);
      if (objectUrl) {
        apply(objectUrl);
        return () => {
          cancelled = true;
          if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
      }
      const dataUrl = toDataUrl(base64, mimeType);
      if (dataUrl) {
        apply(dataUrl);
        return () => {
          cancelled = true;
        };
      }
    }

    if (fallbackUrl && /^https?:\/\//i.test(fallbackUrl)) {
      apply(fallbackUrl);
    } else {
      apply("");
    }

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [base64, mimeType, fallbackUrl]);

  return src;
}

function stripHasPayload(raw: string): boolean {
  return raw.replace(/\s/g, "").length > 32;
}
