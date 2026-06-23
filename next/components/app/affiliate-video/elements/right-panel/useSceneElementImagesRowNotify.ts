/**
 * Sync slots → parent: live update luôn; persist IndexedDB chỉ khi có chỉnh tay.
 */
import { useEffect, useRef } from "react";
import { ElementFormImage } from "../../constants";
import {
  ElementImageSlotsChangeHandler,
  elementImageSlotsFingerprint,
} from "../utils/elementImageSlotPersist";

export function useSceneElementImagesRowNotify(
  _sceneId: string,
  slots: (ElementFormImage | undefined)[],
  manualMask: boolean[],
  onSlotsChange: ElementImageSlotsChangeHandler
) {
  const lastLiveKeyRef = useRef("");
  const lastPersistKeyRef = useRef("");
  const manualMaskKey = manualMask.map(String).join(",");

  useEffect(() => {
    lastLiveKeyRef.current = "";
    lastPersistKeyRef.current = "";
  }, [_sceneId]);

  useEffect(() => {
    const key = elementImageSlotsFingerprint(slots);
    const shouldPersist = manualMask.some(Boolean);

    if (key !== lastLiveKeyRef.current) {
      lastLiveKeyRef.current = key;
      onSlotsChange(slots, { persist: false });
    }

    if (shouldPersist && key !== lastPersistKeyRef.current) {
      lastPersistKeyRef.current = key;
      onSlotsChange(slots, { persist: true });
    }
  }, [slots, manualMaskKey, onSlotsChange]);
}
