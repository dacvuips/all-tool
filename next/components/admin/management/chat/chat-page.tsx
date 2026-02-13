import { useAuth } from "../../../../lib/providers/auth-provider";
import { ChatPage } from "../../../shared/chat/admin/chat-page";
import { ChatProvider } from "../../../shared/chat/chat-provider";
import { Card } from "../../../shared/utilities/misc";

export function ChatPages({ ...props }) {
  const { user } = useAuth();
  return (
    <Card>
      <ChatProvider>
        <ChatPage senderRole="STAFF" senderId={user.id} />
      </ChatProvider>
    </Card>
  );
}
