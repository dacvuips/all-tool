import { useState, useRef } from "react";
import { Img } from "../../../shared/utilities/misc";
import { ImageDialog } from "../../../shared/utilities/dialog/image-dialog";
import { useScreen } from "../../../../lib/hooks/useScreen";

interface ProductImageZoomProps {
  src: string;
  alt?: string;
  className?: string;
}

export function ProductImageZoom({ src, alt = "", className = "" }: ProductImageZoomProps) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });
  const [showFullImage, setShowFullImage] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);
  const isDesktop = useScreen("md");

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current || !isDesktop) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setZoomPosition({ 
      x: Math.max(0, Math.min(100, x)), 
      y: Math.max(0, Math.min(100, y)) 
    });
  };

  const handleMouseEnter = () => {
    if (isDesktop) {
      setIsZoomed(true);
    }
  };

  const handleMouseLeave = () => {
    setIsZoomed(false);
  };

  const handleClick = () => {
    setShowFullImage(true);
  };

  return (
    <>
      <div
        ref={imageRef}
        className={`relative overflow-hidden ${className}`}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        <div className="relative w-full h-full cursor-zoom-in">
          <Img
            src={src}
            alt={alt}
            className="w-full h-full"
            imageClassName="w-full h-full object-contain"
          />
        </div>

        {/* Zoom lens overlay - only on desktop */}
        {isZoomed && isDesktop && (
          <div
            className="absolute inset-0 pointer-events-none z-10"
            style={{
              backgroundImage: `url(${src})`,
              backgroundSize: "300%",
              backgroundPosition: `${zoomPosition.x}% ${zoomPosition.y}%`,
              backgroundRepeat: "no-repeat",
            }}
          />
        )}

        {/* Zoom indicator */}
        {isZoomed && isDesktop && (
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded pointer-events-none z-20">
            Click để xem ảnh lớn
          </div>
        )}
      </div>

      <ImageDialog
        isOpen={showFullImage}
        image={src}
        onClose={() => {
          setShowFullImage(false);
        }}
        imageDialogClassName="max-w-6xl"
      />
    </>
  );
}

