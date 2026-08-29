import { useEffect, useState } from "react";
import { loadSocialPostPublishedVideoPreviewUrl } from "./social-post-published-video-storage";

/** Load preview URL video đã đăng từ IndexedDB (theo videoStorageKey hoặc fallbackKey). */
export function useSocialPostPublishedVideoUrl(
  videoStorageKey: string | undefined,
  fallbackKey?: string
) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const resolvedKey = videoStorageKey || fallbackKey;

  useEffect(() => {
    if (!resolvedKey) {
      setUrl(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void loadSocialPostPublishedVideoPreviewUrl(resolvedKey).then((preview) => {
      if (!cancelled) {
        setUrl(preview);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [resolvedKey]);

  return { url, loading };
}
