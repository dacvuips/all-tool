/** Thời lượng video Flow2 (`video_duration_s`) — dùng chung mọi luồng gen video trong app. */

export const FLOW2_VIDEO_DURATIONS = [8, 6, 4] as const;
export type Flow2VideoDurationS = (typeof FLOW2_VIDEO_DURATIONS)[number];

export const DEFAULT_FLOW2_VIDEO_DURATION_S: Flow2VideoDurationS = 8;

/** Chuẩn hoá `videoDurationS` từ client — trả về giá trị hợp lệ hoặc mặc định 8s. */
export function normalizeFlow2VideoDurationS(value: unknown): Flow2VideoDurationS {
  const n = Number(value);
  if (FLOW2_VIDEO_DURATIONS.includes(n as Flow2VideoDurationS)) {
    return n as Flow2VideoDurationS;
  }
  return DEFAULT_FLOW2_VIDEO_DURATION_S;
}
