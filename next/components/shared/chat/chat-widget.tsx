import { useEffect, useRef } from "react";
import { FaRegCommentDots } from "react-icons/fa";

import { useScreen } from "../../../lib/hooks/useScreen";
import { Button } from "../utilities/form/button";
import { Popover } from "../utilities/popover/popover";
import { useChatContext } from "./chat-provider";
import { MessageBox } from "./message-box";
import { MessageInput } from "./message-input";
import { MessageProvider, MessageProviderProps } from "./message-provider";
import { ThreadList } from "./thread-list";
import { ThreadProvider } from "./thread-provider";

import { RiSeparator } from "react-icons/ri";

type ChatWidgetProps = MessageProviderProps;

export function ChatWidget(props: ChatWidgetProps) {
  const messageRef = useRef(null);

  const { getAllSeenThread, threadCount, openThread, setOpenThread, isOpenMessageBoxStorage } =
    useChatContext();

  const sm = useScreen("sm");
  const md = useScreen("md");

  function handleClick(targetId) {
    setTimeout(() => {
      document.getElementById(targetId).click();
    }, 2000);
  }

  useEffect(() => {
    threadCount > 0 && !openThread && handleClick("chat-widget");
  }, [threadCount]);

  return (
    <>
      <div
        id="chat-widget"
        className={`fixed z-50 right-6`}
        style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
        ref={messageRef}
        onClick={(event) => {
          event.stopPropagation();
          setOpenThread(!openThread);
          getAllSeenThread(props.senderRole);
        }}
      >
        {threadCount > 0 && (
          <span
            style={{ top: "0.2rem", right: "0.2rem" }}
            className="absolute inline-flex w-8 h-8 rounded-full bg-danger-dark animate-ping"
          ></span>
        )}

        <Button
          // tooltip={"Chat của bạn"}
          placement="left"
          icon={openThread ? <RiSeparator /> : <FaRegCommentDots />}
          iconClassName="text-xl"
          primary
          className={` rounded-full shadow-md   ${openThread ? "hidden" : "h-9 w-9 px-3"}`}
        >
          {/* {threadCount > 0 && (
            <>
              <span
                style={{ top: "0.3rem", right: "0.25rem" }}
                className="absolute inline-flex w-3 h-3 rounded-full bg-danger-dark animate-ping"
              ></span>
              <i
                style={{ top: "0.25rem", right: "0.1rem" }}
                className="absolute text-red-500 text-18 "
              >
                <HiBell />
              </i>
            </>
          )} */}
          {threadCount > 0 && (
            <div className="absolute w-auto h-4 px-1 font-bold text-white bg-red-500 rounded-full animate-emerge left-8 bottom-2 min-w-4 flex-center text-10">
              {threadCount}
            </div>
          )}
          {/* {unseenMessageCount > 0 && (
            <div className="absolute w-auto h-4 px-1 font-bold text-white rounded-full animate-emerge left-8 bottom-2 bg-primary min-w-4 flex-center text-10">
              {unseenMessageCount}
            </div>
          )} */}
        </Button>
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
        {openThread && (
          <div
            className={`flex rounded popup-chat ${!sm ? "flex-col" : "flex-row"}`}
            style={{
              margin: "-5px -9px",
              width:
                !md && !isOpenMessageBoxStorage
                  ? "95vw"
                  : `${isOpenMessageBoxStorage ? "300px" : "700px"}`,
            }}
          >
            <ThreadProvider
              senderRole={props.senderRole}
              receiverRole={props.receiverRole}
              senderId={props.senderId}
              gameOrderId={props.gameOrderId}
            >
              <ThreadList />
            </ThreadProvider>
            <MessageProvider {...props}>
              <div className={`w-full  ${isOpenMessageBoxStorage ? "hidden" : ""}`}>
                <MessageBox height={"calc(55vh - 72px)"} />
                <MessageInput className="border-l" {...props} />
              </div>
            </MessageProvider>{" "}
          </div>
        )}
      </Popover>
    </>
  );
}
