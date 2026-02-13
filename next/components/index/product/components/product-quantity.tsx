import { useTranslation } from "react-i18next";
import { HiMinus, HiPlus } from "react-icons/hi";
import { useProductDetailContext } from "../provider/product-detail-provider";

const MIN_QUANTITY = 1;

export function ProductQuantity() {
  const { t } = useTranslation();
  const { quantity, setQuantity, maxStock } = useProductDetailContext();

  const availableStock = maxStock || 0;

  const handleDecrease = () => {
    const newValue = Math.max(MIN_QUANTITY, quantity - 1);
    setQuantity(newValue);
  };

  const handleIncrease = () => {
    const newValue = Math.min(availableStock || MIN_QUANTITY, quantity + 1);
    setQuantity(newValue);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || MIN_QUANTITY;
    const clampedValue = Math.max(
      MIN_QUANTITY,
      Math.min(availableStock || MIN_QUANTITY, value)
    );
    setQuantity(clampedValue);
  };

  return (
    <div className="flex flex-col gap-2 py-4 border-b">
      <span className="text-sm font-semibold text-gray-700">{t("Số lượng")}:</span>
      <div className="flex items-center gap-3">
        <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={handleDecrease}
            disabled={quantity <= MIN_QUANTITY}
            className="px-3 py-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <HiMinus className="w-5 h-5" />
          </button>
          <input
            type="number"
            value={quantity}
            onChange={handleChange}
            min={MIN_QUANTITY}
            max={availableStock}
            className="w-16 px-3 py-2 text-center border-0 focus:outline-none focus:ring-0"
          />
          <button
            type="button"
            onClick={handleIncrease}
            disabled={availableStock > 0 ? quantity >= availableStock : false}
            className="px-3 py-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <HiPlus className="w-5 h-5" />
          </button>
        </div>
        <span className="text-sm text-gray-600">
          {availableStock > 0
            ? `${availableStock} ${t("sản phẩm có sẵn")}`
            : t("Hết hàng")}
        </span>
      </div>
    </div>
  );
}

