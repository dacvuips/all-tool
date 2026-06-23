export type AffiliateIntroStep = {
  element: string;
  title: string;
  intro: string;
  position: "top" | "right" | "bottom" | "left" | "auto";
};

function aspectRatioStep(t: (key: string) => string): AffiliateIntroStep {
  return {
    element: "#aspect-ratio-section",
    title: t("Tỉ lệ khung hình"),
    intro: t(
      "Chọn 9:16 (dọc) cho TikTok/Reels hoặc 16:9 (ngang) cho YouTube. Tỉ lệ này áp dụng cho toàn bộ video output."
    ),
    position: "right",
  };
}

function artStyleStep(t: (key: string) => string): AffiliateIntroStep {
  return {
    element: "#art-style-section",
    title: t("Phong cách hình ảnh"),
    intro: t(
      'Mô tả hoặc chọn mẫu phong cách visual (anime, realistic...). Nhấn "Mẫu" để duyệt thư viện phong cách có sẵn.'
    ),
    position: "right",
  };
}

function languageStep(t: (key: string) => string): AffiliateIntroStep {
  return {
    element: "#language-section",
    title: t("Ngôn ngữ lời thoại"),
    intro: t("Chọn ngôn ngữ cho lời thoại và narration trong video output."),
    position: "right",
  };
}

function createVideoStep(t: (key: string) => string, title?: string): AffiliateIntroStep {
  return {
    element: "#create-video-btn",
    title: title ?? t("Tạo phân cảnh"),
    intro: t(
      "Sau khi cấu hình xong, nhấn nút này để AI phân tích và tạo danh sách phân cảnh bên phải."
    ),
    position: "top",
  };
}

/** Trending Prompt sidebar */
export function getTrendingSidebarIntroSteps(t: (key: string) => string): AffiliateIntroStep[] {
  return [
    {
      element: "#trending-mode-section",
      title: t("Chế độ tạo"),
      intro: t(
        "Đơn Lẻ: AI tạo một biến thể từ prompt trending. Cốt truyện/kịch bản: tạo nhiều cảnh theo kịch bản."
      ),
      position: "right",
    },
    aspectRatioStep(t),
    artStyleStep(t),
    languageStep(t),
    {
      element: "#tip-content-section",
      title: t("Prompt"),
      intro: t(
        "Nội dung prompt trending — chọn từ danh sách bên phải hoặc chỉnh sửa tại đây."
      ),
      position: "right",
    },
    {
      element: "#product-images-section",
      title: t("Ảnh sản phẩm tham chiếu"),
      intro: t("Tùy chọn — upload tối đa 5 ảnh sản phẩm để AI tham chiếu khi tạo các phân cảnh."),
      position: "right",
    },
    {
      element: "#batch-size-slider",
      title: t("Số lượng cảnh"),
      intro: t("Kéo thanh trượt để chọn số phân cảnh cần tạo (chỉ áp dụng ở chế độ Cốt truyện)."),
      position: "right",
    },
    createVideoStep(t, t("Tạo phân cảnh")),
  ];
}

/** Single / Kịch bản sidebar */
export function getSingleSidebarIntroSteps(
  t: (key: string) => string,
  options: { isBatch: boolean }
): AffiliateIntroStep[] {
  const steps: AffiliateIntroStep[] = [];

  if (options.isBatch) {
    steps.push({
      element: "#story-mode-section",
      title: t("Chế độ tạo"),
      intro: t(
        "Chọn cách AI tạo phân cảnh: từ ảnh tham chiếu, từ prompt text, hoặc text-to-video trực tiếp."
      ),
      position: "right",
    });
  }

  steps.push(
    aspectRatioStep(t),
    artStyleStep(t),
    languageStep(t),
    {
      element: "#category-section",
      title: t("Chủ đề / Danh mục"),
      intro: t("Chọn chủ đề nội dung để AI gợi ý prompt và điều chỉnh phong cách kể chuyện."),
      position: "right",
    },
    {
      element: "#mood-section",
      title: t("Tính cách / Mood"),
      intro: t(
        "Chọn tone cảm xúc của nội dung (vui vẻ, drama, hài hước...) để AI điều chỉnh phong cách kể chuyện."
      ),
      position: "right",
    },
    {
      element: "#object-personify-section",
      title: t("Nhân hoá đồ vật"),
      intro: t(
        "Tùy chọn — biến đồ vật thành nhân vật có tính cách. Có thể nhập prompt hoặc upload ảnh tham chiếu."
      ),
      position: "right",
    },
    {
      element: "#tip-content-section",
      title: t("Nội dung mẹo"),
      intro: t(
        "Nhập ý tưởng chính cho video. Dùng nút Gợi ý để AI đề xuất nội dung dựa trên chủ đề và mood."
      ),
      position: "right",
    },
    {
      element: "#product-images-section",
      title: t("Ảnh sản phẩm tham chiếu"),
      intro: t("Tùy chọn — upload tối đa 5 ảnh sản phẩm để AI tham chiếu khi tạo các phân cảnh."),
      position: "right",
    }
  );

  if (options.isBatch) {
    steps.push({
      element: "#batch-size-slider",
      title: t("Số lượng cảnh"),
      intro: t("Kéo thanh trượt để chọn số phân cảnh cần tạo từ kịch bản."),
      position: "right",
    });
  }

  steps.push(createVideoStep(t, t("Tạo phân cảnh")));
  return steps;
}

/** Storyboard sidebar */
export function getStoryboardSidebarIntroSteps(t: (key: string) => string): AffiliateIntroStep[] {
  return [
    {
      element: "#storyboard-upload-section",
      title: t("Ảnh storyboard"),
      intro: t(
        "Upload ảnh storyboard — AI sẽ phân tích từng khung hình và tạo phân cảnh tương ứng."
      ),
      position: "right",
    },
    aspectRatioStep(t),
    artStyleStep(t),
    languageStep(t),
    {
      element: "#tip-content-section",
      title: t("Nội dung"),
      intro: t("Mô tả bổ sung cho storyboard. Dùng nút Gợi ý để AI đề xuất nội dung."),
      position: "right",
    },
    {
      element: "#product-images-section",
      title: t("Ảnh sản phẩm tham chiếu"),
      intro: t("Tùy chọn — upload ảnh sản phẩm để AI tham chiếu khi tạo các phân cảnh."),
      position: "right",
    },
    createVideoStep(t, t("Phân tích storyboard")),
  ];
}

/** Elements sidebar */
export function getElementSidebarIntroSteps(t: (key: string) => string): AffiliateIntroStep[] {
  return [
    {
      element: "#element-image-mode-section",
      title: t("Chế độ nạp ảnh"),
      intro: t(
        "Nạp ảnh tự động: AI tự tạo ảnh cho từng cảnh. Nạp ảnh tuần tự: upload ảnh theo thứ tự từng cảnh."
      ),
      position: "right",
    },
    aspectRatioStep(t),
    artStyleStep(t),
    {
      element: "#scene-prompt-section",
      title: t("Prompt phân cảnh"),
      intro: t(
        "Mỗi dòng bắt đầu bằng số là một cảnh. VD: 1. Mô tả cảnh đầu... 2. Mô tả cảnh hai..."
      ),
      position: "right",
    },
    {
      element: "#element-images-upload",
      title: t("Ảnh thành phần"),
      intro: t("Upload ảnh nhân vật/đồ vật tham chiếu cho từng cảnh hoặc toàn bộ video."),
      position: "right",
    },
    createVideoStep(t, t("Phân tích prompt")),
  ];
}

/** Review product sidebar */
export function getReviewSidebarIntroSteps(t: (key: string) => string): AffiliateIntroStep[] {
  return [
    aspectRatioStep(t),
    artStyleStep(t),
    languageStep(t),
    {
      element: "#object-personify-section",
      title: t("Nhân hoá đồ vật"),
      intro: t("Tùy chọn — biến sản phẩm thành nhân vật có tính cách trong video review."),
      position: "right",
    },
    {
      element: "#review-images-upload",
      title: t("Ảnh sản phẩm"),
      intro: t("Upload ảnh sản phẩm/thời trang cần review — AI sẽ tham chiếu khi tạo phân cảnh."),
      position: "right",
    },
    {
      element: "#scene-prompt-section",
      title: t("Điểm nổi bật"),
      intro: t("Nhập các điểm chính cần nhấn mạnh trong video review sản phẩm."),
      position: "right",
    },
    {
      element: "#batch-size-slider",
      title: t("Số lượng cảnh"),
      intro: t("Kéo thanh trượt để chọn số phân cảnh review cần tạo."),
      position: "right",
    },
    createVideoStep(t, t("Tạo phân cảnh review")),
  ];
}

/** App Prompt sidebar */
export function getAppSidebarIntroSteps(t: (key: string) => string): AffiliateIntroStep[] {
  return [
    {
      element: "#app-prompt-section",
      title: t("Prompt App"),
      intro: t("Danh sách prompt để tạo app — sao chép từng prompt hoặc toàn bộ."),
      position: "right",
    },
    {
      element: "#app-links-section",
      title: t("Link App"),
      intro: t("Các link app liên quan — mở trực tiếp hoặc sao chép link."),
      position: "right",
    },
  ];
}

/** ChatBot sidebar */
export function getChatbotSidebarIntroSteps(t: (key: string) => string): AffiliateIntroStep[] {
  return [
    {
      element: "#chatbot-message-list",
      title: t("Hội thoại"),
      intro: t(
        "Xem lịch sử chat với AI. Tin nhắn được lưu tự động — quay lại tab vẫn giữ nội dung."
      ),
      position: "right",
    },
    {
      element: "#chatbot-clear-btn",
      title: t("Xóa hội thoại"),
      intro: t("Xóa toàn bộ tin nhắn và bắt đầu cuộc trò chuyện mới."),
      position: "bottom",
    },
    {
      element: "#chatbot-input",
      title: t("Nhập câu hỏi"),
      intro: t(
        "Nhập prompt, ý tưởng kịch bản hoặc câu hỏi. Enter để gửi, Shift+Enter xuống dòng."
      ),
      position: "top",
    },
    {
      element: "#chatbot-attach-btn",
      title: t("Đính kèm"),
      intro: t("Đính kèm ảnh hoặc video tham chiếu để AI hiểu ngữ cảnh tốt hơn."),
      position: "top",
    },
    {
      element: "#chatbot-send-btn",
      title: t("Gửi"),
      intro: t("Gửi tin nhắn cho AI. Cần chọn chatbot (Dùng ngay) ở panel bên phải trước."),
      position: "top",
    },
  ];
}
