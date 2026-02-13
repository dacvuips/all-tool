import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { Product } from "../../../../lib/repo";
import { Img } from "../../../shared/utilities/misc";

interface OrderItemCardProps {
  item: {
    thumbnail?: string;
    productName: string;
    variantName?: string;
    quantity: number;
    price: number;
    originalPrice?: number;
    subtotal: number;
  };
  product: Product;
}

export function OrderItemCard({ item, product }: OrderItemCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  return (
    <div className="flex gap-4 p-2 transition-colors border border-dashed rounded-lg bg-gray-50 hover:bg-gray-100">
      <div className="flex-shrink-0">
        <Img
          showImageOnClick
          src={item.thumbnail}
          className="object-cover w-12 h-12 rounded-lg"
          alt={item.productName}
        />
      </div>
      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          router.push(`/${product.slug}`);
        }}
      >
        <h5 className="mb-1 font-medium text-gray-900 truncate hover:underline hover:text-primary">
          {item.productName}
        </h5>

        <div className="flex-col items-center justify-between sm:flex-row sm:flex">
          {item.variantName && (
            <div className="mb-1 text-sm text-gray-600">
              {t("Phân loại")}: {item.variantName} {`(${t("Số lượng")}: ${item.quantity})`}
            </div>
          )}
          <div className="text-right">
            {item.originalPrice > item.price && (
              <span className="block text-xs text-gray-400 line-through">
                {formatCurrency(item.originalPrice)}
              </span>
            )}
            <span className="font-bold text-primary">{formatCurrency(item.price)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
