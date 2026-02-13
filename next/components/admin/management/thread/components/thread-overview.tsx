import { useAuth } from "../../../../../lib/providers/auth-provider";
import { Thread } from "../../../../../lib/repo/thread/thread.repo";
import { ChatProvider } from "../../../../shared/chat/chat-provider";
import { MessageProvider } from "../../../../shared/chat/message-provider";
import { ChatMessageBoxAdmin } from "../../../../shared/chat/admin/chat-message-box-admin";

export function ThreadOverviewTab({ thread, loadAll }: { thread: Thread; loadAll: () => void }) {
  const { user } = useAuth();
  return (
    <div className="border rounded-md">
      <ChatProvider senderRole="ADMIN" threadId={thread.id}>
        <MessageProvider senderRole="ADMIN" senderId={user.id}>
          <div className="w-full">
            <ChatMessageBoxAdmin height={"calc(60vh - 72px)"} />
            {/* <ChatMessageInput /> */}
          </div>
        </MessageProvider>{" "}
      </ChatProvider>
    </div>
  );
}
