import { getBatchListHeaderIntroSteps } from "./batch-list-header";
import { getSceneCardIntroSteps } from "./scene-card-intro-steps";

export type AffiliateBatchListIntroOptions = {
  hasHistory?: boolean;
  hasProductImages?: boolean;
  sceneCount?: number;
  includeSceneCardSteps?: boolean;
};

/** Các bước intro cho panel danh sách hàng loạt (dùng chung mọi tab affiliate-video) */
export function getAffiliateBatchListIntroSteps(
  t: (key: string) => string,
  options: AffiliateBatchListIntroOptions = {}
) {
  const headerSteps = getBatchListHeaderIntroSteps(t, {
    hasHistory: options.hasHistory,
  });
  const historySteps = headerSteps.filter((s) => s.element.startsWith("#batch-history"));
  const toolbarSteps = headerSteps.filter((s) => !s.element.startsWith("#batch-history"));

  const steps = [
    ...historySteps,
    {
      element: "#batch-action-bar",
      title: t("Thanh thao tác hàng loạt"),
      intro: t(
        "Các nút tạo ảnh, video, tải xuống và xuất prompt/voice cho toàn bộ cảnh cùng lúc."
      ),
      position: "bottom" as const,
    },
    {
      element: "#batch-create-img",
      title: t("Tạo ảnh hàng loạt"),
      intro: t(
        "Tạo ảnh AI cho tất cả cảnh chưa có ảnh. Số lượng cảnh chờ được hiển thị trong ngoặc (xN)."
      ),
      position: "bottom" as const,
    },
    {
      element: "#batch-create-video",
      title: t("Tạo video hàng loạt"),
      intro: t("Tạo video từ ảnh đã có cho từng cảnh. Cần có ảnh trước khi tạo video."),
      position: "bottom" as const,
    },
    ...toolbarSteps,
    {
      element: "#batch-scene-grid",
      title: t("Danh sách cảnh"),
      intro: t(
        "Kéo thả để đổi thứ tự cảnh. Mỗi thẻ hiển thị prompt, ảnh/video đã tạo và các tùy chọn riêng."
      ),
      position: "top" as const,
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
