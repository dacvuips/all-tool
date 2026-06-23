/** Các bước intro.js chỉ cho right panel (danh sách hàng loạt / batch list) */

import { getSceneCardIntroSteps } from "./scene-card-intro-steps";

export type AffiliateRightPanelIntroStep = {
  element: string;
  title: string;
  intro: string;
  position: "top" | "right" | "bottom" | "left" | "auto";
};

/** Toolbar header trong batch list panel */
export function getRightPanelToolbarIntroSteps(t: (key: string) => string): AffiliateRightPanelIntroStep[] {
  return [
    {
      element: "#batch-scene-count",
      title: t("Tổng số cảnh"),
      intro: t("Số lượng cảnh hiện có trong danh sách hàng loạt sau khi phân tích video."),
      position: "bottom",
    },
    {
      element: "#batch-global-tab-select",
      title: t("Tab xem toàn cục"),
      intro: t(
        "Chuyển nhanh tab Ảnh, Video hoặc Video nối trên tất cả thẻ cảnh cùng lúc thay vì từng thẻ một."
      ),
      position: "bottom",
    },
    {
      element: "#batch-toggle-all-download",
      title: t("Tải tự động"),
      intro: t(
        "Bật (xanh) để tự động tải file sau khi tạo ảnh/video xong. Tắt (xám) để không tải tự động — áp dụng cho tất cả cảnh."
      ),
      position: "bottom",
    },
    {
      element: "#batch-toggle-all-notext",
      title: t("Chữ overlay"),
      intro: t(
        "Bật (xanh) để cho phép hiển thị chữ/text trên ảnh và video. Tắt để ẩn chữ overlay trên tất cả cảnh."
      ),
      position: "bottom",
    },
    {
      element: "#batch-toggle-all-voice",
      title: t("Thoại / Voiceover"),
      intro: t(
        "Bật/tắt lời thoại (voiceover) cho tất cả cảnh. Tắt (đỏ) khi bạn chỉ cần video không có giọng nói."
      ),
      position: "bottom",
    },
  ];
}

export type AffiliateRightPanelIntroOptions = {
  hasProductImages?: boolean;
  sceneCount?: number;
  includeSceneCardSteps?: boolean;
};

/** Các bước intro cho right panel batch list */
export function getAffiliateRightPanelIntroSteps(
  t: (key: string) => string,
  options: AffiliateRightPanelIntroOptions = {}
) {
  const steps: AffiliateRightPanelIntroStep[] = [
    {
      element: "#batch-action-bar",
      title: t("Thanh thao tác hàng loạt"),
      intro: t(
        "Các nút tạo ảnh, video, tải xuống và xuất prompt/voice cho toàn bộ cảnh cùng lúc."
      ),
      position: "bottom",
    },
    {
      element: "#batch-create-img",
      title: t("Tạo ảnh hàng loạt"),
      intro: t(
        "Tạo ảnh AI cho tất cả cảnh chưa có ảnh. Số lượng cảnh chờ được hiển thị trong ngoặc (xN)."
      ),
      position: "bottom",
    },
    {
      element: "#batch-create-video",
      title: t("Tạo video hàng loạt"),
      intro: t("Tạo video từ ảnh đã có cho từng cảnh. Cần có ảnh trước khi tạo video."),
      position: "bottom",
    },
    ...getRightPanelToolbarIntroSteps(t),
    {
      element: "#batch-scene-grid",
      title: t("Danh sách cảnh"),
      intro: t(
        "Kéo thả để đổi thứ tự cảnh. Mỗi thẻ hiển thị prompt, ảnh/video đã tạo và các tùy chọn riêng."
      ),
      position: "top",
    },
  ];

  if (options.includeSceneCardSteps) {
    steps.push(
      ...getSceneCardIntroSteps(t, {
        hasProductImages: options.hasProductImages,
        hasExtendTab: (options.sceneCount ?? 0) > 1,
      })
    );
  }

  return steps;
}
