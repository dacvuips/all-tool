/**
 * upsample-image-button.tsx
 * Nút upscale ảnh đã generate lên 2K/4K — dùng chung cho SceneCardImageTab, Wolf card, ...
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RiLoader4Line } from "react-icons/ri";
import { useToast } from "../../../../lib/providers/toast-provider";
import { Button } from "../../../shared/utilities/form";
import {
  buildSceneImageFileName,
  downloadUpsampledImage,
  GeneratedImageLike,
  hasFlow2UpsampleMeta,
  UpsampleResolution,
} from "./generatedMediaUtils";

export interface UpsampleImageButtonProps {
  resolution: UpsampleResolution;
  image: GeneratedImageLike;
  /** Tên file tải về (vd. `3.png` hoặc `wolf-abc.jpg`) */
  fileName: string;
  disabled?: boolean;
  className?: string;
}

const RESOLUTION_STYLES: Record<UpsampleResolution, string> = {
  "2K": "min-w-8 h-8 px-2 rounded-lg bg-violet-50 text-violet-600 font-bold text-xs",
  "4K": "min-w-8 h-8 px-2 rounded-lg bg-indigo-50 text-indigo-600 font-bold text-xs",
};

export function UpsampleImageButton({
  resolution,
  image,
  fileName,
  disabled = false,
  className,
}: UpsampleImageButtonProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  if (!hasFlow2UpsampleMeta(image, resolution)) {
    return null;
  }

  const handleClick = async () => {
    if (loading || disabled) return;
    setLoading(true);
    try {
      await downloadUpsampledImage(image, fileName, resolution);
      toast.success(t("Đã tải ảnh {{res}}", { res: resolution }));
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : t("Không thể upscale ảnh {{res}}", { res: resolution });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={disabled || loading}
      className={className || RESOLUTION_STYLES[resolution]}
      tooltip={t("Tải ảnh {{res}}", { res: resolution })}
      placement="bottom"
    >
      {loading ? <RiLoader4Line className="text-base animate-spin" /> : resolution}
    </Button>
  );
}

export function Upsample2kButton(props: Omit<UpsampleImageButtonProps, "resolution">) {
  return <UpsampleImageButton resolution="2K" {...props} />;
}

export function Upsample4kButton(props: Omit<UpsampleImageButtonProps, "resolution">) {
  return <UpsampleImageButton resolution="4K" {...props} />;
}

/** Helper: tên file theo số phân cảnh. */
export function buildUpsampleImageFileName(sceneNumber: number, mimeType?: string): string {
  return buildSceneImageFileName(sceneNumber, mimeType);
}
