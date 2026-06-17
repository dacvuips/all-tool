import { CopyVideoScene, ElementFormConfig, ElementFormImage } from "../../constants";
import { ActionImageEnum } from "../constants";
import { getArtStyleImages, getOrderedElementImages } from "./elementFormImageUtils";
import type { ElementImageSlotKey } from "./matchElementImagesInPrompt";

export function resolveActionImageType(
  config?: Pick<ElementFormConfig, "actionImageType">
): ActionImageEnum {
  return config?.actionImageType ?? ActionImageEnum.auto;
}

/** Config ảnh chỉ dùng cho chế độ auto (match tên trong prompt). */
export function pickAutoModeElementImageConfig(
  config?: ElementFormConfig
): Pick<ElementFormConfig, ElementImageSlotKey> | undefined {
  if (!config) return undefined;
  return {
    artStyleImg: config.artStyleImg,
    objectImg: config.objectImg,
    itemImg: config.itemImg,
  };
}

export function sequentialImagesFingerprint(
  groups?: (ElementFormImage[] | undefined)[]
): string {
  return (
    groups
      ?.map((group, groupIndex) =>
        (group ?? [])
          .map(
            (img) =>
              `${groupIndex}:${img.name ?? ""}:${img.imageBytes?.length ?? 0}:${(img.fifeUrl || "").slice(0, 24)}`
          )
          .join(",")
      )
      .join("|") ?? ""
  );
}

export function autoModeImagesFingerprint(config?: ElementFormConfig): string {
  if (!config) return "";
  return getOrderedElementImages(pickAutoModeElementImageConfig(config))
    .map((img) => `${img.name ?? ""}:${img.imageBytes?.length ?? 0}:${(img.fifeUrl || "").slice(0, 24)}`)
    .join("|");
}

export function sceneImageSlotsMatchActionMode(
  scene: Pick<CopyVideoScene, "elementImageSlotsActionMode">,
  actionImageType?: ActionImageEnum
): boolean {
  return scene.elementImageSlotsActionMode === resolveActionImageType({ actionImageType });
}

export function pickSceneSavedImageSlots(
  scene: Pick<CopyVideoScene, "elementImageSlots" | "elementImageSlotsActionMode">,
  actionImageType?: ActionImageEnum
): (ElementFormImage | undefined)[] | undefined {
  if (!sceneImageSlotsMatchActionMode(scene, actionImageType)) return undefined;
  return scene.elementImageSlots;
}

/** Chỉ đọc nhóm ảnh tuần tự — không lẫn artStyleImg auto. */
export function getSequentialArtStyleImageGroups(
  config?: Pick<ElementFormConfig, "artStyleImgSequential">
): (ElementFormImage[] | undefined)[] {
  return config?.artStyleImgSequential ?? [];
}

/** Chỉ đọc ảnh auto — không lẫn artStyleImgSequential. */
export function getAutoModeArtStyleImages(config?: ElementFormConfig): ElementFormImage[] {
  return getArtStyleImages(pickAutoModeElementImageConfig(config));
}
