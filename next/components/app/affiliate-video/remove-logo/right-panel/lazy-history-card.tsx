/**
 * Lazy mount card lịch sử — chỉ render media khi gần viewport,
 * unmount khi ra xa để revoke blob URL & giảm tải DOM.
 */
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiImage2Line, RiVideoLine } from "react-icons/ri";
import type { RemoveLogoMediaKind } from "../constants";

const ROOT_MARGIN = "280px 0px";
const DEFAULT_MIN_HEIGHT = 360;

type Props = {
  kind: RemoveLogoMediaKind;
  name?: string;
  minHeight?: number;
  /** Scroll container (overflow parent) — bắt buộc khi list trong panel cuộn */
  scrollRoot?: HTMLElement | null;
  children: React.ReactNode;
};

export function LazyHistoryCard({
  kind,
  name,
  minHeight = DEFAULT_MIN_HEIGHT,
  scrollRoot,
  children,
}: Props) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    // Không có IO → mount luôn (SSR / browser cũ)
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
      },
      {
        root: scrollRoot ?? null,
        rootMargin: ROOT_MARGIN,
        threshold: 0,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollRoot]);

  return (
    <div
      ref={rootRef}
      className="w-full"
      style={{ maxWidth: 370, minHeight: visible ? undefined : minHeight }}
    >
      {visible ? (
        children
      ) : (
        <div
          className="flex flex-col justify-center items-center rounded-2xl border border-gray-200 bg-white shadow-sm"
          style={{ minHeight }}
        >
          <div className="flex justify-center items-center w-10 h-10 mb-2 rounded-full bg-primary-light text-primary">
            {kind === "video" ? (
              <RiVideoLine className="text-xl text-primary" />
            ) : (
              <RiImage2Line className="text-xl text-primary" />
            )}
          </div>
          <p className="px-4 text-xs font-medium text-center text-gray-400 truncate max-w-full">
            {name || (kind === "video" ? t("Video") : t("Ảnh"))}
          </p>
          <p className="mt-1 text-[11px] text-gray-300">{t("Cuộn để xem")}</p>
        </div>
      )}
    </div>
  );
}
