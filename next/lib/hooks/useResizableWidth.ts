import { useCallback, useEffect, useRef, useState } from "react";

type UseResizableWidthOptions = {
  storageKey?: string;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  enabled?: boolean;
};

export function useResizableWidth({
  storageKey,
  defaultWidth = 320,
  minWidth = 260,
  maxWidth = 560,
  enabled = true,
}: UseResizableWidthOptions = {}) {
  const [width, setWidth] = useState(defaultWidth);
  const [isWidthReady, setIsWidthReady] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const widthRef = useRef(width);
  widthRef.current = width;

  useEffect(() => {
    if (!storageKey) {
      setIsWidthReady(true);
      return;
    }
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const n = parseInt(stored, 10);
      if (!Number.isNaN(n)) {
        setWidth(Math.min(maxWidth, Math.max(minWidth, n)));
      }
    }
    setIsWidthReady(true);
  }, [storageKey, minWidth, maxWidth]);

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) return;
      e.preventDefault();
      setIsResizing(true);
    },
    [enabled]
  );

  useEffect(() => {
    if (!isResizing) return;

    const onMove = (e: MouseEvent) => {
      setWidth(Math.min(maxWidth, Math.max(minWidth, e.clientX)));
    };
    const onUp = () => {
      setIsResizing(false);
      if (storageKey) {
        localStorage.setItem(storageKey, String(widthRef.current));
      }
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, minWidth, maxWidth, storageKey]);

  return { width, isResizing, isWidthReady, onResizeStart };
}
