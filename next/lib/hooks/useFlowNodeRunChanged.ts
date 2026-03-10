import { useEffect, useRef, useState } from "react";
import {
  FlowNodeRunChangeEvent,
  ProductService,
} from "../repo/product/product.repo";

export function useFlowNodeRunChanged(customerId?: string, productId?: string) {
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const [flowNodeRunChanged, setFlowNodeRunChanged] =
    useState<FlowNodeRunChangeEvent | null>(null);

  useEffect(() => {
    if (!customerId) return;

    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    subscriptionRef.current = ProductService.subscribeFlowNodeRunChanged({
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
