import { RefObject, useEffect, useRef, useState } from "react";

/**
 * Observes an element and flips to true once it enters the viewport (stays true).
 * Pass `root` when observing inside a scroll container (`overflow-auto`).
 */
export function useLazyInView<T extends Element>(
  rootMargin = "200px",
  root?: Element | null
): { ref: RefObject<T>; inView: boolean } {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return;
    const el = ref.current;
    if (!el) return;

    let cancelled = false;

    const markVisible = () => {
      if (!cancelled) setInView(true);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          markVisible();
          observer.disconnect();
        }
      },
      { root: root ?? null, rootMargin, threshold: 0 }
    );

    observer.observe(el);

    // Slide-out animation có thể bỏ lỡ lần intersect đầu — kiểm tra lại sau khi layout ổn định
    const retryId = window.setTimeout(() => {
      if (cancelled) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      if (!root) {
        if (rect.bottom > 0 && rect.top < window.innerHeight) markVisible();
        return;
      }

      const rootRect = root.getBoundingClientRect();
      if (
        rect.bottom > rootRect.top &&
        rect.top < rootRect.bottom &&
        rect.right > rootRect.left &&
        rect.left < rootRect.right
      ) {
        markVisible();
      }
    }, 350);

    return () => {
      cancelled = true;
      observer.disconnect();
      window.clearTimeout(retryId);
    };
  }, [inView, root, rootMargin]);

  return { ref, inView };
}
