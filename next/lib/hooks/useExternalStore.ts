import { useEffect, useState } from "react";

/** Subscribe to external store — tương thích @types/react 17 (không có useSyncExternalStore). */
export function useExternalStore<T>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => T
): T {
  const [snapshot, setSnapshot] = useState(getSnapshot);

  useEffect(() => {
    const sync = () => setSnapshot(getSnapshot());
    sync();
    return subscribe(sync);
  }, [subscribe, getSnapshot]);

  return snapshot;
}
