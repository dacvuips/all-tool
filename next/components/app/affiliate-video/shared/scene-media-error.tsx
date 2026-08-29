import { useTranslation } from "react-i18next";
import {
  MEDIA_CONTENT_POLICY_MESSAGE,
  MEDIA_SYSTEM_BUSY_MESSAGE,
  toUserFriendlyMediaErrorMessage,
} from "./media-error-message";

function displayMediaError(message: string, t: (key: string) => string): string {
  const normalized = toUserFriendlyMediaErrorMessage(message);
  if (normalized === MEDIA_SYSTEM_BUSY_MESSAGE) return t(MEDIA_SYSTEM_BUSY_MESSAGE);
  if (normalized === MEDIA_CONTENT_POLICY_MESSAGE) return t(MEDIA_CONTENT_POLICY_MESSAGE);
  return normalized ?? t(MEDIA_SYSTEM_BUSY_MESSAGE);
}

/** Hiển thị lỗi generate ảnh/video inline trong scene card */
export function SceneMediaError({
  message,
  variant = "default",
}: {
  message?: string | null;
  variant?: "default" | "compact";
}) {
  const { t } = useTranslation();
  if (!message) return null;

  const text = displayMediaError(message, t);

  if (variant === "compact") {
    return (
      <p
        className="text-10 text-red-600 leading-tight line-clamp-2 text-left"
        title={text}
      >
        {text}
      </p>
    );
  }

  return (
    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1.5 text-center leading-snug">
      {text}
    </p>
  );
}
