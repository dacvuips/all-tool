/**
 * upsample-4k-button.tsx
 * Nút upscale ảnh đã generate lên 4K — dùng chung cho SceneCardImageTab và các UI tương tự.
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { RiLoader4Line } from "react-icons/ri";
import { useToast } from "../../../../lib/providers/toast-provider";
import { Button } from "../../../shared/utilities/form";
import {
  buildSceneImageFileName,
  downloadUpsampled4kImage,
  GeneratedImageLike,
  hasFlow2UpscaleMeta,
} from "./generatedMediaUtils";

export interface Upsample4kButtonProps {
  image: GeneratedImageLike;
  /** Tên file tải về (vd. `3.png` hoặc `scene-1.jpg`) */
  fileName: string;
  disabled?: boolean;
  className?: string;
}

export function Upsample4kButton({
  image,
  fileName,
  disabled = false,
  className = "min-w-[32px] h-8 px-2 rounded-lg bg-indigo-50 text-indigo-600 font-bold text-xs",
}: Upsample4kButtonProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  if (!hasFlow2UpscaleMeta(image)) {
    return null;
  }

  const handleClick = async () => {
    if (loading || disabled) return;
    setLoading(true);
    try {
      await downloadUpsampled4kImage(image, fileName);
      toast.success(t("Đã tải ảnh 4K"));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("Không thể upscale ảnh 4K");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={disabled || loading}
      className={className}
      tooltip={t("Tải ảnh 4K")}
      placement="bottom"
    >
      {loading ? <RiLoader4Line className="text-base animate-spin" /> : "4K"}
    </Button>
  );
}

/** Helper: tên file theo số phân cảnh cho nút 4K. */
export function buildUpsample4kFileName(sceneNumber: number, mimeType?: string): string {
  return buildSceneImageFileName(sceneNumber, mimeType);
}
