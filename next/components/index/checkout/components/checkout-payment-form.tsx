import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineCreditCard, HiOutlineShieldExclamation } from "react-icons/hi";
import { ParamName } from "../../../../lib/constants/constants";
import { parseNumber } from "../../../../lib/helpers/parser";
import { useQueryParams } from "../../../../lib/hooks/useQueryParams";
import { SettingService } from "../../../../lib/repo";
import { NotifyText } from "../../../shared/common/notify-text";
import { Input, Label } from "../../../shared/utilities/form";
import { Button } from "../../../shared/utilities/form/button";
import { Spinner } from "../../../shared/utilities/misc";
import { useCheckoutContext } from "../provider/checkout-provider";

const QUICK_AMOUNTS = [10, 100, 1000, 10000];
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
  const [queryParams] = useQueryParams({
    [ParamName.creditAmount]: "",
  });
  const amountFromParam = Number(queryParams[ParamName.creditAmount]) || 0;
  const [amount, setAmount] = useState<number>(amountFromParam);
  const [creditAmount, setCreditAmount] = useState<number>(amountFromParam);
  const { order, loading, createOrder } = useCheckoutContext();
  const [creditAmountSetting, setCreditAmountSetting] = useState<number>(0);
  const suggestedAmounts = creditAmount > 0 ? getSuggestedAmounts(creditAmount) : [];
  const showQuickAmounts = suggestedAmounts.length > 0 ? suggestedAmounts : QUICK_AMOUNTS;

  const handleQuickAmount = (value: number) => {
    setCreditAmount((prev) => (prev === value ? 0 : value));
    calculateCreditAmount(Number(value) || 0);
  };
  // get setting creditAmount from setting service
  useEffect(() => {
    getCreditAmount();
  }, []);
  const getCreditAmount = async () => {
    const creditAmount = await SettingService.getSettingByKey(
      "wa-mpoint-change-credit-balance",
      "value"
    );
    setCreditAmountSetting(creditAmount.value);
  };

  const handleCreateOrder = async () => {
    await createOrder(creditAmount, order?.id as string);
  };
  const calculateCreditAmount = (amount: number) => {
    setAmount(amount * (creditAmountSetting as number));
  };

  if (loading && !order) {
    return (
      <div className="flex flex-col min-h-[60vh] justify-center items-center pb-10 bg-gray-100">
        <Spinner />
        <p className="mt-2 text-sm text-gray-500">{t("Đang tạo đơn thanh toán...")}</p>
      </div>
    );
  }

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
              <p className="mt-0.5 text-sm font-medium text-primary">{order?.orderNumber}</p>
            </div>
          </div>

          {/* Warning - Sandbox */}
          <NotifyText
            text={t(`Hệ số chuyển đổi: 1 credit = ${parseNumber(creditAmountSetting, true)}`)}
          />

          {/* Amount input */}
          <div className="">
            <Label text={t("Số credit")} />
            <div className="flex overflow-hidden items-center w-full bg-white rounded-xl border border-gray-300 focus-within:border-primary">
              <Input
                number
                numberLength={10}
                placeholder={t("Nhập số credit cần nạp...")}
                value={creditAmount === 0 ? "" : creditAmount}
                showZeroDefaultValue
                onChange={(e) => {
                  const raw = e;
                  if (raw === "") {
                    setCreditAmount(0);
                    calculateCreditAmount(0);
                  } else {
                    const num = Number(raw);
                    if (!Number.isNaN(num) && num >= 0) {
                      setCreditAmount(num);
                      calculateCreditAmount(num);
                    }
                  }
                }}
                controlClassName=""
                className="flex-1 py-3 pr-2 pl-3 placeholder-gray-400 text-gray-800 border-0 focus:ring-0 focus:outline-none"
                prefix={<HiOutlineCreditCard />}
                suffix={
                  <span className="flex-shrink-0 pr-4 text-sm text-gray-500">{t("credit")}</span>
                }
              />
            </div>
          </div>

          {/* Quick amount buttons: mặc định hoặc đề xuất "thêm số 0" theo số đã nhập */}
          <div className="flex flex-wrap gap-2">
            {showQuickAmounts.map((value) => (
              <Button
                key={value}
                onClick={() => handleQuickAmount(value)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  amount === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-gray-300 bg-gray-50 bg-white text-gray-700 hover:border-primary"
                }`}
              >
                {parseNumber(value)}
              </Button>
            ))}
          </div>
          <div className="flex gap-x-2 items-center mt-2 w-full text-lg font-bold text-right text-red-700">
            <span className="text-sm text-gray-600">{`${t("Tổng thanh toán")}:`}</span>
            <span className="text-lg font-bold text-right text-red-700">
              {parseNumber(amount, true)}
            </span>
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
              onClick={handleCreateOrder}
              disabled={loading || !order}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
