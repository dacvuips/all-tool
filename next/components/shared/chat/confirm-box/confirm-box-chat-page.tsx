import { useScreen } from "../../../../lib/hooks/useScreen";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { ChatMessageBoxAdmin } from "../admin/chat-message-box-admin";
import { MessageProvider, MessageProviderProps } from "../message-provider";
import { ConfirmBoxChatList } from "./confirm-box-chat-list";
import { ConfirmBoxThreadProvider } from "./confirm-box-thread-provider";

export function ConfirmBoxChatPage(props: MessageProviderProps) {
  const { user } = useAuth();
  const lg = useScreen("lg");
  return (
    <div className={`flex mt-5 overflow-hidden border rounded-xl ${!lg ? "flex-col" : "flex-row"}`}>
      <ConfirmBoxThreadProvider
        senderRole={props.senderRole}
        receiverRole={props.receiverRole}
        senderId={props.senderId}
        gameOrderId={props.gameOrderId}
      >
        <ConfirmBoxChatList hasActionButton />
      </ConfirmBoxThreadProvider>
      <MessageProvider senderRole="ADMIN" senderId={user.id} {...props}>
        <div
          className="w-full "
          style={{
            height: "calc(66vh)",
            minWidth: "280px",
          }}
        >
          <ChatMessageBoxAdmin hasActionButton={false} height={"calc(60vh)"} />
        </div>
      </MessageProvider>
    </div>
  );
}
