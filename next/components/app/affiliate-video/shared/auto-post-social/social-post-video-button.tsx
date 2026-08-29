import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RiShareForwardLine } from "react-icons/ri";
import { Button } from "../../../../shared/utilities/form";
import type { GeneratedVideoLike } from "../generatedMediaUtils";
import { hasGeneratedVideoData } from "../generatedMediaUtils";
import { INLINE_LIST_TOOLBAR_BTN } from "../scene-inline-list-media";
import { SocialPostVideoDialog } from "./social-post-video-dialog";

export function SocialPostVideoButton({
  video,
  sceneNumber,
  disabled = false,
  compact = false,
}: {
  video: GeneratedVideoLike | null;
  sceneNumber?: number;
  disabled?: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (!video || !hasGeneratedVideoData(video)) return null;

  const defaultTitle = sceneNumber ? `Video cảnh #${sceneNumber}` : undefined;

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        disabled={disabled}
        icon={<RiShareForwardLine />}
        placement="bottom"
        className={
          compact
            ? `${INLINE_LIST_TOOLBAR_BTN} text-indigo-600`
            : "w-8 h-8 text-indigo-600 bg-indigo-50 rounded-lg"
        }
        iconClassName={compact ? "text-base" : "text-xl font-bold"}
        tooltip={t("Đăng MXH")}
      />
      <SocialPostVideoDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        video={video}
        defaultTitle={defaultTitle}
      />
    </>
  );
}
