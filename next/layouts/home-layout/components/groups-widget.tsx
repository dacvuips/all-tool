import { useRef, useState } from "react";

import { FaRegCommentDots } from "react-icons/fa";
import { Button } from "../../../components/shared/utilities/form";
import { Img } from "../../../components/shared/utilities/misc";
import { Popover } from "../../../components/shared/utilities/popover/popover";

type GroupsWidgetProps = {};

export function GroupsWidget(props: GroupsWidgetProps) {
  const messageRef = useRef(null);
  const [open, setOpen] = useState(false);
  function handleClick(targetId) {
    setTimeout(() => {
      document.getElementById(targetId).click();
    }, 2000);
  }

  return (
    <>
      <div
        id="groups-widget"
        className={`fixed right-6 z-50`}
        style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
        ref={messageRef}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <Button
          // tooltip={"Chat của bạn"}
          placement="left"
          icon={<FaRegCommentDots />}
          iconClassName="text-xl"
          primary
          className={` rounded-full shadow-md   ${open ? "hidden" : "px-3 w-9 h-9"}`}
        ></Button>
      </div>

      <Popover
        className={`rounded-xl`}
        hideOnClickOutside={false}
        reference={messageRef}
        trigger="click"
        placement="top-start"
        zIndex={99}
        arrow={false}
      >
        <div
          className="flex flex-col items-center"
          onClick={() => {
            window.open("https://zalo.me/g/od2nsrqqfkhuksramped", "_blank");
          }}
        >
          <Img src="/assets/img/group-zalo.jpg" alt="groups-widget" className="w-32 h-32" />
          <img src="/assets/img/logo-full-1.png" alt="groups-widget" className="w-32 h-10" />
        </div>
      </Popover>
    </>
  );
}
