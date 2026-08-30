import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RiPlayCircleLine } from "react-icons/ri";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { VideoDialog } from "../../../../shared/common/video-dialog";
import { ACCESS_TOKEN_GUIDE_VIDEOS } from "./access-token-guide-videos";
import type { SocialPlatform } from "./types";

export function SocialAccessTokenGuideVideoButton({ platform }: { platform: SocialPlatform }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const videoUrl = ACCESS_TOKEN_GUIDE_VIDEOS[platform]?.trim() || "";

  const handleClick = () => {
    if (!videoUrl) {
      toast.info(t("Video hướng dẫn chưa được cấu hình."));
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="flex gap-2 justify-center items-center px-4 py-2.5 w-full text-sm font-medium text-gray-700 bg-white rounded-xl border border-gray-200 transition hover:bg-gray-50 hover:border-indigo-200 hover:text-indigo-700"
      >
        <RiPlayCircleLine className="text-lg text-indigo-500 shrink-0" aria-hidden />
        <span>{t("Xem video hướng dẫn")}</span>
      </button>

      {videoUrl ? (
        <VideoDialog
          isOpen={open}
          onClose={() => setOpen(false)}
          videoUrl={videoUrl}
          aspectRatio="16:9"
        />
      ) : null}
    </>
  );
}
