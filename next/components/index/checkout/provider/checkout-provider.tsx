import { useRouter } from "next/router";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useAuth } from "../../../../lib/providers/auth-provider";
import {
  Order,
  OrderChangeEventEnum,
  orderService,
  PaymentMethod,
} from "../../../../lib/repo/order/order.repo";
import { Product } from "../../../../lib/repo/product/product.repo";
import { CheckoutStep } from "../../../../lib/repo/types";
import { OrderPaymentChangedDialog } from "../dialogs/order-payment-changed-dialog";

// Payment method option type
export interface PaymentMethodOption {
  value: PaymentMethod;
  label: string;
  image: string;
}

// Checkout context type
export interface CheckoutContextType {
  // Selected items

  selectProduct: Product | null;
  quality: number;
  selectPayment: PaymentMethodOption | null;

  // State
  step: CheckoutStep;
  order: Order | null;
  confirm: boolean;
  processOrder: boolean;
  openPopupNotify: boolean;
  discount: number;
  isGuest: boolean;

  // Setters

  setSelectProduct: (product: Product | null) => void;
  setQuality: (quality: number) => void;
  setStep: (step: CheckoutStep) => void;
  setOrder: (order: Order | null) => void;
  setConfirm: (value: boolean) => void;
  setSelectPayment: (payment: PaymentMethodOption | null) => void;

  setProcessOrder: (value: boolean) => void;
  setOpenPopupNotify: (value: boolean) => void;
  setDiscount: (value: number) => void;

  currentOrder: Order | null;
  loading: boolean;
  createOrder: (creditAmount: number) => Promise<{ order: Order }>;
  cancelOrder: (orderId: string, reason?: string) => Promise<Order>;
  getOneOrderByGuest: () => Promise<Order | null>;
}

export const CheckoutContext = createContext<CheckoutContextType | undefined>(undefined);

interface CheckoutProviderProps {
  children: ReactNode;
}

export function CheckoutProvider({ children }: CheckoutProviderProps) {
  const { customer } = useAuth();
  const router = useRouter();

  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);

  const [selectProduct, setSelectProduct] = useState<Product | null>(null);
  const [quality, setQuality] = useState<number>(1);
  const [selectPayment, setSelectPayment] = useState<PaymentMethodOption | null>(null);

  // State
  const [step, setStep] = useState<CheckoutStep>(CheckoutStep.SELECT_PRODUCT);
  const [order, setOrder] = useState<Order | null>(undefined);
  const [confirm, setConfirm] = useState<boolean>(false);
  const [processOrder, setProcessOrder] = useState<boolean>(false);
  const [openPopupNotify, setOpenPopupNotify] = useState<boolean>(false);
  const [discount, setDiscount] = useState<number>(0);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  // Determine if user is guest
  const isGuest = !customer;
  useEffect(() => {
    !!customer && getOneOrderByGuest();
  }, [router.pathname === "/checkout", customer]);

  useEffect(() => {
    if (!order) return;

    const subscription = orderService.subscribeOrderChanged(order.id).subscribe({
      next: async (res) => {
        // Xử lý các event từ socket và hiển thị dialog tương ứng
        switch (res.event) {
          case OrderChangeEventEnum.PAYMENT_CHANGED:
            // Cập nhật order và hiển thị dialog thông báo thay đổi thanh toán
            setOrder((prevOrder) => ({ ...prevOrder, ...res.data }));
            // Chỉ mở dialog nếu nó chưa được mở
            setShowPaymentDialog(true);
            break;
        }
      },
      error: (err) => {
        console.error("❌ Subscription error:", err);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [order?.id]);

  // Reset state when payment method changes
  useEffect(() => {
    if (selectPayment) {
      setSelectProduct(null);
      setQuality(1);
      setOrder(null);
    }
  }, [selectPayment]);

  const createOrder = async (creditAmount: number): Promise<{ order: Order }> => {
    setLoading(true);
    try {
      const result = await orderService.createOrder(creditAmount);
      setCurrentOrder(result.order);
      setOrder(result.order as unknown as Order | null);
      return result;
    } finally {
      setLoading(false);
    }
  };

  const cancelOrder = async (orderId: string, reason?: string): Promise<Order> => {
    setLoading(true);
    try {
      const order = await orderService.cancelOrder(orderId, reason);
      setCurrentOrder(order);
      return order;
    } finally {
      setLoading(false);
    }
  };

  const getOneOrderByGuest = async (): Promise<Order | null> => {
    setLoading(true);
    try {
      // get cookers by guests phone and email

      const orders = await orderService.getOneOrderByGuest();
      setOrder(orders as unknown as Order | null);

      return orders;
    } finally {
      setLoading(false);
    }
  };

  return (
    <CheckoutContext.Provider
      value={{
        selectProduct,
        quality,
        step,
        order,
        confirm,
        selectPayment,
        processOrder,
        openPopupNotify,
        discount,
        isGuest,

        setSelectProduct,
        setQuality,
        setStep,
        setOrder,
        setConfirm,
        setSelectPayment,
        setProcessOrder,
        setOpenPopupNotify,
        setDiscount,
        currentOrder,
        loading,
        createOrder,
        cancelOrder,
        getOneOrderByGuest,
      }}
    >
      {children}
      {/* Dialog thông báo khi thanh toán thay đổi */}
      {order && (
        <OrderPaymentChangedDialog
          isOpen={showPaymentDialog}
          onClose={() => setShowPaymentDialog(false)}
          order={order}
        />
      )}
    </CheckoutContext.Provider>
  );
}

export const useCheckoutContext = (): CheckoutContextType => {
  const context = useContext(CheckoutContext);
  if (!context) {
    throw new Error("useCheckoutContext must be used within CheckoutProvider");
  }
  return context;
};
