import { cloneDeep } from "lodash";
import { createContext, Dispatch, SetStateAction, useContext, useEffect, useState } from "react";

import { useTranslation } from "react-i18next";
import { useScreen } from "../../../../lib/hooks/useScreen";
import { useThreadChanged } from "../../../../lib/hooks/useThreadChanged";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { useToast } from "../../../../lib/providers/toast-provider";
import { Thread, ThreadRole, ThreadService } from "../../../../lib/repo/thread/thread.repo";
import { Spinner } from "../../utilities/misc";
import { useChatContext } from "../chat-provider";

export const ConfirmBoxThreadContext = createContext<
  Partial<{
    selecThread: Thread;
    setSelectThread: Dispatch<SetStateAction<Thread>>;
    threads: Thread[];
    setThreads: (items: Thread[]) => any;
    total: number;
    senderId: string;
    senderRole: ThreadRole;
    receiverRole: ThreadRole;
    selectedThread: Thread;
    selectThread: (thread: Thread) => any;
    fetchThread: (id: string, selectAfterFetch?: boolean) => Promise<Thread>;
    loadMore: () => Promise<Thread[]>;
    threadCustomer: Thread[];
    setThreadCustomer: (value: Thread[]) => void;
    threadShop: Thread[];
    setThreadShop: (value: Thread[]) => void;
    loadThread: () => void;
  }>
>({});
interface Props extends ReactProps {
  senderRole: ThreadRole;
  receiverRole: ThreadRole;
  senderId: string;
  gameOrderId: string;
}
export function ConfirmBoxThreadProvider({
  senderId,
  senderRole,
  receiverRole,
  gameOrderId,
  ...props
}: Props) {
  const xs = useScreen("xs");
  const { t } = useTranslation();
  const [selectedThread, setSelectedThread] = useState<Thread>();
  const [threads, setThreads] = useState<Thread[]>();
  const { user } = useAuth();
  const [threadCustomer, setThreadCustomer] = useState<Thread[]>();
  const [threadShop, setThreadShop] = useState<Thread[]>();
  const [total, setTotal] = useState<number>(0);
  const toast = useToast();

  const { setThreadId, reloadThread, setReloadThread } = useChatContext();

  const threadChanged = useThreadChanged();
  useEffect(() => {
    loadThread();
  }, [threadChanged]);

  useEffect(() => {
    if (reloadThread) {
      loadThread();
    }
  }, [reloadThread]);

  const loadThread = async () => {
    setReloadThread(false);

    if (senderRole == "ADMIN" && user && gameOrderId) {
      ThreadService.getAllThreadGameOrder(gameOrderId, {
        query: {
          limit: 10,
          filter: { gameOrderId: gameOrderId },
          order: { updatedAt: -1 },
        },
        cache: false,
      })
        .then((res) => {
          setThreads(res.data);
        })
        .catch((err) => {});
      return;
    }
  };

  const loadMore = async () => {
    const res = await ThreadService.getAll({
      query: {
        limit: 10,
        order: { lastMessageAt: -1 },
        filter: { _id: { $nin: threads.map((x) => x.id) }, messageId: { $exists: true } },
      },
      toast,
      cache: false,
    });
    setThreads([...threads, ...cloneDeep(res.data)]);
    return res.data;
  };

  useEffect(() => {
    const threadId = localStorage.getItem("threadId");

    if (threadId) {
      const thread = threads?.find((x) => x.id.slice(-10) == threadId);
      if (thread) {
        selectThread(thread);
      } else {
        if (threads?.length > 0) {
          selectThread(threads[0]);
        }
      }
    } else {
      if (threads?.length > 0 && !selectedThread) {
        selectThread(threads[0]);
      }
    }
  }, [threads]);

  const selectThread = (thread: Thread) => {
    setSelectedThread(null);
    setThreadId(null);
    setTimeout(() => {
      setSelectedThread(thread);
      setThreadId(thread?.id);
      //localStorage
      if (thread) {
        // slice thread id to 15 character to end of string
        const threadId = thread.id.slice(-10);
        localStorage.setItem("threadId", threadId);
      } else {
        localStorage.removeItem("threadId");
      }
    });
  };
  // get threadId from localstorage

  const fetchThread = async (id: string, selectAfterFetch?: boolean, snippet?: string) => {
    const index = threads.findIndex((x) => x.id == id);
    if (index >= 0) {
      const item = threads[index];
      threads.splice(index, 1);
      threads.splice(0, 0, item);
      if (snippet) {
        item.snippet = snippet;
      }
      setThreads([...threads]);
      if (selectAfterFetch) selectThread(threads[0]);
      return threads[0];
    } else {
      try {
        const thread = await ThreadService.getOne({
          id,
          fragment: ThreadService.shortFragment,
          cache: false,
        });
        setThreads([cloneDeep(thread), ...threads]);
        if (selectAfterFetch) selectThread(thread);
        return thread;
      } catch (err) {
        console.error(err);
        toast.error(t("Không tìm thấy cuộc trò chuyện.") + err.message);
      }
    }
  };

  return (
    <ConfirmBoxThreadContext.Provider
      value={{
        threads,
        setThreads,
        total,
        loadMore,
        senderId,
        senderRole,
        receiverRole,
        selectedThread,
        selectThread,
        fetchThread,
        threadCustomer,
        setThreadCustomer,
        threadShop,
        setThreadShop,
        loadThread,
      }}
    >
      {threads ? <>{props.children}</> : xs ? <Spinner /> : ""}
    </ConfirmBoxThreadContext.Provider>
  );
}

export const useConfirmBoxThreadContext = () => useContext(ConfirmBoxThreadContext);
