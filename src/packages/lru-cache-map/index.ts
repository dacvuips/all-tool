import LRUMap from "pixl-cache";

export function LRUCacheMap({ maxItems = 10000, maxAge = 10 } = {}) {
  return new LRUMap({ maxItems, maxAge });
}
