import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineCreditCard, HiOutlineShieldExclamation } from "react-icons/hi";
import { parseNumber } from "../../../../lib/helpers/parser";
import { NotifyText } from "../../../shared/common/notify-text";
import { Label } from "../../../shared/utilities/form";
import { Button } from "../../../shared/utilities/form/button";

const QUICK_AMOUNTS = [10000, 50000, 100000, 500000];
const MAX_SUGGESTED = 10_000_000;

/** Tạo các đề xuất "thêm số 0" từ số đã nhập: ví dụ 5 → [50, 500, 5000, 50000] */
function getSuggestedAmounts(base: number): number[] {
  if (base <= 0) return [];
  const suggested: number[] = [];
  let next = base * 10;
  while (next <= MAX_SUGGESTED && next > base) {
    suggested.push(next);
    next *= 10;
  }
  return suggested;
}

export function CheckoutPaymentForm() {
  const { t } = useTranslation();
  const [amount, setAmount] = useState<number>(0);

  const suggestedAmounts = amount > 0 ? getSuggestedAmounts(amount) : [];
  const showQuickAmounts = suggestedAmounts.length > 0 ? suggestedAmounts : QUICK_AMOUNTS;

  const handleQuickAmount = (value: number) => {
    setAmount((prev) => (prev === value ? 0 : value));
  };

  const handlePayNow = () => {
    // TODO: tích hợp flow thanh toán thực tế
  };

  return (
    <div className="flex flex-col min-h-[60vh] pb-10 bg-gray-100">
      <div className="container flex flex-col flex-1 justify-center items-center mx-auto">
        <div className="flex overflow-hidden flex-col gap-y-2 p-4 w-full max-w-md bg-white rounded-2xl border border-t-4 border-gray-200 shadow-sm border-t-primary">
          {/* Header */}
          <div className="flex flex-row items-start">
            <div className="flex flex-shrink-0 justify-center items-center w-12 h-12 rounded-full bg-primary/10">
              <HiOutlineShieldExclamation className="text-2xl text-green-500" />
            </div>
            <div className="ml-3">
              <h1 className="text-xl font-bold text-gray-800">{t("Thanh toán")}</h1>
              <p className="mt-0.5 text-sm text-gray-500">
                INV_{new Date().toISOString().slice(0, 10).replace(/-/g, "")}_DEMO
              </p>
            </div>
          </div>

          {/* Warning - Sandbox */}
          <NotifyText
            text={t(
              "Đây là mô phỏng thanh toán (sandbox). Bạn có thể thử thao tác như thanh toán thật, nhưng không mất tiền thật."
            )}
          />

          {/* Amount input */}
          <div className="pb-4">
            <Label text={t("Nhập số credit cần nạp")} />
            <div className="flex overflow-hidden items-center w-full bg-white rounded-xl border border-gray-300 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
              <span className="flex flex-shrink-0 justify-center items-center pl-4 text-gray-400">
                <HiOutlineCreditCard />
              </span>
              <input
                type="number"
                min={0}
                step={1000}
                placeholder={t("Nhập số credit...")}
                value={amount > 0 ? amount : ""}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                className="flex-1 py-3 pr-2 pl-3 placeholder-gray-400 text-gray-800 border-0 focus:ring-0 focus:outline-none"
              />
              <span className="flex-shrink-0 pr-4 text-sm text-gray-500">{t("credit")}</span>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              {parseNumber(amount)}
              {"VND"}
            </p>
          </div>

          {/* Quick amount buttons: mặc định hoặc đề xuất "thêm số 0" theo số đã nhập */}
          <div className="flex flex-wrap gap-2 pb-4">
            {showQuickAmounts.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => handleQuickAmount(value)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  amount === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-gray-300 bg-white text-gray-700 hover:border-primary"
                }`}
              >
                {parseNumber(value)}
              </button>
            ))}
          </div>

          {/* CTA */}
          <div className="pt-0">
            <Button
              primary
              className="py-3 w-full font-semibold rounded-xl"
              text={
                <>
                  {t("Thanh toán ngay")}
                  <span className="inline-block ml-1">›</span>
                </>
              }
              onClick={handlePayNow}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
