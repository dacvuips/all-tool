import { Player } from "@lottiefiles/react-lottie-player";
import { CgSpinner } from "react-icons/cg";

interface PropsType extends ReactProps {
  icon?: JSX.Element;
}
export function Spinner({ icon = <CgSpinner />, className = "py-32", ...props }: PropsType) {
  return (
    <div className={`w-full flex-center text-primary ${className}`}>
      <Player
        autoplay
        loop
        src={`/assets/lottie/spinner.json`}
        style={{ height: "50px", width: "50px" }}
      ></Player>
      {/* <i className="text-4xl animate-spin">{icon}</i> */}
    </div>
  );
}
