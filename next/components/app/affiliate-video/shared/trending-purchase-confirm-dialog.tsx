/**
 * Dialog xác nhận mua trending item bằng mPoint.
 * Hiển thị giá item, số dư ví hiện tại trước khi trừ tiền.
 */
import { useTranslation } from "react-i18next";
import { RiWallet3Line } from "react-icons/ri";

import Link from "next/link";
import { useRouter } from "next/router";
import { parseNumber } from "../../../../lib/helpers/parser";
import { TrendingPublicItem } from "../../../../lib/repo/list/trendingCategory.repo";
import { Dialog } from "../../../shared/utilities/dialog/dialog";
import { Button } from "../../../shared/utilities/form/button";

interface TrendingPurchaseConfirmDialogProps {
  isOpen: boolean;
  item: TrendingPublicItem | null;
  walletBalance?: number;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function TrendingPurchaseConfirmDialog({
  isOpen,
  item,
  walletBalance = 0,
  isLoading,
  onConfirm,
  onClose,
}: TrendingPurchaseConfirmDialogProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const price = item?.price || 0;
  const insufficient = walletBalance < price;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={t("Xác nhận mua item")} width={420}>
      <Dialog.Body>
        <div className="py-2 space-y-4">
          <p className="m-0 text-sm text-gray-600">
            {t(
              "Bạn cần thanh toán để sử dụng sản phẩm này. Mua một lần, dùng mãi. Số lượng mua không giới hạn."
            )}
          </p>

          {item && (
            <div className="p-3 bg-gray-50 rounded-xl border">
              <div className="font-semibold text-primary">{item.name}</div>
              <div className="mt-1 text-sm text-red-500">
                {t("Giá")}: {parseNumber(price, "VND")} mPoint
              </div>
            </div>
          )}

          <div className="flex gap-2 items-center p-3 bg-blue-50 rounded-xl border">
            <RiWallet3Line className="text-xl text-blue-500 shrink-0" />
            <div>
              <div className="text-xs text-gray-500">{t("Số dư mPoint hiện tại")}</div>
              <div className={`font-semibold ${insufficient ? "text-red-500" : "text-success"}`}>
                {parseNumber(walletBalance, "VND")} mPoint
              </div>
            </div>
          </div>

          {insufficient && (
            <p className="m-0 text-sm text-red-500">
              {t("Ví mPoint không đủ. Vui lòng nạp thêm mPoint.")}
              <Link href="/checkout?type=normal" className="text-blue-500">
                {t("Nạp mPoint")}
              </Link>
            </p>
          )}
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button
            className="px-4"
            text={t("Nạp mPoint")}
            onClick={() => router.push("/checkout?type=normal")}
            disabled={isLoading}
          />
          <Button
            primary
            className="px-4"
            text={t("Thanh toán & dùng ngay")}
            onClick={onConfirm}
            disabled={isLoading || insufficient}
            isLoading={isLoading}
          />
        </div>
      </Dialog.Body>
    </Dialog>
  );
}
