/** Logger nhẹ cho scrape-agent bundle (không kéo winston/config). */
const logger = {
  debug: (...args: unknown[]) => console.debug("[scrape-agent]", ...args),
  info: (...args: unknown[]) => console.log("[scrape-agent]", ...args),
  warn: (...args: unknown[]) => console.warn("[scrape-agent]", ...args),
  error: (...args: unknown[]) => console.error("[scrape-agent]", ...args),
};

export default logger;
