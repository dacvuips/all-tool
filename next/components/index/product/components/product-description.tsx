import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiChevronDown, HiChevronUp } from "react-icons/hi";
import { useProductDetailContext } from "../provider/product-detail-provider";

export function ProductDescription() {
  const { t } = useTranslation();
  const { product } = useProductDetailContext();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!product?.des) return null;

  const description = product.des;
  const shouldTruncate = description.length > 200;
  const displayText =
    isExpanded || !shouldTruncate ? description : `${description.slice(0, 200)}...`;

  return (
    <div className="py-4 border-b">
      <h3 className="mb-3 text-lg font-semibold text-gray-800">{t("Mô tả sản phẩm")}</h3>
      <div
        className="leading-relaxed text-gray-700 whitespace-pre-wrap"
        dangerouslySetInnerHTML={{ __html: displayText }}
      ></div>
      {shouldTruncate && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex gap-1 items-center mt-2 transition-colors text-primary hover:text-primary-dark"
        >
          {isExpanded ? (
            <>
              <span>{t("Thu gọn")}</span>
              <HiChevronUp className="w-5 h-5" />
            </>
          ) : (
            <>
              <span>{t("Xem thêm")}</span>
              <HiChevronDown className="w-5 h-5" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
