/**
 * Cột bảng MXH — header + row scene dùng chung width để căn thẳng hàng.
 */
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export type SceneBatchLayout = "card" | "row";

/** Gutter cây phân cấp (group → scene) */

/** Scene # + 3 ô ảnh (w-14) + gap — cố định để không tràn sang cột prompt */
export const COL_REF = "w-56 shrink-0";
export const COL_PROMPT = "flex-1 min-w-56";
export const COL_MEDIA = "w-44 shrink-0";
export const COL_ACTIONS = "w-40 shrink-0";

/** Bảng scene MXH — scroll ngang khi viewport hẹp hơn giá trị này. */
export const AUTO_POST_SCENE_TABLE_MIN_WIDTH_CLASS = "min-w-screen-xl";

const HEADER_CELL = "text-10 font-semibold uppercase tracking-wider text-gray-500";

export function AutoPostSocialSceneTableHeader() {
  const { t } = useTranslation();
  return (
    <div
      className={`sticky top-0 z-20 flex flex-row flex-nowrap items-center gap-3 px-3 py-2.5 bg-gray-50 border-b border-gray-200 shadow-sm ${AUTO_POST_SCENE_TABLE_MIN_WIDTH_CLASS}`}
    >
      <div className={`${COL_REF} ${HEADER_CELL}`}>{t("Ảnh tham chiếu")}</div>
      <div className={`${COL_PROMPT} ${HEADER_CELL}`}>{t("Prompt")}</div>
      <div className="flex flex-row flex-nowrap gap-3 items-center ml-auto shrink-0">
        <div className={`text-left ${COL_MEDIA} ${HEADER_CELL}`}>{t("Ảnh")}</div>
        <div className={`text-left ${COL_MEDIA} ${HEADER_CELL}`}>{t("Video")}</div>
        <div className={`text-right ${COL_ACTIONS} ${HEADER_CELL}`}>{t("Tiện ích")}</div>
      </div>
    </div>
  );
}

export function AutoPostSocialSceneTableRow({
  isDisabled = false,
  isHovered = false,
  onMouseEnter,
  onMouseLeave,
  reference,
  prompt,
  image,
  video,
  actions,
  isLastInGroup = false,
}: {
  isDisabled?: boolean;
  isHovered?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  reference: ReactNode;
  prompt: ReactNode;
  image: ReactNode;
  video: ReactNode;
  actions: ReactNode;
  isLastInGroup?: boolean;
}) {
  return (
    <div
      className={`flex flex-row flex-nowrap items-start gap-3 px-3 py-2.5 transition-colors ${AUTO_POST_SCENE_TABLE_MIN_WIDTH_CLASS} ${
        isLastInGroup ? "border-b border-gray-200" : "border-b border-gray-100"
      } ${isDisabled ? "opacity-50" : ""} bg-white hover:bg-gray-50`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className={`${COL_REF} ${isDisabled ? "pointer-events-none" : ""}`}>{reference}</div>
      <div className={`${COL_PROMPT} ${isDisabled ? "opacity-40 pointer-events-none" : ""}`}>
        {prompt}
      </div>
      <div className="flex flex-row flex-nowrap gap-3 items-start ml-auto shrink-0">
        <div
          className={`${COL_MEDIA} flex justify-start items-start ${
            isDisabled ? "pointer-events-none" : ""
          }`}
        >
          {image}
        </div>
        <div
          className={`${COL_MEDIA} flex flex-col justify-start items-start ${
            isDisabled ? "pointer-events-none" : ""
          }`}
        >
          {video}
        </div>
        <div
          className={`flex flex-row flex-nowrap gap-1 justify-end items-center self-center ${COL_ACTIONS}`}
        >
          {actions}
        </div>
      </div>
    </div>
  );
}
