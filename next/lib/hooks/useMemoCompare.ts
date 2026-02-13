import isEqual from "lodash/isEqual";
import { useEffect, useRef } from "react";

export function useMemoCompare(next, compare = isEqual) {
  // Ref for storing previous value
  const previousRef = useRef();
  const previous = previousRef.current;
  // Pass previous and next value to compare function
  // to determine whether to consider them equal.
  const isSame = compare(previous, next);
  // If not equal update previousRef to next value.
  // We only update if not equal so that this hook continues to return
  // the same old value if compare keeps returning true.
  useEffect(() => {
    if (!isSame) {
      previousRef.current = next;
    }
  });
  // Finally, if equal then return the previous value
  return isSame ? previous : next;
}
