import { useEffect, useState } from "react";
import { useChatContext } from "./chat-provider";

export function useReplyMessageContext(threadId: string) {
  const [replyMessage, setReplyMessage] = useState<any>(null);
  const { loadReplyMessage, setLoadReplyMessage } = useChatContext();
  // get sessionStorage
  useEffect(() => {
    const replyMessage = JSON.parse(sessionStorage.getItem(`reply-${threadId}`));
    if (replyMessage) {
      setReplyMessage(replyMessage);
      setLoadReplyMessage(false);
    } else {
      setReplyMessage(null);
      setLoadReplyMessage(false);
    }
  }, [threadId, loadReplyMessage]);

  const replyMessageOnClose = () => {
    sessionStorage.removeItem(`reply-${threadId}`);
    setLoadReplyMessage(true);
  };
  return { replyMessage, replyMessageOnClose };
}
