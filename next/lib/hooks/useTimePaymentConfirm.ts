import { useEffect, useState } from "react";

export function useTimePaymentConfirm(code: string, localStorageField: string) {
  const getLocalStorage = localStorage.getItem(localStorageField) == `"${code}"`;
  const [timePaymentConfirm, setTimePaymentConfirm] = useState<number>(0);
  useEffect(() => {
    if (timePaymentConfirm > 0) {
      setTimeout(() => {
        setTimePaymentConfirm(timePaymentConfirm - 1);
      }, 1000);
    }
  }, [timePaymentConfirm]);
  useEffect(() => {
    getLocalStorage && setTimePaymentConfirm(120);
  }, []);
  return [setTimePaymentConfirm, timePaymentConfirm] as [(value: number) => void, number];
}
