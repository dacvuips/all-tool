import { useEffect, useState } from "react";

import { hasSeenIntroGuide } from "./intro-guide-storage";

const INTRO_GUIDE_SEEN_EVENT = "affiliate-intro-guide-seen";

/** Theo dõi trạng thái đã xem intro (cập nhật khi tour sidebar hoàn thành) */
export function useIntroGuideSeen(key: string | undefined): boolean {
  const [seen, setSeen] = useState(() => (key ? hasSeenIntroGuide(key) : true));

  useEffect(() => {
    if (!key) {
      setSeen(true);
      return;
    }

    setSeen(hasSeenIntroGuide(key));

    const onSeen = (event: Event) => {
      const detail = (event as CustomEvent<{ key: string }>).detail;
      if (detail?.key === key) {
        setSeen(true);
      }
    };

    window.addEventListener(INTRO_GUIDE_SEEN_EVENT, onSeen);
    return () => window.removeEventListener(INTRO_GUIDE_SEEN_EVENT, onSeen);
  }, [key]);

  return seen;
}

export function notifyIntroGuideSeen(key: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(INTRO_GUIDE_SEEN_EVENT, { detail: { key } }));
}
