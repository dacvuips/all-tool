import { useTranslation } from "react-i18next";
import {
  MEDIA_SYSTEM_BUSY_MESSAGE,
  toUserFriendlyMediaErrorMessage,
} from "./media-error-message";

function displayMediaError(message: string, t: (key: string) => string): string {
  const normalized = toUserFriendlyMediaErrorMessage(message);
  if (normalized === MEDIA_SYSTEM_BUSY_MESSAGE) return t(MEDIA_SYSTEM_BUSY_MESSAGE);
  return normalized ?? t(MEDIA_SYSTEM_BUSY_MESSAGE);
}

/** Hiển thị lỗi generate ảnh/video inline trong scene card */
export function SceneMediaError({ message }: { message?: string | null }) {
  const { t } = useTranslation();
  if (!message) return null;

  return (
    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1.5 text-center leading-snug">
      {displayMediaError(message, t)}
    </p>
  );
}
