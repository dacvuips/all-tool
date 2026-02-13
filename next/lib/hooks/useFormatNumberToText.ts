import { useTranslation } from "react-i18next";
import { parseNumber } from "../helpers/parser";

export const useFormatNumberToText = () => {
  const { t } = useTranslation();
  const formatNumberToText = (value: number) => {
    if (value >= 1000000000) {
      // Nếu lớn hơn hoặc bằng 1 tỷ
      return (value / 1000000000).toFixed(1) + t("tỷ");
    } else if (value >= 1000000) {
      // Nếu lớn hơn hoặc bằng 1 triệu
      return (value / 1000000).toFixed(1) + t("triệu");
    }
    // Nếu nhỏ hơn 1 triệu, trả về số gốc
    return parseNumber(value);
  };

  return { formatNumberToText };
};
