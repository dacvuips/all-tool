import React, { ReactNode, useEffect, useRef, useState } from "react";
import { RiArrowDownSFill } from "react-icons/ri";
export interface AccordionGroupProps {
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  icon?: ReactNode;
  className?: string;
  hasError?: boolean;
}

export interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline";
}

export const AccordionGroup: React.FC<AccordionGroupProps> = ({
  title,
  description,
  children,
  defaultOpen = false,
  icon,
  className = "",
  hasError = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // Initial style setup based on defaultOpen
  const [initialStyle] = useState(() => ({
    maxHeight: defaultOpen ? "none" : "0px",
    opacity: defaultOpen ? 1 : 0,
  }));

  // Ensure isOpen matches defaultOpen on mount
  useEffect(() => {
    if (isFirstRender.current) {
      setIsOpen(defaultOpen);
    }
  }, [defaultOpen]);

  useEffect(() => {
    // Skip the animation logic on first render to respect defaultOpen state immediately
    if (isFirstRender.current) {
      isFirstRender.current = false;
      // Ensure content style matches defaultOpen state on first render
      const content = contentRef.current;
      if (content) {
        if (defaultOpen) {
          content.style.maxHeight = "none";
          content.style.opacity = "1";
        } else {
          content.style.maxHeight = "0px";
          content.style.opacity = "0";
        }
      }
      return;
    }

    const content = contentRef.current;
    if (!content) return;

    if (isOpen) {
      // Opening animation
      // 1. Set height to current scrollHeight to start transition
      content.style.maxHeight = `${content.scrollHeight}px`;
      content.style.opacity = "1";

      // 2. After transition, set to 'none' (auto) so content can be dynamic
      const timer = setTimeout(() => {
        if (isOpen) {
          // Double check state hasn't changed
          content.style.maxHeight = "none";
        }
      }, 300); // Duration matches CSS transition
      return () => clearTimeout(timer);
    } else {
      // Closing animation
      // When closing, the handleToggle function has already set maxHeight to the explicit pixel value
      // and forced a reflow. Now we can safely transition to 0px.
      // The browser will animate from the pixel value set in handleToggle to 0px
      content.style.maxHeight = "0px";
      content.style.opacity = "0";
    }
  }, [isOpen]);

  const handleToggle = () => {
    const content = contentRef.current;
    const container = containerRef.current;
    if (!content) return;

    // Use functional update to always get the latest state value
    setIsOpen((prevIsOpen) => {
      const newIsOpen = !prevIsOpen;

      if (!prevIsOpen) {
        // PREPARE FOR OPENING:
        // State update triggers the effect which handles 0 -> scrollHeight

        // Scroll to show the opened content after a small delay
        // This ensures the animation has started and content is visible
        setTimeout(() => {
          if (container) {
            container.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
            });
          }
        }, 100);
      } else {
        // PREPARE FOR CLOSING:
        // We are currently at 'height: auto' or 'none'.
        // Get the actual height first - this should work even if maxHeight is 'none'
        const currentHeight = content.scrollHeight;

        // If we got a valid height, proceed with closing animation
        if (currentHeight > 0) {
          // Set explicit pixel height so we can transition from it
          content.style.maxHeight = `${currentHeight}px`;

          // Force a browser reflow to register the start height
          // This must happen synchronously before state update triggers useEffect
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          content.offsetHeight;
        }
      }

      return newIsOpen;
    });
  };

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden w-full bg-white rounded-lg border ${
        hasError ? "border-red-500" : "border-gray-200"
      } shadow-sm transition-all duration-200 hover:shadow-md ${className}`}
    >
      <button
        type="button"
        onClick={handleToggle}
        className="flex justify-between items-center p-1.5 w-full text-left bg-gray-50 transition-colors duration-200 hover:bg-gray-100    "
        aria-expanded={isOpen}
      >
        <div className="flex gap-3 items-center">
          {icon && <div className="flex-shrink-0 text-indigo-600">{icon}</div>}
          <div>
            <h3 className="text-base font-semibold text-primary">{title}</h3>
            {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
          </div>
        </div>

        <div
          className={`transform transition-transform duration-300 ease-in-out flex-shrink-0 ${
            isOpen ? "rotate-180" : "rotate-0"
          }`}
        >
          <RiArrowDownSFill className="text-gray-500 text-24" />
        </div>
      </button>

      <div
        ref={contentRef}
        className="overflow-hidden bg-white transition-all duration-300 ease-in-out"
        style={initialStyle}
      >
        <div className="p-5 space-y-4 border-t border-gray-100">{children}</div>
      </div>
    </div>
  );
};
