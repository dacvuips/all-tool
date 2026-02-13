import { useRouter } from "next/router";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { WSClient } from "../../../lib/graphql/graphql-ws.link";
import { useThreadChanged } from "../../../lib/hooks/useThreadChanged";
import { useAuth } from "../../../lib/providers/auth-provider";
import { ThreadMessage } from "../../../lib/repo/thread/thread-message.repo";
import {
  Thread,
  ThreadChange,
  ThreadRole,
  ThreadService,
} from "../../../lib/repo/thread/thread.repo";

export const ChatContext = createContext<
  Partial<{
    threadStream: {
      thread: Thread;
      message: ThreadMessage;
    };
    unseenMessageCount: number;
    unseenThreadCount: number;
    unseenThreads: Partial<Thread>[];
    // onThreadSeen: (threadId: string) => any;
    threadId: string;
    setThreadId: (value: string) => void;
    reloadThread: boolean;
    setReloadThread: (value: boolean) => void;
    threadCount: number;
    setThreadCount: (value: number) => void;
    threadChanged?: ThreadChange;
    loadReplyMessage: boolean;
    setLoadReplyMessage: (value: boolean) => void;
    openThread: boolean;
    setOpenThread: (value: boolean) => void;
    getAllSeenThread: (value: string) => void;
    setMessageBoxToggleStorage: () => void;
    isOpenMessageBoxStorage: string;
  }>
>({});
interface Props extends ReactProps {
  threadId?: string;
  senderRole?: ThreadRole;
  senderId?: string;
}
export function ChatProvider({ senderRole, senderId, ...props }: Props) {
  // count the unseen messages with one higher-up entity
  const router = useRouter();
  const { user, customer } = useAuth();
  const [threadId, setThreadId] = useState<string>();
  const [pathName, setPathName] = useState<string>();

  const [threadCount, setThreadCount] = useState<number>();
  const intervalRef = useRef(null);
  const [reloadThread, setReloadThread] = useState<boolean>(false);
  const [unseenMessageCount, setunseenMessageCount] = useState<number>(0);
  // count the unseen threads with multiple clients
  const [unseenThreads, setUnseenThreads] = useState<Partial<Thread>[]>([]);
  const [loadReplyMessage, setLoadReplyMessage] = useState<boolean>(false);
  const [openThread, setOpenThread] = useState<boolean>(false);
  const [isOpenMessageBoxStorage, setIsOpenMessageBoxStorage] = useState<string>(
    localStorage.getItem("openMessageBox")
  );

  const threadChanged = useThreadChanged();
  useEffect(() => {
    //Hành động này nhầm ngăn chặn load WSClient khi chuyển page từ customer sang shop bị lỗi role
    if (pathName == "/" && router.pathname == "/shop") {
      WSClient.on("connected", () => {
        // console.log("ws reconnected");
        getAllSeenThread(senderRole);
      });
    }
  }, [router.pathname]);
  useEffect(() => {
    if (threadChanged) {
      getAllSeenThread(senderRole);
    }
  }, [threadChanged]);

  useEffect(() => {
    setReloadThread(true);
  }, [router.pathname]);
  useEffect(() => {
    if (props.threadId) {
      setThreadId(props.threadId);
    }
  }, [props.threadId]);
  useEffect(() => {
    router.pathname == "/" && setPathName(router.pathname);
    if (user || customer) {
      getAllSeenThread(senderRole);
    }
  }, [router.pathname]);

  const getAllSeenThread = async (role) => {
    if (!role) return;

    await ThreadService.getThreadSeen(role != "CUSTOMER" && role != "SHOP" ? "STAFF" : role).then(
      (res) => {
        setThreadCount(res);
      }
    );
  };

  const setMessageBoxToggleStorage = () => {
    if (isOpenMessageBoxStorage === "true") {
      localStorage.removeItem("openMessageBox");
    } else {
      localStorage.setItem("openMessageBox", "true");
    }
    setIsOpenMessageBoxStorage(localStorage.getItem("openMessageBox"));
  };

  //Reload lại để cập nhật tin nhắn
  // useEffect(() => {
  //   clearInterval(intervalRef.current);

  //   intervalRef.current = setInterval(() => {
  //     getAllSeenThread(senderRole);
  //   }, 30000);
  //   return () => clearInterval(intervalRef.current);
  // }, [senderRole]);

  // useEffect(() => {
  //   if (senderId) {
  //     if (senderRole != "ADMIN") {
  //       ThreadMessageService.getAll({
  //         query: { limit: 0, filter: { threadId, seen: false } },
  //         fragment: "id",
  //       }).then((res) => {
  //         setunseenMessageCount(res.total);
  //       });
  //     }
  //     if (senderRole != "GLOBALCUSTOMER") {
  //       ThreadService.getAll({
  //         query: {
  //           limit: 0,
  //           filter: {
  //             ...(senderRole == "ADMIN" ? { userId: senderId } : { memberId: senderId }),
  //             seen: false,
  //           },
  //         },
  //         fragment: "id",
  //       }).then((res) => {
  //         setUnseenThreads([...res.data]);
  //       });
  //     }
  //   }
  // }, [senderId]);

  // useEffect(() => {
  //   if (threadStream) {
  //     if (threadStream.thread.id == threadId) {
  //       if (
  //         (senderRole == "MEMBER" && threadStream.message.sender.memberId != senderId) ||
  //         (senderRole == "GLOBALCUSTOMER" &&
  //           threadStream.message.sender.globalCustomerId != senderId)
  //       ) {
  //         setunseenMessageCount(unseenMessageCount + 1);
  //       }
  //     } else {
  //       if (
  //         (senderRole == "MEMBER" && threadStream.message.sender.memberId != senderId) ||
  //         (senderRole == "ADMIN" && threadStream.message.sender.userId != senderId)
  //       ) {
  //         let index = unseenThreads.findIndex((x) => x.id == threadStream.thread.id);
  //         if (index >= 0) {
  //           unseenThreads.splice(index, 1);
  //         }
  //         setUnseenThreads([...unseenThreads, { ...threadStream.thread }]);
  //       }
  //     }
  //   }
  // }, [threadStream]);

  // const onThreadSeen = (seenThreadId: string) => {
  //   if (seenThreadId == threadId) {
  //     if (unseenMessageCount > 0) {
  //       ThreadService.markThreadSeen(threadId).then(() => {
  //         setunseenMessageCount(0);
  //       });
  //     }
  //   } else {
  //     const index = unseenThreads.findIndex((x) => x.id == seenThreadId);
  //     if (index >= 0) {
  //       ThreadService.markThreadSeen(seenThreadId).then(() => {
  //         unseenThreads.splice(index, 1);
  //         setUnseenThreads([...unseenThreads]);
  //       });
  //     }
  //   }
  // };

  return (
    <ChatContext.Provider
      value={{
        unseenMessageCount,
        unseenThreads,
        unseenThreadCount: unseenThreads.length,
        threadId,
        setThreadId,
        // onThreadSeen,
        reloadThread,
        setReloadThread,
        threadCount,
        setThreadCount,
        threadChanged,
        loadReplyMessage,
        setLoadReplyMessage,
        openThread,
        setOpenThread,
        getAllSeenThread,
        setMessageBoxToggleStorage,
        isOpenMessageBoxStorage,
      }}
    >
      {props.children}
    </ChatContext.Provider>
  );
}

export const useChatContext = () => useContext(ChatContext);
