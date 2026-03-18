import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineCreditCard, HiOutlineShieldExclamation } from "react-icons/hi";
import { MAX_SUGGESTED, ParamName, QUICK_AMOUNTS } from "../../../../lib/constants/constants";
import { parseNumber } from "../../../../lib/helpers/parser";
import { useQueryParams } from "../../../../lib/hooks/useQueryParams";
import { useToast } from "../../../../lib/providers/toast-provider";
import { SettingService } from "../../../../lib/repo";
import { orderService, PaymentMethod } from "../../../../lib/repo/order/order.repo";
import { NotifyText } from "../../../shared/common/notify-text";
import { Input, Label } from "../../../shared/utilities/form";
import { Button } from "../../../shared/utilities/form/button";
import { Spinner } from "../../../shared/utilities/misc";
import { useCheckoutContext } from "../provider/checkout-provider";
/**
 * Các phương thức thanh toán được hỗ trợ
 */

/**
 * Thông tin hiển thị cho từng phương thức thanh toán
 */

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

  const PAYMENT_METHOD_OPTIONS: {
    value: PaymentMethod;
    label: string;
    description: string;
    icon: string;
  }[] = [
    {
      value: PaymentMethod.SEPAY_PG,
      label: t("Cổng thanh toán"),
      description: t("Thanh toán nhanh qua thẻ ngân hàng, QR NAPAS, Internet Banking"),
      icon: "💳",
    },
  ];

  const [amount, setAmount] = useState<number>(amountFromParam);
  const [creditAmount, setCreditAmount] = useState<number>(amountFromParam);
  const [creditAmountSetting, setCreditAmountSetting] = useState<number>(0);

  // Phương thức thanh toán đang được chọn
  const [selectedPaymentType, setSelectedPaymentType] = useState<PaymentMethod>(
    PaymentMethod.SEPAY_PG
  );

  // Loading riêng cho SePay PG để tránh nhầm với loading tạo đơn chuyển khoản
  const [sePayLoading, setSePayLoading] = useState(false);

  const toast = useToast();
  const { order, loading } = useCheckoutContext();
  const suggestedAmounts = creditAmount > 0 ? getSuggestedAmounts(creditAmount) : [];
  const showQuickAmounts = suggestedAmounts.length > 0 ? suggestedAmounts : QUICK_AMOUNTS;

  // Lấy hệ số quy đổi credit → VND từ setting
  useEffect(() => {
    getCreditAmount();
  }, []);

  const getCreditAmount = async () => {
    const setting = await SettingService.getSettingByKey(
      "wa-mpoint-change-credit-balance",
      "value"
    );
    setCreditAmountSetting(setting.value);
  };

  const handleQuickAmount = (value: number) => {
    setCreditAmount((prev) => (prev === value ? 0 : value));
    calculateCreditAmount(Number(value) || 0);
  };

  const calculateCreditAmount = (value: number) => {
    setAmount(value * (creditAmountSetting as number));
  };

  // /** Thanh toán qua chuyển khoản ngân hàng */
  // const handleBankTransferCheckout = async () => {
  //   await createOrder(creditAmount);
  // };

  /** Thanh toán qua cổng SePay PG — tạo hidden form rồi auto-submit (POST) */
  const handleSePayPGCheckout = async () => {
    if (creditAmount <= 0) return;
    setSePayLoading(true);
    try {
      const data = await orderService.createSePayPGCheckout(creditAmount);

      const formFields: Record<string, string> = JSON.parse(data.formFieldsJson);

      const form = document.createElement("form");
      form.method = "POST";
      form.action = data.checkoutUrl;

      Object.entries(formFields).forEach(([name, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = String(value);
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      console.error("Lỗi tạo checkout:", err);
      toast.error("Không thể kết nối cổng thanh toán. Vui lòng thử lại.");
      setSePayLoading(false);
    }
  };

  /** Xử lý khi click nút thanh toán */
  const handleCheckout = async () => {
    handleSePayPGCheckout();
  };

  const isLoading = loading || sePayLoading;

  if (isLoading && !order) {
    return (
      <div className="flex flex-col min-h-[60vh] justify-center items-center pb-10 bg-gray-100">
        <Spinner />
        <p className="mt-2 text-sm text-gray-500">{`${t("Đang tạo đơn thanh toán")}...`}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[60vh] pb-10 bg-gray-100">
      <div className="container flex flex-col flex-1 justify-center items-center mx-auto">
        <div className="flex overflow-hidden flex-col gap-y-3 p-4 w-full max-w-md bg-white rounded-2xl border border-t-4 border-gray-200 shadow-sm border-t-primary">
          {/* Header */}
          <div className="flex flex-row items-start">
            <div className="flex flex-shrink-0 justify-center items-center w-6 h-6 rounded-full bg-primary/10">
              <HiOutlineShieldExclamation className="text-2xl text-green-500" />
            </div>
            <div className="ml-3">
              <h1 className="text-xl font-bold text-gray-800">{t("Thanh toán")}</h1>
            </div>
          </div>

          {/* Thông báo hệ số quy đổi */}
          <NotifyText
            text={t(`Hệ số chuyển đổi: 1 credit = ${parseNumber(creditAmountSetting, true)}`)}
          />

          {/* Nhập số credit */}
          <div>
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

          {/* Gợi ý số lượng credit nhanh */}
          <div className="flex flex-wrap gap-2">
            {showQuickAmounts.map((value) => (
              <Button
                key={value}
                onClick={() => handleQuickAmount(value)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  creditAmount === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-gray-300 bg-gray-50 text-gray-700 hover:border-primary"
                }`}
              >
                {parseNumber(value)}
              </Button>
            ))}
          </div>

          {/* Hiển thị tổng tiền */}
          <div className="flex gap-x-2 items-center w-full text-lg font-bold text-right text-red-700">
            <span className="text-sm text-gray-600">{`${t("Tổng thanh toán")}:`}</span>
            <span className="text-lg font-bold text-right text-red-700">
              {parseNumber(amount, true)}
            </span>
          </div>

          {/* Chọn phương thức thanh toán */}
          <div>
            <Label text={t("Phương thức thanh toán")} />
            <div className="flex flex-col gap-2">
              {PAYMENT_METHOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedPaymentType(option.value)}
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                    selectedPaymentType === option.value
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  {/* Radio indicator */}
                  <div
                    className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selectedPaymentType === option.value ? "border-primary" : "border-gray-400"
                    }`}
                  >
                    {selectedPaymentType === option.value && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  {/* Icon và nhãn */}
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">{option.icon}</span>
                      <span
                        className={`text-sm font-semibold ${
                          selectedPaymentType === option.value ? "text-primary" : "text-gray-800"
                        }`}
                      >
                        {t(option.label)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">{t(option.description)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Nút hành động */}
          <div className="pt-1">
            {selectedPaymentType === "SEPAY_PG" && sePayLoading ? (
              // Hiển thị thông báo đang chuyển hướng khi xử lý SePay PG
              <div className="flex gap-2 justify-center items-center py-3 w-full font-semibold text-center rounded-xl bg-primary/10 text-primary">
                <Spinner className="!w-5 !h-5" />
                <span>{t("Đang chuyển đến cổng thanh toán...")}</span>
              </div>
            ) : (
              <Button
                primary
                className="py-3 w-full font-semibold rounded-xl"
                text={
                  <>
                    {selectedPaymentType === "SEPAY_PG"
                      ? t("Thanh toán ngay")
                      : t("Thanh toán ngay")}
                    <span className="inline-block ml-1">›</span>
                  </>
                }
                onClick={handleCheckout}
                disabled={isLoading || creditAmount <= 0}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
