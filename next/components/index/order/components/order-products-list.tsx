import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Product } from "../../../../lib/repo";
import { Button } from "../../../shared/utilities/form";
import { OrderItemCard } from "./order-item-card";

interface OrderProductsListProps {
  items: any[];
  product?: Product;
}

export function OrderProductsList({ items, product }: OrderProductsListProps) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);

  const displayItems = showAll ? items : items.slice(0, 1);

  return (
    <div>
      <div className="space-y-3">
        {displayItems.map((item, index) => (
          <OrderItemCard key={index} item={item} product={product} />
        ))}
      </div>

      {items.length > 1 && (
        <Button onClick={() => setShowAll(!showAll)} className="w-full">
          {showAll ? (
            <>
              <i className="mr-2 fas fa-chevron-up"></i>
              {t("Thu gọn")}
            </>
          ) : (
            <>
              <i className="mr-2 fas fa-chevron-down"></i>
              {t("Xem thêm")} ({items.length - 1} {t("sản phẩm")})
            </>
          )}
        </Button>
      )}
    </div>
  );
}
