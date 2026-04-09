import { useMemo } from "react";
import { HiOutlineX } from "react-icons/hi";
import ReactPlayer from "react-player";
import { useScreen } from "../../../lib/hooks/useScreen";
import { Dialog, DialogProps } from "../utilities/dialog/dialog";

interface VideoDialogExtraProps {
  videoUrl: string;
  /** e.g. "16:9", "9:16", "1:1", "4:3" */
  aspectRatio?: string;
}

export function VideoDialog({
  videoUrl = "",
  aspectRatio,
  ...props
}: DialogProps & VideoDialogExtraProps) {
  const screenSm = useScreen("sm");

  /** Compute player dimensions based on aspect ratio */
  const { playerWidth, playerHeight, dialogWidth } = useMemo(() => {
    // Parse aspect ratio string "W:H" → numeric ratio
    let ratioW = 16;
    let ratioH = 9;
    if (aspectRatio) {
      const parts = aspectRatio.split(":").map(Number);
      if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
        ratioW = parts[0];
        ratioH = parts[1];
      }
    }

    const isPortrait = ratioH > ratioW;

    if (screenSm) {
      // Desktop: base width 700px for landscape, 400px for portrait
      const w = isPortrait ? 400 : 700;
      const h = Math.round(w * (ratioH / ratioW));
      return { playerWidth: `${w}px`, playerHeight: `${h}px`, dialogWidth: `${w}px` };
    } else {
      // Mobile: base width 300px for landscape, 260px for portrait
      const w = isPortrait ? 260 : 300;
      const h = Math.round(w * (ratioH / ratioW));
      return { playerWidth: `${w}px`, playerHeight: `${h}px`, dialogWidth: `${w}px` };
    }
  }, [aspectRatio, screenSm]);

  return (
    <Dialog
      mobileSizeMode={!screenSm}
      slideFromBottom={"none"}
      width={dialogWidth}
      className="relative"
      {...props}
    >
      <i
        onClick={() => props.onClose()}
        className="absolute p-2 text-lg text-white bg-black bg-opacity-50 border border-white rounded-full cursor-pointer -top-4 z-100 -right-2 text-24"
      >
        <HiOutlineX />
      </i>
      <div>
        <ReactPlayer
          url={videoUrl}
          width={playerWidth}
          height={playerHeight}
          controls
          config={{
            youtube: {
              playerVars: { showinfo: 1, origin: "/" },
            },
            file: {
              attributes: {
                controlsList: "nodownload",
              },
            },
          }}
        />
      </div>
    </Dialog>
  );
}
