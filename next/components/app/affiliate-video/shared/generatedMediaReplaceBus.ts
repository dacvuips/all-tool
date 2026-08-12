/**
 * Thông báo scene card reload ảnh/video sau khi file gốc bị thay thế (xóa logo).
 */
export type GeneratedMediaReplaceKind = "image" | "video" | "extend";

export type GeneratedMediaReplaceEvent = {
  sceneId: string;
  kind: GeneratedMediaReplaceKind;
  /** Ảnh đã thay — scene card áp dụng ngay, không đợi đọc lại IDB */
  image?: any;
  /** Video đã thay */
  video?: any;
};

type Listener = (event: GeneratedMediaReplaceEvent) => void;

const listeners = new Set<Listener>();

export function subscribeGeneratedMediaReplaced(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyGeneratedMediaReplaced(event: GeneratedMediaReplaceEvent): void {
  listeners.forEach((fn) => {
    try {
      fn(event);
    } catch (err) {
      console.warn("[notifyGeneratedMediaReplaced]", err);
    }
  });
}
