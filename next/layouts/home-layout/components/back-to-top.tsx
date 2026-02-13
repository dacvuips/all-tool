import { useEffect, useState } from "react";
import { HiArrowUp } from "react-icons/hi";
import { useScreen } from "../../../lib/hooks/useScreen";

type Props = {};

export function BackToTop({ ...props }) {
  const [isVisible, setIsVisible] = useState(false);
  const isLg = useScreen("lg");

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.pageYOffset > 1000) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };
    window.addEventListener("scroll", toggleVisibility);
    return () => {
      window.removeEventListener("scroll", toggleVisibility);
    };
  }, []);

  return (
    <>
      {isVisible && (
        <div
          className={`fixed w-9 h-9 rounded-full shadow-xl cursor-pointer flex-center z-50 bottom-28 right-6 animate-emerge-up bg-primary hover:bg-primary-dark`}
          onClick={() => scrollToTop()}
        >
          <HiArrowUp className="mr-0 font-semibold text-white text-24" />
        </div>
      )}
    </>
  );
}
