import { useTranslation } from "react-i18next";
import StarRating from "../../../shared/utilities/star-rating/star-rating";
import { useProductDetailContext } from "../provider/product-detail-provider";

interface ProductRatingProps {
  averageRate?: number;
  reviewCount?: number;
  soldCount?: number;
}

export function ProductRating({
  averageRate = 0,
  reviewCount = 0,
  soldCount = 0,
}: ProductRatingProps) {
  const { t } = useTranslation();
  const { product } = useProductDetailContext();

  return (
    <div className="flex items-center gap-3 py-3 border-b flex-wrap">
      <div className="flex items-center gap-2">
        <StarRating defaultValue={averageRate} disabled quantity={5} />
        <span className="text-sm font-semibold text-gray-700">{averageRate.toFixed(1)}</span>
      </div>
      {reviewCount > 0 && (
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <span>({reviewCount.toLocaleString("vi-VN")}</span>
          <span>{t("đánh giá")})</span>
        </div>
      )}
      {soldCount > 0 && (
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <span>|</span>
          <span>{t("Đã bán")}:</span>
          <span className="font-semibold">{soldCount.toLocaleString("vi-VN")}</span>
        </div>
      )}
    </div>
  );
}

