import _, { cloneDeep, isEqual } from "lodash";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "../../../lib/providers/toast-provider";

import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../lib/providers/auth-provider";
import { Customer, User } from "../../../lib/repo";
import { ThreadMessage, ThreadMessageService } from "../../../lib/repo/thread/thread-message.repo";
import { Thread, ThreadRole, ThreadService } from "../../../lib/repo/thread/thread.repo";
import { useChatContext } from "./chat-provider";

export const MessageContext = createContext<
  Partial<{
    threadId: string;
    thread: Thread;
    senderId: string;
    senderRole: ThreadRole;
    receiverRole: ThreadRole;
    sender: User | Customer;
    receiver: User | Customer;
    messages: ThreadMessage[];
    placeholderMessages: ThreadMessage[];
    loadThreadMessages: (loadNew?: boolean) => Promise<any>;
    loadingOlderMessages: boolean;
    total: number;
    latestMessageId: string;
    oldestMessageId: string;
    hasLoadedMessages: boolean;
    createThreadMessage: ({ text, attachment }: ThreadMessageType) => void;
    loading: boolean;
    confirmGameOrderOnThread: () => void;
  }>
>({});
interface ThreadMessageType {
  text: string;
  attachment: any;
}
export interface MessageProviderProps extends ReactProps {
  // threadId?: string;
  senderId?: string;
  senderRole?: ThreadRole;
  receiverRole?: ThreadRole;
  gameOrderId?: string;
}
export function MessageProvider({
  // threadId,
  senderId,
  senderRole,
  receiverRole,
  ...props
}: MessageProviderProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { threadId, reloadThread, setReloadThread, threadChanged } = useChatContext();
  const [thread, setThread] = useState<Thread>();
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>(undefined);
  const [placeholderMessages, setPlaceholderMessages] = useState<ThreadMessage[]>([]);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [latestMessageId, setLatestMessageId] = useState<string>();
  const [oldestMessageId, setOldestMessageId] = useState<string>();
  const [loading, setLoading] = useState<boolean>(false);
  const [total, setTotal] = useState<number>(0);
  const [createConfirmGameOrder, setCreateConfirmGameOrder] = useState<boolean>(false);
  const { user, customer, userPermission } = useAuth();
  const limit = 20;
  const toast = useToast();
  const hasLoadedMessages = useMemo(() => !!threadMessages, [threadMessages]);
  const setTimeoutRef = useRef(null);
  useEffect(() => {
    if (threadId) {
      ThreadService.getOne({ id: threadId }).then(setThread);
      if (setTimeoutRef.current) clearTimeout(setTimeoutRef.current);
      setTimeoutRef.current = setTimeout(() => {
        loadThreadMessages();
      }, 300);
    }
  }, [threadId, thread?.id]);

  useEffect(() => {
    if (reloadThread) {
      // setThreadMessages(null);

      setReloadThread(false);
    }
  }, [reloadThread]);
  const loadThreadMessages = async (loadNew: boolean = false) => {
    setReloadThread(false);

    const filter = { threadId: thread?.id };

    if (threadMessages?.length) {
      if (loadNew) {
        filter["_id"] = { $gt: threadMessages[0].id };
      } else {
        filter["_id"] = { $lt: threadMessages[threadMessages.length - 1].id };
        setLoadingOlderMessages(true);
      }
    }

    !!thread &&
      (await ThreadMessageService.getAll({
        query: {
          filter: {
            threadId: thread.id,
            isActive:
              router.pathname.startsWith("/admin") && userPermission("RETRIEVE_THREAD")
                ? undefined
                : true,
          },
          limit: loadNew ? 0 : limit,
          order: { _id: -1 },
        },
        cache: false,
      }).then((res) => {
        const data = cloneDeep(res.data);

        if (threadMessages) {
          if (loadNew) {
            const newData = data.filter((x) => !threadMessages.find((y) => y.id == x.id));
            if (newData.length) {
              setThreadMessages([...threadMessages, ...newData]);
              setTotal(total + newData.length);
              setLatestMessageId(newData[0].id);

              newData.forEach((data) => {
                const index = placeholderMessages.findIndex((x) =>
                  isEqual(
                    { text: x.text, attachment: x.attachment || null },
                    { text: data.text, attachment: data.attachment || null }
                  )
                );
                placeholderMessages.splice(index, 1);
              });
              setPlaceholderMessages([...placeholderMessages]);
            }
            setLoading(false);
          } else {
            if (data.length) {
              setTotal(res.total);
              setThreadMessages([...data]);
              setOldestMessageId(data[data.length - 1].id);
              setLoading(false);
            } else {
              setTotal(res.total);
              setThreadMessages([]);
              setLoading(false);
            }
          }
        } else {
          setTotal(res.total);
          setThreadMessages(data);
          setLoading(false);
        }
      }));
    setLoading(false);
    setLoadingOlderMessages(false);
  };

  const getActor = (role: ThreadRole) => {
    switch (role) {
      case "STAFF":
      case "ADMIN":
      case "PARTNER":
        return;
      case "CUSTOMER":
        if (!thread.customer) {
          const newThreadStaff = { role: "STAFF", ...thread.staff };
          return newThreadStaff;
        } else {
          _.set(thread.staff, "role", "CUSTOMER");
          return thread.customer;
        }
      default:
        if (!!thread.shop) {
          return { role: "SHOP", ...thread.shop };
        }
        if (!!thread.customer) {
          return { role: "CUSTOMER", ...thread.customer };
        }
    }
  };

  const sender = useMemo(() => {
    if (thread) {
      return getActor(senderRole);
    } else {
      return null;
    }
  }, [thread]);

  const receiver = useMemo(() => {
    if (thread) {
      return getActor(receiverRole);
    } else {
      return null;
    }
  }, [thread]);

  useEffect(() => {
    if (threadChanged && threadChanged.threadId === threadId) {
      loadThreadMessages(false);
    }
  }, [threadChanged]);

  const [sendingPlaceholderMessages, setSendingPlaceholderMessages] = useState(false);
  const createThreadMessage = ({ text, attachment }) => {
    placeholderMessages.push({ text, attachment: attachment || null, id: "" });
    setPlaceholderMessages([...placeholderMessages]);
  };

  useEffect(() => {
    if (placeholderMessages.length && !sendingPlaceholderMessages) {
      handelCreateThread();
    }
  }, [placeholderMessages]);

  const handelCreateThread = async () => {
    const index = placeholderMessages.findIndex((x) => !x.id);

    if (index === -1) return;

    setSendingPlaceholderMessages(true);
    const { text, attachment } = placeholderMessages[index];
    placeholderMessages[index].id = "sending";
    // console.log(text, JSON.parse(JSON.stringify(placeholderMessages)));

    await ThreadMessageService.create({
      data: { text, attachment, type: "general", threadId },
      clearStore: false,
    })
      .then(async (res) => {
        await loadThreadMessages();
      })
      .catch((err) => {
        toast.error(t("Không gửi được tin nhắn."));
      })
      .finally(() => {
        setSendingPlaceholderMessages(false);
      });
  };

  const messages = useMemo(
    () => (threadMessages ? threadMessages.slice().reverse() : null),
    [threadMessages]
  );
  const confirmGameOrderOnThread = async () => {
    setCreateConfirmGameOrder(true);
  };

  return (
    <MessageContext.Provider
      value={{
        threadId,
        thread,
        senderId,
        senderRole,
        receiverRole,
        sender,
        receiver,
        messages,
        placeholderMessages,
        loadThreadMessages,
        loadingOlderMessages,
        total,
        latestMessageId,
        oldestMessageId,
        hasLoadedMessages,
        createThreadMessage,
        loading,
        confirmGameOrderOnThread,
      }}
    >
      {props.children}
    </MessageContext.Provider>
  );
}

export const useMessageContext = () => useContext(MessageContext);
