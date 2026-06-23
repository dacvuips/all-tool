export type SceneCardIntroStep = {
  element: string;
  title: string;
  intro: string;
  position: "top" | "right" | "bottom" | "left" | "auto";
};

/** Các bước hướng dẫn intro.js cho từng nút trên thẻ cảnh (cảnh đầu tiên) */
export function getSceneCardIntroSteps(
  t: (key: string) => string,
  options?: { hasProductImages?: boolean; hasExtendTab?: boolean }
): SceneCardIntroStep[] {
  const steps: SceneCardIntroStep[] = [
    {
      element: "#scene-drag-handle",
      title: t("Kéo thả"),
      intro: t("Giữ và kéo nút này để đổi thứ tự cảnh trong danh sách."),
      position: "bottom",
    },
    {
      element: "#scene-toggle-disable",
      title: t("Ẩn / Hiện cảnh"),
      intro: t(
        "Ẩn cảnh khỏi batch tạo ảnh/video hàng loạt mà không xóa dữ liệu. Bấm lại để hiện cảnh."
      ),
      position: "bottom",
    },
    {
      element: "#scene-toggle-download",
      title: t("Tải tự động"),
      intro: t("Bật/tắt tự động tải file sau khi tạo xong cho riêng cảnh này."),
      position: "bottom",
    },
    {
      element: "#scene-toggle-notext",
      title: t("Chữ overlay"),
      intro: t("Bật/tắt hiển thị chữ/text trên ảnh và video cho riêng cảnh này."),
      position: "bottom",
    },
    {
      element: "#scene-toggle-voice",
      title: t("Thoại"),
      intro: t("Bật/tắt lời thoại (voiceover) cho riêng cảnh này."),
      position: "bottom",
    },
  ];

  if (options?.hasProductImages) {
    steps.push({
      element: "#scene-product-images",
      title: t("Ảnh sản phẩm"),
      intro: t(
        "Chọn ảnh SP đã upload ở sidebar để gắn vào ảnh/video cảnh này. Có thể nhập Prompt SP tùy chỉnh bên dưới."
      ),
      position: "bottom",
    });
  }

  steps.push(
    {
      element: "#scene-tab-image",
      title: t("Tab Ảnh"),
      intro: t("Xem thumbnail gốc từ video, tạo ảnh AI và chỉnh IMAGE PROMPT cho cảnh."),
      position: "bottom",
    },
    {
      element: "#scene-generate-image",
      title: t("Tạo ảnh"),
      intro: t(
        "Bấm để AI tạo ảnh theo IMAGE PROMPT. Sau khi có ảnh có thể tải xuống, tạo lại, upload hoặc chọn từ Gallery."
      ),
      position: "top",
    },
    {
      element: "#scene-visual-prompt",
      title: t("IMAGE PROMPT"),
      intro: t(
        "Hover lên prompt để xem đầy đủ, sao chép hoặc chỉnh sửa mô tả hình ảnh cho cảnh."
      ),
      position: "top",
    },
    {
      element: "#scene-tab-video",
      title: t("Tab Video"),
      intro: t("Chuyển sang tab Video để tạo video đơn từ ảnh đã có của cảnh."),
      position: "bottom",
    },
    {
      element: "#scene-generate-video",
      title: t("Tạo video đơn"),
      intro: t(
        "Tạo video từ ảnh đã generate. Cần có ảnh trước — bấm tab Video rồi bấm nút này."
      ),
      position: "top",
    }
  );

  if (options?.hasExtendTab) {
    steps.push({
      element: "#scene-tab-extend",
      title: t("Tab Video nối"),
      intro: t("Tạo video nối tiếp sang cảnh kế tiếp — dùng khi cần chuyển cảnh mượt mà."),
      position: "bottom",
    });
  }

  return steps;
}
