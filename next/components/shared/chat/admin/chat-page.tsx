import { useScreen } from "../../../../lib/hooks/useScreen";
import { MessageInput } from "../message-input";
import { MessageProvider, MessageProviderProps } from "../message-provider";
import { ThreadProvider } from "../thread-provider";
import { ChatList } from "./chat-list";
import { ChatMessageBoxPartner } from "./chat-message-box-partner";

export function ChatPage(props: MessageProviderProps) {
  const lg = useScreen("lg");
  return (
    <div
      className={`flex mt-5 overflow-hidden border rounded-xl   ${
        !lg ? "flex-col mb-14" : "  mb-0 flex-row"
      }`}
    >
      <ThreadProvider
        senderRole={props.senderRole}
        receiverRole={props.receiverRole}
        senderId={props.senderId}
        gameOrderId={props.gameOrderId}
      >
        <ChatList />
      </ThreadProvider>
      <MessageProvider {...props}>
        <div
          className="w-full v-scrollbar"
          style={{
            height: "calc(66vh)",
            minWidth: "280px",
          }}
        >
          <ChatMessageBoxPartner height={"calc(56vh - 72px)"} />
          <MessageInput className="z-10" />
          {/* <ChatMessageInput /> */}
        </div>
      </MessageProvider>{" "}
    </div>
  );
}
