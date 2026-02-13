import { HiOutlineX } from "react-icons/hi";
import ReactPlayer from "react-player";
import { useScreen } from "../../../lib/hooks/useScreen";
import { Dialog, DialogProps } from "../utilities/dialog/dialog";

export function VideoDialog({ videoUrl = "", ...props }: DialogProps & { videoUrl: string }) {
  const screenSm = useScreen("sm");
  return (
    <Dialog
      mobileSizeMode={!screenSm}
      slideFromBottom={"none"}
      width={screenSm ? "700px" : "300px"}
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
        {screenSm ? (
          <ReactPlayer
            url={videoUrl}
            width="700px"
            height="400px"
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
        ) : (
          <ReactPlayer
            url={videoUrl}
            width="300px"
            height="200px"
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
        )}
      </div>
    </Dialog>
  );
}
