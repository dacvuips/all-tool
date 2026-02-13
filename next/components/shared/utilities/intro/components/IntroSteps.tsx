import { useEffect, useState } from "react";
import IntroSteps from "../intro-steps";
// import "./intro.css";
interface IntroStepsProps {
  steps: {
    title?: string;
    element?: string;
    intro?: string;
    position?:
      | "top"
      | "right"
      | "bottom"
      | "left"
      | "bottom-left-aligned"
      | "bottom-middle-aligned"
      | "bottom-right-aligned"
      | "top-left-aligned"
      | "top-middle-aligned"
      | "top-right-aligned"
      | "auto";
  }[];

  showProgress?: boolean; // thanh progress
  hidePrev?: boolean;
  hideNext?: boolean;
  nextLabel?: string;
  prevLabel?: string;
  doneLabel?: string;
  onClose?: () => any;
  isOpen?: boolean;
  option?: any;
}
export const IntroStep = ({
  steps,
  showProgress = false,
  hidePrev = false,
  hideNext = false,
  nextLabel = "Tiếp",
  prevLabel = "Trở lại",
  doneLabel = "Hoàn thành",
  isOpen,
  option,
  ...props
}: IntroStepsProps) => {
  const [stepsEnabled, setStepsEnabled] = useState(false);

  const [initialStep] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setStepsEnabled((prev) => !prev);
    }
  }, [isOpen]);

  return (
    <IntroSteps
      enabled={stepsEnabled}
      steps={steps}
      options={{ showProgress, hidePrev, hideNext, nextLabel, prevLabel, doneLabel, ...option }}
      initialStep={initialStep}
      onExit={() => {
        setStepsEnabled(false);
        props.onClose();
      }}
      {...props}
    />
  );
};
