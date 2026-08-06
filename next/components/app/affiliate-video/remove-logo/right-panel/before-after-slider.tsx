/**
 * Slider so sánh Before / After kiểu Erasio
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiArrowLeftSLine, RiArrowRightSLine } from "react-icons/ri";

type BeforeAfterSliderProps = {
  beforeSrc: string;
  afterSrc: string;
  alt?: string;
  className?: string;
};

export function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  alt = "",
  className = "",
}: BeforeAfterSliderProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);
  const [width, setWidth] = useState(0);
  const dragging = useRef(false);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth || 0);
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [beforeSrc, afterSrc]);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, pct)));
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      updateFromClientX(e.clientX);
    };
    const onUp = () => {
      dragging.current = false;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [updateFromClientX]);

  const hasMedia = !!(beforeSrc || afterSrc);

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden relative bg-purple-200 select-none touch-none ${className}`}
      onPointerDown={(e) => {
        if (!hasMedia) return;
        dragging.current = true;
        updateFromClientX(e.clientX);
      }}
    >
      {!hasMedia ? (
        <div className="flex absolute inset-0 justify-center items-center text-sm text-purple-500">
          {t("Không có dữ liệu ảnh")}
        </div>
      ) : (
        <>
          <img
            src={afterSrc || beforeSrc}
            alt={alt || "After"}
            className="block object-contain w-full h-full bg-black"
            draggable={false}
          />

          {beforeSrc && (
            <div
              className="overflow-hidden absolute inset-y-0 left-0 pointer-events-none"
              style={{ width: `${position}%`, zIndex: 1 }}
            >
              <img
                src={beforeSrc}
                alt={alt || "Before"}
                className="block object-contain bg-black"
                style={{
                  width: width > 0 ? `${width}px` : "100%",
                  height: "100%",
                  maxWidth: "none",
                }}
                draggable={false}
              />
            </div>
          )}

          <span className="absolute top-16 left-3 z-10 px-2.5 py-1 text-xs font-bold tracking-wider text-white rounded-full bg-gray-900">
            {t("TRƯỚC")}
          </span>
          <span className="absolute top-16 right-3 z-10 px-2.5 py-1 text-xs font-bold tracking-wider text-white rounded-full bg-primary">
            {t("SAU")}
          </span>

          {/* Divider + handle: căn giữa bằng left/top % + margin âm, không dùng transform trên text */}
          <div
            className="absolute top-0 bottom-0 z-20 pointer-events-none"
            style={{ left: `${position}%`, width: 2, marginLeft: -1, backgroundColor: "#fff" }}
          >
            <div
              className="flex absolute justify-center items-center bg-white rounded-full shadow-lg"
              style={{
                top: "50%",
                left: "50%",
                width: 36,
                height: 36,
                marginTop: -18,
                marginLeft: -18,
              }}
            >
              <span
                className="flex justify-center items-center text-primary"
                style={{ width: 24, height: 16, lineHeight: 0 }}
              >
                <RiArrowLeftSLine
                  className="flex-shrink-0 text-primary"
                  style={{ width: 14, height: 14, display: "block" }}
                />
                <RiArrowRightSLine
                  className="flex-shrink-0 text-primary"
                  style={{ width: 14, height: 14, display: "block", marginLeft: -4 }}
                />
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
