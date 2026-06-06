import { ServiceImageEnum } from "../../app/constanst";

/**
 * Chế độ tạo video có ảnh trên Flow2 (`gen_image_video.params.video_mode`).
 *
 * - `frame`    — Khung hình: 1 ảnh = startImage; 2 ảnh = startImage + endImage
 * - `component` — Thành phần (Reference): 1, 2 hoặc 3 ảnh tham chiếu
 */
export type Flow2VideoMode = "component" | "frame";

export const FLOW2_VIDEO_MODE = {
  /** Reference — upload 1–3 ảnh tham chiếu */
  COMPONENT: "component",
  /** Khung hình — startImage (1 ảnh) hoặc startImage + endImage (2 ảnh) */
  FRAME: "frame",
} as const;

/** Số ảnh tối đa theo từng chế độ Flow2 */
export const FLOW2_VIDEO_IMAGE_LIMITS = {
  component: { min: 1, max: 3 },
  frame: { min: 1, max: 2 },
} as const;

/** Chuẩn hoá giá trị `video_mode` từ client (hỗ trợ alias cũ nếu có). */
export function normalizeFlow2VideoMode(input?: string | null): Flow2VideoMode | undefined {
  if (!input) return undefined;
  const value = input.trim().toLowerCase();
  if (value === FLOW2_VIDEO_MODE.COMPONENT || value === "reference") {
    return FLOW2_VIDEO_MODE.COMPONENT;
  }
  if (
    value === FLOW2_VIDEO_MODE.FRAME ||
    value === "start_image" ||
    value === "start_end" ||
    value === "start-end"
  ) {
    return FLOW2_VIDEO_MODE.FRAME;
  }
  return undefined;
}

/** Kiểm tra số lượng ảnh có khớp với chế độ Flow2 hay không. Throw nếu không hợp lệ. */
export function assertFlow2VideoImageCount(mode: Flow2VideoMode, imageCount: number): void {
  const limits = FLOW2_VIDEO_IMAGE_LIMITS[mode];
  if (imageCount < limits.min || imageCount > limits.max) {
    if (mode === FLOW2_VIDEO_MODE.FRAME) {
      const err: any = new Error(
        "Chế độ frame (startImage/endImage) chỉ hỗ trợ 1 hoặc 2 ảnh"
      );
      err.statusCode = 400;
      throw err;
    }
    const err: any = new Error(
      "Chế độ component (Reference) hỗ trợ từ 1 đến 3 ảnh tham chiếu"
    );
    err.statusCode = 400;
    throw err;
  }
}

/**
 * Map `ServiceImageEnum` (Element Editor) sang `video_mode` Flow2.
 * Dùng chung khi client gửi serviceImageType thay vì video_mode trực tiếp.
 */
export function mapServiceImageTypeToFlow2VideoMode(
  serviceType: ServiceImageEnum | undefined
): Flow2VideoMode | undefined {
  switch (serviceType) {
    case ServiceImageEnum.imageOnly:
    case ServiceImageEnum.startEnd:
      return FLOW2_VIDEO_MODE.FRAME;
    case ServiceImageEnum.startAddEnd:
      return FLOW2_VIDEO_MODE.COMPONENT;
    default:
      return undefined;
  }
}

export type ResolveFlow2VideoModeInput = {
  /** `video_mode` / `videoMode` từ request body hoặc config */
  explicitMode?: string | null;
  /** Fallback từ Element Editor (`serviceImageType`) */
  serviceImageType?: ServiceImageEnum;
  imageCount: number;
};

/**
 * Xác định `video_mode` khi gọi Flow2 `gen_image_video`.
 *
 * Thứ tự ưu tiên:
 * 1. `explicitMode` (video_mode client gửi lên)
 * 2. `serviceImageType` (image_only / start_end → frame; start_add_end → component)
 * 3. Suy luận theo số ảnh: 3 ảnh → component; 1–2 ảnh → frame (start/end)
 *
 * Trả `undefined` khi không có ảnh (text-to-video).
 */
export function resolveFlow2VideoMode(input: ResolveFlow2VideoModeInput): Flow2VideoMode | undefined {
  const { imageCount } = input;
  if (imageCount <= 0) return undefined;

  const fromExplicit = normalizeFlow2VideoMode(input.explicitMode);
  if (fromExplicit) {
    assertFlow2VideoImageCount(fromExplicit, imageCount);
    return fromExplicit;
  }

  const fromServiceType = mapServiceImageTypeToFlow2VideoMode(input.serviceImageType);
  if (fromServiceType) {
    assertFlow2VideoImageCount(fromServiceType, imageCount);
    return fromServiceType;
  }

  const inferred: Flow2VideoMode =
    imageCount >= 3 ? FLOW2_VIDEO_MODE.COMPONENT : FLOW2_VIDEO_MODE.FRAME;
  assertFlow2VideoImageCount(inferred, imageCount);
  return inferred;
}
