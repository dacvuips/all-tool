import { ElementFormConfig, ElementFormImage } from "../../constants";
import { ActionImageEnum } from "../constants";
import { elementImageSlotsToUrls } from "./matchElementImagesInPrompt";
import {
  ElementImageSlotsChangeHandler,
  resolveSlotsFromCatalog,
  stripSlotsForPersist,
} from "./elementImageSlotPersist";

type IndexedDBLike = { set: (key: IDBValidKey, value: unknown) => Promise<void> };

export function createElementImageSlotsChangeHandler(options: {
  sceneId: string;
  elementFormConfig?: ElementFormConfig;
  actionImageType?: ActionImageEnum;
  setSelectedElementImageSlots: (slots: (ElementFormImage | undefined)[]) => void;
  setSelectedProductImages: (urls: string[]) => void;
  selectedProductImagesDB: IndexedDBLike;
  onUpdateSelectedProductImages?: (sceneId: string, images: string[]) => void;
  onUpdateElementImageSlots?: (
    sceneId: string,
    slots: (ElementFormImage | undefined)[],
    imageUrls: string[],
    actionMode?: ActionImageEnum
  ) => void;
  /** Tuỳ tab: element luôn gửi actionMode; images-to-video chỉ khi sequential */
  resolvePersistActionMode?: (actionImageType: ActionImageEnum) => ActionImageEnum | undefined;
}): ElementImageSlotsChangeHandler {
  return (slots, meta) => {
    // Auto-match chỉ sync nội bộ row — không đẩy parent (tránh loop persist nhẹ ↔ resolve catalog).
    if (meta?.persist === false) return;

    const resolved = resolveSlotsFromCatalog(slots, options.elementFormConfig);
    const urls = elementImageSlotsToUrls(resolved);

    options.setSelectedElementImageSlots(resolved);
    options.setSelectedProductImages(urls);

    const lightSlots = stripSlotsForPersist(slots, options.elementFormConfig);
    const actionMode = options.actionImageType
      ? options.resolvePersistActionMode?.(options.actionImageType) ?? options.actionImageType
      : undefined;

    void options.selectedProductImagesDB.set(options.sceneId, urls);
    options.onUpdateSelectedProductImages?.(options.sceneId, urls);
    options.onUpdateElementImageSlots?.(options.sceneId, lightSlots, urls, actionMode);
  };
}
