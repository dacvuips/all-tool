export enum ServiceImageEnum {
  imageOnly = "image_only",
  startEnd = "start_end",
  startAddEnd = "start_add_end",
  video = "video",
}
export enum ActionImageEnum {
  // "Tự động"
  auto = "auto",
  // "Tuần tự"
  sequential = "sequential",
}

/** Số tab upload ảnh tham chiếu khi chế độ nạp tuần tự */
export const SEQUENTIAL_ART_STYLE_IMG_TAB_COUNT = 3;
