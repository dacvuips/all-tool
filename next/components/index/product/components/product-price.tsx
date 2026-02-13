import { useTranslation } from "react-i18next";
import { useProductDetailContext } from "../provider/product-detail-provider";

export function ProductPrice() {
  const { t } = useTranslation();
  const { pricing } = useProductDetailContext();
  const { price, maxPrice, originalPrice, showPriceRange, discountPercent } = pricing;

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value);
  };

  if (price == null && maxPrice == null) return null;

  const resolvedPrice = price ?? 0;

  const savings =
    !showPriceRange && originalPrice != null && price != null ? originalPrice - price : 0;

  return (
    <div className="flex flex-col gap-2 py-4 border-b">
      <div className="flex flex-wrap gap-3 items-baseline">
        {showPriceRange ? (
          <>
            <span className="text-3xl font-bold text-primary lg:text-4xl">
              {formatPrice(price)} - {formatPrice(maxPrice)}
            </span>
          </>
        ) : (
          <>
            <span className="text-3xl font-bold text-primary lg:text-4xl">
              {formatPrice(resolvedPrice)}
            </span>
            {originalPrice != null && originalPrice > resolvedPrice && (
              <>
                <span className="text-lg text-gray-400 line-through lg:text-xl">
                  {formatPrice(originalPrice)}
                </span>
                {discountPercent > 0 && (
                  <span className="px-2 py-1 text-sm font-semibold text-white bg-red-500 rounded">
                    -{discountPercent}%
                  </span>
                )}
              </>
            )}
          </>
        )}
      </div>
      {discountPercent > 0 && !showPriceRange && (
        <div className="text-sm text-gray-600">
          {t("Tiết kiệm")}: {formatPrice(savings)}
        </div>
      )}
    </div>
  );
}
