import router from "next/router";
import { AiOutlineClose } from "react-icons/ai";
import { useScreen } from "../../../lib/hooks/useScreen";
import { Dialog } from "../utilities/dialog/dialog";
import { Button } from "../utilities/form";

export function AuthDialogHeader({
  title,
  noCloseButton = true,
  subtitle,
  onClose,
}: {
  title: string;
  noCloseButton?: boolean;
  subtitle: string;
  onClose?: () => any;
}) {
  const screenLg = useScreen("lg");
  return (
    <Dialog.Header>
      <div className="relative text-center">
        {screenLg && noCloseButton == true && (
          <Button
            hoverDanger
            className="absolute -top-4 -right-4"
            icon={<AiOutlineClose />}
            unfocusable
            iconClassName="text-xl"
            onClick={onClose}
          />
        )}
        <img
          src="/assets/img/logo.png"
          className={`object-contain cursor-pointer ${screenLg ? "w-20" : "w-16"} `}
          style={{ margin: "0 auto" }}
          onClick={() => router.push("/")}
        />
        <div
          className={`my-2 font-semibold leading-6 text-accent ${
            screenLg ? "text-24" : "text-20"
          } `}
        >
          {title}
        </div>
        <div className="mb-4 font-semibold text-gray-600">{subtitle}</div>
      </div>
    </Dialog.Header>
  );
}
AuthDialogHeader.displayName = "Header";
