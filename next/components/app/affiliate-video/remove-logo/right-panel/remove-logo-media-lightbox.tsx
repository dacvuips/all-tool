/**
 * Lightbox zoom ảnh/video — căn giữa viewport (tránh ImageDialog lệch trái)
 */
import { createPortal } from "react-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { RiCloseLine } from "react-icons/ri";

type Props = {
  open: boolean;
  onClose: () => void;
  kind: "image" | "video";
  src: string;
  title?: string;
};

export function RemoveLogoMediaLightbox({ open, onClose, kind, src, title }: Props) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const root = document.getElementById("dialog-root") || document.body;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 200, backgroundColor: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title || t("Xem trước")}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute flex items-center justify-center w-10 h-10 text-white bg-black border-0 rounded-full cursor-pointer"
        style={{ top: 16, right: 16, zIndex: 2, backgroundColor: "rgba(0,0,0,0.6)" }}
        title={t("Đóng")}
      >
        <RiCloseLine className="text-2xl text-white" />
      </button>

      <div
        className="flex items-center justify-center"
        style={{
          width: "100%",
          maxWidth: "90vw",
          maxHeight: "85vh",
          padding: 16,
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {kind === "video" ? (
          <video
            src={src}
            controls
            autoPlay
            playsInline
            className="bg-black rounded-xl"
            style={{
              display: "block",
              margin: "0 auto",
              maxWidth: "100%",
              maxHeight: "85vh",
              width: "auto",
              height: "auto",
              objectFit: "contain",
            }}
          />
        ) : (
          <img
            src={src}
            alt={title || ""}
            className="rounded-xl"
            style={{
              display: "block",
              margin: "0 auto",
              maxWidth: "100%",
              maxHeight: "85vh",
              width: "auto",
              height: "auto",
              objectFit: "contain",
            }}
          />
        )}
      </div>
    </div>,
    root
  );
}
