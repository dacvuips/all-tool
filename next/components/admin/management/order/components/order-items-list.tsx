import { useTranslation } from "react-i18next";
import { Order } from "../../../../../lib/repo";
import { OrderSection } from "./order-section";

interface OrderItemsListProps {
  order: Order;
}

export function OrderItemsList({ order }: OrderItemsListProps) {
  const { t } = useTranslation();

  return (
    <OrderSection title={`Danh sách sản phẩm (${order?.items?.length || 0} ${t("sản phẩm")})`}>
      {/* Desktop Table View */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">STT</th>
              <th className="px-3 py-2 text-left">{t("Tên sản phẩm")}</th>
              <th className="px-3 py-2 text-center">{t("Phân loại")}</th>

              <th className="px-3 py-2 text-center">{t("Số lượng")}</th>
              <th className="px-3 py-2 text-right">{t("Đơn giá")}</th>
              <th className="px-3 py-2 text-right">{t("Thành tiền")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {order?.items?.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-3 py-3">{idx + 1}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    {item.thumbnail && (
                      <img
                        src={item.thumbnail}
                        alt={item.productName}
                        className="object-cover w-12 h-12 rounded"
                      />
                    )}
                    <div>
                      <div className="font-medium">{item.productName}</div>
                      {item.sku && <div className="text-xs text-gray-500">SKU: {item.sku}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-center">{item.variantName?.split("/")[0] || "-"}</td>

                <td className="px-3 py-3 text-center">{item.quantity}</td>
                <td className="px-3 py-3 text-right">
                  <div className="font-medium">{item.price?.toLocaleString()} đ</div>
                  {item.originalPrice && item.originalPrice > item.price && (
                    <div className="text-xs text-gray-500 line-through">
                      {item.originalPrice?.toLocaleString()} đ
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 font-semibold text-right">
                  {item.subtotal?.toLocaleString()} đ
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="space-y-3 md:hidden">
        {order?.items?.map((item, idx) => (
          <div key={idx} className="p-3 border rounded bg-gray-50">
            <div className="flex gap-3">
              {item.thumbnail && (
                <img
                  src={item.thumbnail}
                  alt={item.productName}
                  className="object-cover w-16 h-16 rounded"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{item.productName}</div>
                <div className="text-xs text-gray-600">
                  {item.variantName && <span>{item.variantName}</span>}
                  {item.sku && <span className="ml-2">SKU: {item.sku}</span>}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="text-sm text-gray-600">x {item.quantity}</div>
                  <div className="text-right">
                    <div className="font-semibold text-primary">
                      {item.price?.toLocaleString()}đ
                    </div>
                    {item.originalPrice && item.originalPrice > item.price && (
                      <div className="text-xs text-gray-500 line-through">
                        {item.originalPrice?.toLocaleString()}đ
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-between pt-2 mt-2 text-sm border-t">
              <span className="text-gray-600">{t("Thành tiền")}:</span>
              <span className="font-semibold">{item.subtotal?.toLocaleString()}đ</span>
            </div>
          </div>
        ))}
      </div>
    </OrderSection>
  );
}
