/**
 * Lựa chọn Cỡ cảnh / Góc máy / Lia máy (storyboard + extract defaults).
 * Giá trị tiếng Việt — hiển thị trực tiếp trên UI và lưu vào scene record.
 */

/** Cỡ cảnh (Shot size / Framing) */
export const FILM_SHOT_SIZE_OPTIONS = [
  "Extreme Wide Shot (EWS)",
  "Toàn cảnh (Wide Shot)",
  "Toàn thân (Full Shot)",
  "Cận chân / American Shot",
  "Trung cảnh (Medium Shot)",
  "Trung gần (Medium Close-up)",
  "Cận cảnh (Close-up)",
  "Cận cực (Extreme Close-up)",
  "Insert / Chi tiết",
  "Over-the-Shoulder (OTS)",
  "POV (Góc nhìn nhân vật)",
  "Two Shot",
  "Group Shot",
  "Establishing Shot",
  "Master Shot",
  "Aerial / Drone Shot",
  "Bird's Eye (Nhìn từ trên)",
  "Top Shot",
  "Low Angle Wide",
  "Cowboy Shot",
] as const;

/** Góc máy (Camera angle) */
export const FILM_CAMERA_ANGLE_OPTIONS = [
  "Chính diện (Eye Level)",
  "Cao (High Angle)",
  "Thấp (Low Angle)",
  "Nghiêng Dutch / Canted",
  "Nhìn từ trên (Overhead)",
  "Nhìn từ dưới (Worm's Eye)",
  "Phía trước",
  "Phía sau",
  "Góc 3/4 phía trước",
  "Góc 3/4 phía sau",
  "Profile / Ngang hông",
  "Over-the-Shoulder",
  "POV",
  "Side Angle",
  "Top-down 90°",
  "Ground Level",
  "Hip Level",
  "Shoulder Level",
] as const;

/** Lia máy / chuyển động máy (Camera movement) */
export const FILM_CAMERA_MOVEMENT_OPTIONS = [
  "Tĩnh (Static)",
  "Pan trái",
  "Pan phải",
  "Tilt lên",
  "Tilt xuống",
  "Zoom in",
  "Zoom out",
  "Dolly in",
  "Dolly out",
  "Tracking / Theo sau",
  "Tracking ngang (Trucking)",
  "Arc / Vòng cung",
  "Crane lên",
  "Crane xuống",
  "Boom up",
  "Boom down",
  "Handheld / Cầm tay",
  "Steadicam",
  "Gimbal theo dõi",
  "Whip Pan",
  "Push-in",
  "Pull-out",
  "Orbit",
  "Pedestal up",
  "Pedestal down",
  "Roll / Xoay trục",
  "Rack Focus (kéo nét)",
  "Following / Chase",
  "Reveal",
  "Crash Zoom",
] as const;

export type FilmShotSizeOption = (typeof FILM_SHOT_SIZE_OPTIONS)[number];
export type FilmCameraAngleOption = (typeof FILM_CAMERA_ANGLE_OPTIONS)[number];
export type FilmCameraMovementOption = (typeof FILM_CAMERA_MOVEMENT_OPTIONS)[number];

/**
 * Map giá trị cũ / extract ngắn về option đầy đủ (nếu khớp alias).
 * Không khớp → giữ nguyên raw (select vẫn hiện option "custom" tạm).
 */
const SHOT_SIZE_ALIASES: Record<string, string> = {
  "toàn cảnh": "Toàn cảnh (Wide Shot)",
  "wide shot": "Toàn cảnh (Wide Shot)",
  wide: "Toàn cảnh (Wide Shot)",
  ews: "Extreme Wide Shot (EWS)",
  "extreme wide": "Extreme Wide Shot (EWS)",
  "toàn thân": "Toàn thân (Full Shot)",
  "full shot": "Toàn thân (Full Shot)",
  "trung cảnh": "Trung cảnh (Medium Shot)",
  "medium shot": "Trung cảnh (Medium Shot)",
  medium: "Trung cảnh (Medium Shot)",
  "trung gần": "Trung gần (Medium Close-up)",
  mcu: "Trung gần (Medium Close-up)",
  "cận cảnh": "Cận cảnh (Close-up)",
  "close-up": "Cận cảnh (Close-up)",
  "close up": "Cận cảnh (Close-up)",
  cu: "Cận cảnh (Close-up)",
  "cận cực": "Cận cực (Extreme Close-up)",
  ecu: "Cận cực (Extreme Close-up)",
  insert: "Insert / Chi tiết",
  ots: "Over-the-Shoulder (OTS)",
  pov: "POV (Góc nhìn nhân vật)",
  establishing: "Establishing Shot",
  cowboy: "Cowboy Shot",
};

const CAMERA_ANGLE_ALIASES: Record<string, string> = {
  "chính diện": "Chính diện (Eye Level)",
  "eye level": "Chính diện (Eye Level)",
  thấp: "Thấp (Low Angle)",
  "low angle": "Thấp (Low Angle)",
  low: "Thấp (Low Angle)",
  cao: "Cao (High Angle)",
  "high angle": "Cao (High Angle)",
  high: "Cao (High Angle)",
  "phía trước": "Phía trước",
  "phía sau": "Phía sau",
  dutch: "Nghiêng Dutch / Canted",
  "dutch angle": "Nghiêng Dutch / Canted",
  pov: "POV",
  overhead: "Nhìn từ trên (Overhead)",
  "bird's eye": "Nhìn từ trên (Overhead)",
};

const CAMERA_MOVEMENT_ALIASES: Record<string, string> = {
  tĩnh: "Tĩnh (Static)",
  static: "Tĩnh (Static)",
  "không di chuyển": "Tĩnh (Static)",
  zoom: "Zoom in",
  "zoom in": "Zoom in",
  "zoom out": "Zoom out",
  "theo sau": "Tracking / Theo sau",
  tracking: "Tracking / Theo sau",
  pan: "Pan phải",
  "pan trái": "Pan trái",
  "pan phải": "Pan phải",
  dolly: "Dolly in",
  handheld: "Handheld / Cầm tay",
  steadicam: "Steadicam",
  gimbal: "Gimbal theo dõi",
  tilt: "Tilt lên",
};

function normalizeAliasKey(value: string): string {
  return value.trim().toLowerCase();
}

export function resolveFilmShotSizeValue(raw?: string): string {
  const v = (raw || "").trim();
  if (!v) return "";
  if ((FILM_SHOT_SIZE_OPTIONS as readonly string[]).includes(v)) return v;
  return SHOT_SIZE_ALIASES[normalizeAliasKey(v)] || v;
}

export function resolveFilmCameraAngleValue(raw?: string): string {
  const v = (raw || "").trim();
  if (!v) return "";
  if ((FILM_CAMERA_ANGLE_OPTIONS as readonly string[]).includes(v)) return v;
  return CAMERA_ANGLE_ALIASES[normalizeAliasKey(v)] || v;
}

export function resolveFilmCameraMovementValue(raw?: string): string {
  const v = (raw || "").trim();
  if (!v) return "";
  if ((FILM_CAMERA_MOVEMENT_OPTIONS as readonly string[]).includes(v)) return v;
  return CAMERA_MOVEMENT_ALIASES[normalizeAliasKey(v)] || v;
}

/** Options cho <select>: preset + giá trị hiện tại nếu chưa có trong list */
export function filmSelectOptionsWithCurrent(
  presets: readonly string[],
  current?: string
): string[] {
  const cur = (current || "").trim();
  if (!cur) return [...presets];
  if (presets.includes(cur)) return [...presets];
  return [cur, ...presets];
}
