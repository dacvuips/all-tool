import { useState } from "react";
import { BiRotateRight } from "react-icons/bi";
import { RiCloseLine, RiZoomInLine, RiZoomOutLine } from "react-icons/ri";
import { useScreen } from "../../../../lib/hooks/useScreen";
import { Button } from "../form";
import { Dialog } from "./dialog";

interface PropsType extends ReactProps {
  isOpen: boolean;
  image: string;
  onClose: () => any;
  onClick?: () => void;
  imageDialogClassName?: string;
}

export function ImageDialog({
  className = "",
  style = {},
  imageDialogClassName = "",
  ...props
}: PropsType) {
  const lg = useScreen("lg");

  const [widthImage, setWidthImage] = useState<number>(86);
  const [rotateImage, setRotateImage] = useState<number>(0);
  const zoomIn = () => {
    widthImage < 386 && setWidthImage(widthImage + 50);
  };

  const zoomOut = () => {
    widthImage >= 136 && setWidthImage(widthImage - 50);
  };
  const rotate = () => {
    setRotateImage(rotateImage + 90);
  };
  return (
    <Dialog
      maxWidth={`${!lg ? `${widthImage}vw` : "86vw"}`}
      width={`${!lg ? `${widthImage}vw` : undefined}`}
      className="relative"
      dialogClass="relative  rounded-2xl m-auto"
      isOpen={props.isOpen}
      onClose={props.onClose}
      slideFromBottom="none"
      onOverlayClick={() => {
        props.onClose();
        setWidthImage(86);
        setRotateImage(0);
      }}
    >
      {props.image && (
        <div className="relative">
          <img
            className={` ${
              props.onClick ? "cursor-pointer" : ""
            } ${className} ${imageDialogClassName} `}
            style={{ rotate: `${rotateImage}deg`, ...style }}
            src={props.image}
            onClick={props.onClick}
          />
          <div className="fixed flex items-center gap-2 p-2 transform -translate-x-1/2 bg-black bg-opacity-50 rounded-md w-44 left-1/2 bottom-8">
            <Button
              icon={<RiZoomInLine />}
              onClick={() => zoomIn()}
              hoverWhite
              tooltip="Zoom in"
              className="h-5 px-0 text-white cursor-pointer text-28 hover:text-gray-300"
            />
            <div style={{ minWidth: "1px" }} className="h-5 bg-white"></div>
            <Button
              icon={<RiZoomOutLine />}
              onClick={() => zoomOut()}
              hoverWhite
              tooltip="Zoom out"
              className="h-5 px-0 text-white cursor-pointer text-28 hover:text-gray-300"
            />{" "}
            <div style={{ minWidth: "1px" }} className="h-5 bg-white"></div>
            <Button
              icon={<BiRotateRight />}
              onClick={() => rotate()}
              hoverWhite
              tooltip="Rotate"
              className="h-5 px-0 text-white cursor-pointer text-28 hover:text-gray-300"
            />{" "}
            <div style={{ minWidth: "1px" }} className="h-5 bg-white"></div>
            <Button
              icon={<RiCloseLine />}
              onClick={() => {
                props.onClose();
                setWidthImage(86);
                setRotateImage(0);
              }}
              hoverWhite
              className="h-5 px-0 text-white cursor-pointer text-28 hover:text-gray-300"
            />
          </div>
        </div>
      )}
    </Dialog>
  );
}
