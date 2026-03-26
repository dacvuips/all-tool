import { useEffect, useRef, useState } from "react";
import {
  FlowNodeRunChangeEvent,
  ProductAppService,
} from "../repo/product/productApp.repo";

export function useFlowNodeRunChanged(customerId?: string, productId?: string) {
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const [flowNodeRunChanged, setFlowNodeRunChanged] =
    useState<FlowNodeRunChangeEvent | null>(null);

  useEffect(() => {
    if (!customerId) return;

    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    subscriptionRef.current = ProductAppService.subscribeFlowNodeRunChanged({
      customerId,
      productId,
    }).subscribe((res) => {
      setFlowNodeRunChanged(res);
    });

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [customerId, productId]);

  return flowNodeRunChanged;
}
