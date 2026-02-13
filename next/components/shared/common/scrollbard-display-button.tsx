import { ReactNode, useEffect, useRef, useState } from "react";
import { RiArrowLeftSLine, RiArrowRightSLine } from "react-icons/ri";
import { Button } from "../utilities/form";

export const ScrollbarWidthDisplayButton = ({ children }: { children: ReactNode }) => {
  const containerRef = useRef(null);
  const [hasScrollbar, setHasScrollbar] = useState(false);

  const checkScrollbar = () => {
    const element = containerRef.current;
    if (element) {
      // Kiểm tra chiều cao và chiều rộng
      const hasVerticalScrollbar = element.scrollHeight > element.clientHeight;
      const hasHorizontalScrollbar = element.scrollWidth > element.clientWidth;

      setHasScrollbar(hasVerticalScrollbar || hasHorizontalScrollbar);
    }
  };

  useEffect(() => {
    checkScrollbar();

    // Theo dõi khi window resize
    window.addEventListener("resize", checkScrollbar);

    return () => {
      window.removeEventListener("resize", checkScrollbar);
    };
  }, []);

  const scrollLeft = () => {
    if (containerRef.current) {
      containerRef.current.scrollBy({ left: -100, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (containerRef.current) {
      containerRef.current.scrollBy({ left: 100, behavior: "smooth" });
    }
  };

  return (
    <div className="relative hidden-scrollbar">
      <div ref={containerRef} className={`hidden-scrollbar pb-0.5 ${hasScrollbar ? "mx-4" : ""}`}>
        {hasScrollbar && (
          <Button
            icon={<RiArrowLeftSLine />}
            iconClassName="text-2xl"
            style={{
              boxShadow: "4px 0 8px -1px rgba(0, 0, 0, 0.1), 2px 0 6px -1px rgba(0, 0, 0, 0.06)",
            }}
            className={`absolute left-0 z-10 h-full px-0 transition-opacity bg-white border-r border-gray-100 rounded-none shadow-xl w-5`}
            onClick={() => {
              scrollLeft();
            }}
          />
        )}
        {hasScrollbar && (
          <Button
            icon={<RiArrowRightSLine />}
            iconClassName="text-2xl"
            style={{
              boxShadow: "-4px 0 8px -1px rgba(0, 0, 0, 0.1), -2px 0 6px -1px rgba(0, 0, 0, 0.06)",
            }}
            className={`absolute right-0 z-10 h-full px-0 bg-white border-l border-gray-100 rounded-none shadow-xl w-5`}
            onClick={() => {
              scrollRight();
            }}
          />
        )}
        {children}
      </div>
    </div>
  );
};
