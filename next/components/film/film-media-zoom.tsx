import { useCallback, useEffect, useRef, useState } from "react";
import { RiCloseLine, RiZoomInLine, RiZoomOutLine } from "react-icons/ri";

export type FilmMediaZoomItem = {
  src: string;
  type?: "image" | "video";
};

type Props = {
  media: FilmMediaZoomItem | null;
  onClose: () => void;
};

/** Lightbox zoom cho ảnh / video trong module Film */
export default function FilmMediaZoom({ media, onClose }: Props) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!media) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
      return;
    }
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [media, onClose]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.min(8, Math.max(0.3, s - e.deltaY * 0.002)));
  }, []);

  if (!media?.src) return null;

  const type = media.type || "image";
  const zoomPercent = Math.round(scale * 100);

  return (
    <div
      className="fixed inset-0 z-500 flex items-center justify-center bg-black bg-opacity-80 cursor-zoom-out"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onMouseDown={(e) => {
        if (type === "video") return;
        dragging.current = true;
        lastPos.current = { x: e.clientX, y: e.clientY };
      }}
      onMouseMove={(e) => {
        if (!dragging.current || type === "video") return;
        setOffset((o) => ({
          x: o.x + e.clientX - lastPos.current.x,
          y: o.y + e.clientY - lastPos.current.y,
        }));
        lastPos.current = { x: e.clientX, y: e.clientY };
      }}
      onMouseUp={() => {
        dragging.current = false;
      }}
      onMouseLeave={() => {
        dragging.current = false;
      }}
      onWheel={onWheel}
      role="dialog"
      aria-modal="true"
    >
      {type === "video" ? (
        <video
          src={media.src}
          controls
          autoPlay
          className="rounded-2xl bg-black"
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: "88vw",
            maxHeight: "88vh",
            transform: `translate(${offset.x}px,${offset.y}px) scale(${scale})`,
          }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={media.src}
          draggable={false}
          alt=""
          className="rounded-2xl select-none object-contain cursor-grab"
          style={{
            maxWidth: "88vw",
            maxHeight: "88vh",
            transform: `translate(${offset.x}px,${offset.y}px) scale(${scale})`,
          }}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      <div
        className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-1 bg-gray-900 bg-opacity-75 rounded-2xl px-2 py-1.5 border border-white border-opacity-10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          title="Zoom out"
          onClick={() => setScale((s) => Math.max(0.3, s - 0.4))}
          className="w-9 h-9 rounded-xl text-white hover:bg-white hover:bg-opacity-20 cursor-pointer text-base flex items-center justify-center border-0 bg-transparent"
        >
          <RiZoomOutLine />
        </button>
        <span className="text-white text-opacity-60 text-xs font-medium min-w-10 text-center select-none tabular-nums">
          {zoomPercent}%
        </span>
        <button
          type="button"
          title="Zoom in"
          onClick={() => setScale((s) => Math.min(8, s + 0.4))}
          className="w-9 h-9 rounded-xl text-white hover:bg-white hover:bg-opacity-20 cursor-pointer text-base flex items-center justify-center border-0 bg-transparent"
        >
          <RiZoomInLine />
        </button>
        <div className="w-px h-5 bg-white bg-opacity-20 mx-1" />
        <button
          type="button"
          title="Reset"
          onClick={() => {
            setScale(1);
            setOffset({ x: 0, y: 0 });
          }}
          className="h-8 px-3 rounded-xl text-white text-xs hover:bg-white hover:bg-opacity-20 cursor-pointer flex items-center justify-center border-0 bg-transparent font-medium"
        >
          Reset
        </button>
        <div className="w-px h-5 bg-white bg-opacity-20 mx-1" />
        <button
          type="button"
          title="Close"
          onClick={onClose}
          className="w-9 h-9 rounded-xl text-white hover:bg-red-500 cursor-pointer text-lg flex items-center justify-center border-0 bg-transparent"
        >
          <RiCloseLine />
        </button>
      </div>
    </div>
  );
}
