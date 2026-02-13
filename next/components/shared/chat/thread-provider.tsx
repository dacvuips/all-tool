import _, { cloneDeep } from "lodash";
import { useRouter } from "next/router";
import {
  createContext,
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { WSClient } from "../../../lib/graphql/graphql-ws.link";
import { useScreen } from "../../../lib/hooks/useScreen";
import { useThreadChanged } from "../../../lib/hooks/useThreadChanged";
import { useAuth } from "../../../lib/providers/auth-provider";
import { useToast } from "../../../lib/providers/toast-provider";
import { Thread, ThreadRole, ThreadService } from "../../../lib/repo/thread/thread.repo";
import { Spinner } from "../utilities/misc";
import { useChatContext } from "./chat-provider";
interface Actor {
  name?: string;
  avatarUrl?: string;
}
export const ThreadContext = createContext<
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
    getActor: (params: { thread: Thread }) => Actor | undefined;
  }>
>({});
interface Props extends ReactProps {
  senderRole: ThreadRole;
  receiverRole: ThreadRole;
  senderId: string;
  gameOrderId: string;
}
export function ThreadProvider({
  senderId,
  senderRole,
  receiverRole,
  gameOrderId,
  ...props
}: Props) {
  const { t } = useTranslation();
  const xs = useScreen("xs");
  const router = useRouter();
  const [selectedThread, setSelectedThread] = useState<Thread>();
  const [threads, setThreads] = useState<Thread[]>();
  const { user, customer } = useAuth();
  const [threadCustomer, setThreadCustomer] = useState<Thread[]>();
  const [pathName, setPathName] = useState<string>();

  const [threadShop, setThreadShop] = useState<Thread[]>();
  const [total, setTotal] = useState<number>(0);
  const toast = useToast();
  const intervalRef = useRef(null);
  const { threadStream, setThreadId, reloadThread, setReloadThread } = useChatContext();
  const threadChanged = useThreadChanged();
  useEffect(() => {
    loadThread();
  }, [threadChanged]);
  useEffect(() => {
    if (reloadThread) {
      loadThread();
    }
  }, [reloadThread]);
  useEffect(() => {
    //Hành động này nhầm ngăn chặn load WSClient khi chuyển page từ customer sang shop bị lỗi role
    router.pathname == "/" && setPathName(router.pathname);
  }, [router.pathname]);
  useEffect(() => {
    //Hành động này nhầm ngăn chặn load WSClient khi chuyển page từ customer sang shop bị lỗi role
    if (pathName == "/" && router.pathname == "/shop") {
      WSClient.on("connected", () => {
        // console.log("ws reconnected");
        loadThread();
      });
    }
  }, [router.pathname]);

  const loadThread = async () => {
    setReloadThread(false);

    if (senderRole == "CUSTOMER" && customer) {
      await ThreadService.getAllThreadCustomer({
        query: { order: { updatedAt: -1 } },
        cache: false,
      })
        .then((res) => {
          setThreads(res.data);
        })
        .catch((err) => {});
      return;
    }

    if (senderRole == "STAFF" && user) {
      await ThreadService.getAllThreadStaff({
        query: {
          limit: 50,
          filter: { gameOrderId, status: "opening" },
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
  // useEffect(() => {
  //   ThreadService.getAll({
  //     query: {
  //       limit: 10,
  //       order: { lastMessageAt: -1 },
  //       filter: { messageId: { $exists: true } },
  //     },
  //     cache: false,
  //   }).then((res) => {
  //     console.log(res);
  //     setTotal(res.total);
  //     setThreads(cloneDeep(res.data));
  //   });
  // }, []);
  //Reload lại để cập nhật tin nhắn
  // useEffect(() => {
  //   if (intervalRef.current) clearInterval(intervalRef.current);
  //   intervalRef.current = setInterval(
  //     () => {
  //       setReloadThread(true);
  //     },
  //     threads?.length > 0 ? 30000 : 300000
  //   );
  // }, [threads?.length]);

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

  useEffect(() => {
    if (threadStream && threads) {
      fetchThread(threadStream.thread.id, false, threadStream.thread.snippet);
    }
  }, [threadStream]);

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

  const getActor = ({ thread }: { thread: Thread }) => {
    switch (receiverRole) {
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
          return { role: "SHOP", avatarUrl: thread.shop.info.logoUrl, ...thread.shop };
        }
        if (!!thread.customer) {
          return { role: "CUSTOMER", ...thread.customer };
        }
    }
  };

  return (
    <ThreadContext.Provider
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
        getActor,
      }}
    >
      {threads ? <>{props.children}</> : xs ? <Spinner /> : ""}
    </ThreadContext.Provider>
  );
}

export const useThreadContext = () => useContext(ThreadContext);
