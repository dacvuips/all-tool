import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiArrowLeft } from "react-icons/hi";
import { RiSecurePaymentLine } from "react-icons/ri";
import { parseNumber } from "../../../../lib/helpers/parser";
import { useToast } from "../../../../lib/providers/toast-provider";
import { orderService } from "../../../../lib/repo/order/order.repo";
import { Input, Label } from "../../../shared/utilities/form";
import { Button } from "../../../shared/utilities/form/button";
import { Spinner } from "../../../shared/utilities/misc";
import { useCheckoutContext } from "../provider/checkout-provider";
import {
  getAmountSuggestions,
  NORMAL_CHECKOUT_MAX,
  NORMAL_CHECKOUT_MIN,
  parseAmountInput,
  validateNormalAmount,
} from "../utils/amount-suggestions";

export function CheckoutNormalPaymentForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { loading, setOrder } = useCheckoutContext();
  const [redirecting, setRedirecting] = useState(false);

  const [amountInput, setAmountInput] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkingPending, setCheckingPending] = useState(true);

  const parsedAmount = useMemo(() => parseAmountInput(amountInput), [amountInput]);

  const suggestions = useMemo(() => {
    if (!parsedAmount || parsedAmount <= 0) return [];
    return getAmountSuggestions(parsedAmount);
  }, [parsedAmount]);

  // Khôi phục đơn NORMAL pending (riêng cho trang nạp tiền, không qua getOneOrderByGuest)
  useEffect(() => {
    let cancelled = false;
    orderService
      .getPendingNormalOrder()
      .then((pending) => {
        if (!cancelled && pending) {
          setOrder(pending);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCheckingPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [setOrder]);

  const handleAmountChange = (value: string) => {
    setAmountInput(value);
    const parsed = parseAmountInput(value);
    if (!value.trim()) {
      setAmountError(null);
      return;
    }
    if (parsed === null || parsed <= 0) {
      setAmountError(t("Vui lòng nhập số tiền hợp lệ"));
      return;
    }
    setAmountError(validateNormalAmount(parsed));
  };

  const handleSuggestionClick = (amount: number) => {
    setAmountInput(amount.toString());
    setAmountError(validateNormalAmount(amount));
  };

  const submitSePayPGForm = (data: { checkoutUrl: string; formFieldsJson: string }) => {
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
  };

  const handleSubmit = async () => {
    const error = validateNormalAmount(parsedAmount);
    if (error) {
      setAmountError(error);
      return;
    }

    setSubmitting(true);
    setRedirecting(true);
    try {
      const data = await orderService.createNormalSePayPGCheckout(parsedAmount!);
      submitSePayPGForm(data);
    } catch (err: any) {
      console.error("createNormalSePayPGCheckout error:", err);
      toast.error(err?.message || t("Không thể kết nối cổng thanh toán. Vui lòng thử lại."));
      setSubmitting(false);
      setRedirecting(false);
    }
  };

  if (checkingPending || loading) {
    return (
      <div className="flex flex-col min-h-[60vh] justify-center items-center pb-10 bg-gray-100">
        <Spinner />
      </div>
    );
  }

  const isValid = parsedAmount !== null && !validateNormalAmount(parsedAmount);

  return (
    <div className="flex flex-col min-h-[60vh] pb-10 bg-gray-100">
      <div className="sticky top-14 z-40 bg-white shadow-sm">
        <div className="flex gap-4 items-center px-6 py-3 mx-auto max-w-screen-xl">
          <div
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-700 no-underline transition-colors hover:text-primary cursor-pointer"
          >
            <HiArrowLeft className="text-base" />
            <span>{t("Quay lại")}</span>
          </div>
          <div className="w-px h-5 bg-gray-300" />
          <div className="flex gap-2 items-center">
            <RiSecurePaymentLine className="text-xl text-green-500" />
            <h1 className="m-0 text-base font-bold text-gray-800">{t("Nạp mPoint")}</h1>
          </div>
        </div>
        <div className="h-[3px] bg-gradient-to-r from-green-500 via-green-600 to-green-300" />
      </div>

      <div className="container flex flex-col flex-1 justify-center items-center pt-4 mx-auto">
        <div className="flex overflow-hidden flex-col gap-y-4 p-4 w-full max-w-lg bg-white rounded-2xl border border-t-4 border-gray-200 shadow-sm border-t-primary">
          <div>
            <Label text={t("Số tiền nạp (VNĐ)")} />
            <Input
              number
              currency
              value={amountInput}
              onChange={handleAmountChange}
              placeholder={`${NORMAL_CHECKOUT_MIN.toLocaleString(
                "vi-VN"
              )} - ${NORMAL_CHECKOUT_MAX.toLocaleString("vi-VN")}`}
              className="w-full"
            />
            <p className="mt-1 text-xs text-gray-500">
              {t("Từ")} {parseNumber(NORMAL_CHECKOUT_MIN, true)} —{" "}
              {parseNumber(NORMAL_CHECKOUT_MAX, true)}
            </p>
            {amountError && <p className="mt-1 text-xs text-red-600">{amountError}</p>}

            {suggestions.length > 0 && !amountError && (
              <div className="flex flex-wrap gap-2 mt-3">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="px-3 py-1.5 text-xs font-semibold text-primary bg-primary/5 rounded-lg border border-primary/20 transition-colors hover:bg-primary/10"
                  >
                    {parseNumber(suggestion, true)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isValid && (
            <div className="flex gap-x-2 items-center w-full text-lg font-bold text-right text-red-700">
              <span className="text-sm text-gray-600">{`${t("Tổng thanh toán")}:`}</span>
              <span>{parseNumber(parsedAmount, true)}</span>
            </div>
          )}

          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-sm font-semibold text-gray-800">{t("Phương thức thanh toán")}</p>
            <p className="mt-1 text-xs text-gray-600">
              {t("Cổng thanh toán — Thẻ ngân hàng, QR NAPAS, Internet Banking")}
            </p>
          </div>

          <div className="pt-1">
            {redirecting ? (
              <div className="flex flex-col gap-2 justify-center items-center py-3 w-full font-semibold text-center rounded-xl bg-primary/10 text-primary">
                <Spinner className="!w-5 !h-5" />
                <span className="whitespace-nowrap">{`${t(
                  "Đang chuyển đến cổng thanh toán"
                )}...`}</span>
              </div>
            ) : (
              <Button
                primary
                className="py-3 w-full font-semibold rounded-xl"
                text={
                  submitting ? (
                    <span className="flex gap-2 justify-center items-center whitespace-nowrap">
                      <Spinner className="!w-5 !h-5" />
                      {t("Đang tạo đơn...")}
                    </span>
                  ) : (
                    <>
                      {t("Thanh toán ngay")}
                      <span className="inline-block ml-1">›</span>
                    </>
                  )
                }
                onClick={handleSubmit}
                disabled={submitting || !isValid}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
