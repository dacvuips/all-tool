/**
 * Scroll + highlight card production khi mở từ Gắn NV/VP/Cảnh trên storyboard.
 */
import { useEffect, useRef } from "react";

export function filmEntityCardDomId(entityId: string): string {
  return `film-entity-card-${entityId}`;
}

/**
 * Sau khi đổi step → tìm card theo id, scroll tới giữa viewport, flash ring ngắn.
 * Gọi onConsumed khi xong (hoặc timeout) để parent clear focus.
 */
export function useFilmEntityCardFocus(
  focusEntityId: string | null | undefined,
  onConsumed?: () => void
) {
  const onConsumedRef = useRef(onConsumed);
  onConsumedRef.current = onConsumed;

  useEffect(() => {
    const entityId = (focusEntityId || "").trim();
    if (!entityId) return;

    let cancelled = false;
    let clearHighlight: ReturnType<typeof setTimeout> | null = null;
    const domId = filmEntityCardDomId(entityId);

    const finish = () => {
      if (!cancelled) onConsumedRef.current?.();
    };

    const tryFocus = (attempt: number) => {
      if (cancelled) return;
      const el = document.getElementById(domId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        el.classList.add(
          "ring-2",
          "ring-blue-400",
          "ring-offset-2",
          "transition-shadow"
        );
        clearHighlight = setTimeout(() => {
          el.classList.remove(
            "ring-2",
            "ring-blue-400",
            "ring-offset-2",
            "transition-shadow"
          );
          finish();
        }, 2400);
        return;
      }
      if (attempt < 30) {
        setTimeout(() => tryFocus(attempt + 1), 60);
      } else {
        finish();
      }
    };

    // Đợi panel mount + layout grid
    const start = setTimeout(() => tryFocus(0), 100);
    return () => {
      cancelled = true;
      clearTimeout(start);
      if (clearHighlight) clearTimeout(clearHighlight);
    };
  }, [focusEntityId]);
}
