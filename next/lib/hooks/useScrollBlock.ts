import { useEffect } from "react";

export function useScrollBlock(
  { rootId, dependencies }: { rootId?: string; dependencies?: any[] } = {
    rootId: "",
    dependencies: [],
  }
) {
  useEffect(() => {
    if (dependencies.filter(Boolean).length < dependencies.length) {
      return;
    }

    let html = document.querySelector("html");
    let scrollTop = html.scrollTop;
    let timeout;
    let count = 0;
    const checkScroll = () => {
      if (count > 10) return;
      scrollTop = html.scrollTop;
      if (html.scrollHeight > window.innerHeight) {
        html.style.top = `-${scrollTop}px`;
        html.classList.add("scroll-block");
      } else {
        timeout = setTimeout(() => checkScroll(), 500);
      }
      count++;
    };
    checkScroll();

    return () => {
      if (rootId && document.getElementById(rootId).childElementCount) return;
      clearTimeout(timeout);
      html.classList.remove("scroll-block");
      html.style.removeProperty("top");
      html.scroll(0, scrollTop);
    };
  }, dependencies);
}
