/**
 * Lazy mount scene card — mount lần đầu khi vào viewport, giữ mount để progress UI không mất.
 */
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const DEFAULT_MIN_HEIGHT = 300;
const ROOT_MARGIN = "320px 0px";

export interface LazySceneCardProps {
  sceneNumber?: number;
  minHeight?: number;
  children: React.ReactNode;
}

export function LazySceneCard({
  sceneNumber,
  minHeight = DEFAULT_MIN_HEIGHT,
  children,
}: LazySceneCardProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    if (hasMounted) return;
    const el = rootRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasMounted(true);
        }
      },
      { rootMargin: ROOT_MARGIN, threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMounted]);

  const showContent = hasMounted;

  return (
    <div
      ref={rootRef}
      className="h-full"
      style={{ minHeight: showContent ? undefined : minHeight }}
    >
      {showContent ? (
        children
      ) : (
        <div
          className="flex justify-center items-center h-full rounded-xl border border-gray-100 bg-gray-50/80"
          style={{ minHeight }}
        >
          <span className="text-xs font-medium text-gray-400">
            {sceneNumber != null ? `${t("Cảnh")} #${sceneNumber}` : t("Đang tải…")}
          </span>
        </div>
      )}
    </div>
  );
}
