/**
 * Hook quản lý luồng mua + sử dụng trending item bằng mPoint.
 *
 * Luồng:
 * 1. Item miễn phí / tab "Của tôi" (owner) → gọi useTrendingItem trực tiếp
 * 2. Đã mua (có order PAID) → gọi useTrendingItem trực tiếp, không confirm
 * 3. Chưa mua + có giá → hiện dialog xác nhận → useTrendingItem → refresh wallet
 */
import { useCallback, useRef, useState } from "react";

import { useHomeLayoutContext } from "../../../../layouts/home-layout/provider/home-layout-provider";
import {
  TrendingPublicItem,
  TrendingPurchaseStatus,
  UseTrendingItemResult,
} from "../../../../lib/repo/list/trendingCategory.repo";
import { useAffiliateVideoApi } from "../hook/useAffiliateVideoApi";

import { useTranslation } from "react-i18next";
import { TrendingPurchaseConfirmDialog } from "./trending-purchase-confirm-dialog";

type PendingUseCallback = (result: UseTrendingItemResult | null) => void;

export function useTrendingPurchaseFlow() {
  const { useTrendingItem, getMyTrendingPurchases } = useAffiliateVideoApi();
  const { wallet, refreshWallet } = useHomeLayoutContext();

  /** Map trendingId → thông tin đơn PAID (dùng hiển thị badge "Đã mua") */
  const [purchaseMap, setPurchaseMap] = useState<Record<string, TrendingPurchaseStatus>>({});
  const [confirmItem, setConfirmItem] = useState<TrendingPublicItem | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const pendingCallbackRef = useRef<PendingUseCallback | null>(null);

  /** Batch load trạng thái mua sau khi load danh sách item */
  const loadPurchasesForItems = useCallback(
    async (items: TrendingPublicItem[]) => {
      const paidCandidates = items.filter((item) => (item.price || 0) > 0);
      if (!paidCandidates.length) return;

      const purchases = await getMyTrendingPurchases(paidCandidates.map((i) => i.id));
      if (!purchases.length) return;

      setPurchaseMap((prev) => {
        const next = { ...prev };
        purchases.forEach((p) => {
          next[p.trendingId] = p;
        });
        return next;
      });
    },
    [getMyTrendingPurchases]
  );

  const isPurchased = useCallback(
    (trendingId: string) => !!purchaseMap[trendingId]?.orderId,
    [purchaseMap]
  );

  const isFreeItem = useCallback((item: TrendingPublicItem) => (item.price || 0) <= 0, []);

  /** Gọi API useTrendingItem và cập nhật purchaseMap + wallet */
  const executeUseTrendingItem = useCallback(
    async (trendingId: string): Promise<UseTrendingItemResult | null> => {
      const result = await useTrendingItem(trendingId);
      if (!result) return null;

      if (result.charged) {
        refreshWallet?.();
      }

      if (result.orderId) {
        setPurchaseMap((prev) => ({
          ...prev,
          [trendingId]: {
            trendingId,
            orderId: result.orderId!,
            status: "PAID",
            price: result.chargedAmount,
          },
        }));
      }

      return result;
    },
    [useTrendingItem, refreshWallet]
  );

  /** Có cần hiện dialog xác nhận thanh toán không */
  const needsPaymentConfirm = useCallback(
    (item: TrendingPublicItem, isOwnItem = false) =>
      !isOwnItem && !isFreeItem(item) && !isPurchased(item.id),
    [isFreeItem, isPurchased]
  );

  /**
   * Entry point khi user bấm "Dùng ngay".
   * @param isOwnItem true nếu item thuộc tab "Của tôi" (owner miễn phí)
   */
  const requestUse = useCallback(
    async (item: TrendingPublicItem, isOwnItem = false): Promise<UseTrendingItemResult | null> => {
      if (needsPaymentConfirm(item, isOwnItem)) {
        return new Promise((resolve) => {
          pendingCallbackRef.current = resolve;
          setConfirmItem(item);
        });
      }
      return executeUseTrendingItem(item.id);
    },
    [needsPaymentConfirm, executeUseTrendingItem]
  );

  const handleConfirmPurchase = useCallback(async () => {
    if (!confirmItem) return;
    setIsPurchasing(true);
    try {
      const result = await executeUseTrendingItem(confirmItem.id);
      pendingCallbackRef.current?.(result);
      pendingCallbackRef.current = null;
      setConfirmItem(null);
    } catch {
      pendingCallbackRef.current?.(null);
      pendingCallbackRef.current = null;
    } finally {
      setIsPurchasing(false);
    }
  }, [confirmItem, executeUseTrendingItem]);

  const handleCloseConfirm = useCallback(() => {
    pendingCallbackRef.current?.(null);
    pendingCallbackRef.current = null;
    setConfirmItem(null);
  }, []);

  const PurchaseConfirmDialog = (
    <TrendingPurchaseConfirmDialog
      isOpen={!!confirmItem}
      item={confirmItem}
      walletBalance={wallet?.balance || 0}
      isLoading={isPurchasing}
      onConfirm={handleConfirmPurchase}
      onClose={handleCloseConfirm}
    />
  );

  return {
    purchaseMap,
    isPurchased,
    loadPurchasesForItems,
    requestUse,
    PurchaseConfirmDialog,
  };
}

/** Badge hiển thị trạng thái đã mua trên card item */
export function TrendingPurchaseBadge({
  orderId,
  className = "",
}: {
  orderId?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  if (!orderId) return null;

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-10 font-semibold text-success bg-green-50 border border-green-200 rounded-md whitespace-nowrap ${className}`}
      title={`Order: ${orderId}`}
    >
      ✓ {t("Paid")}
    </span>
  );
}
