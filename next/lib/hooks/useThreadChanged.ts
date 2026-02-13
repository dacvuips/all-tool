import { useEffect, useRef, useState } from "react";
import { useAuth } from "../providers/auth-provider";
import { ThreadChange, ThreadService } from "../repo/thread/thread.repo";

export function useThreadChanged() {
  const { user, customer } = useAuth();
  const threadSubscription = useRef(null);
  const [threadChanged, setThreadChanged] = useState<ThreadChange>(null);

  useEffect(() => {
    // subscribe thread changed
    if (user || customer) {
      if (threadSubscription.current) {
        // unsubscribe old thread changed
        threadSubscription.current.unsubscribe();
      }
      threadSubscription.current = ThreadService.subscribeThreadChanged().subscribe((res) => {
        setThreadChanged(res);
      });
    }
    return () => {
      // unsubscribe thread changed
      if (threadSubscription.current) {
        threadSubscription.current.unsubscribe();
      }
    };
  }, [user, customer]);

  return threadChanged;
}
