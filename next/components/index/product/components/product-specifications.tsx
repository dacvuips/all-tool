import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AccordionGroup } from "../../../shared/utilities/misc/accordion-group";
import { useHomeContext } from "../../home/provider/home-provider";
import { useProductDetailContext } from "../provider/product-detail-provider";

export function ProductSpecifications() {
  const { t } = useTranslation();
  const { product } = useProductDetailContext();
  const { categories } = useHomeContext();

  // Check if product has category properties
  if (!product?.categoryProperties || Object.keys(product.categoryProperties).length === 0) {
    return null;
  }

  const specifications = product.categoryProperties;

  // Find the product's category to get property labels
  const productCategory = categories?.find((cat) => cat.id === product.categoryId);

  return (
    <div className="py-4">
      <AccordionGroup
        title={t("Thông tin sản phẩm")}
        description={t("Thông tin chi tiết và thông số kỹ thuật")}
      >
        <div className="-m-5 overflow-hidden bg-white ">
          <div className="divide-y divide-gray-200">
            {Object.entries(specifications).map(([key, value], index) => {
              // Find the corresponding property in category to get the label
              const property = productCategory?.properties?.find((prop) => prop.key === key);

              // Use label from category if available, otherwise format the key
              const displayLabel =
                property?.label ||
                key
                  .split(/(?=[A-Z])/)
                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(" ");

              // Format the value based on its type
              let displayValue = value;

              // Handle SELECT and MULTI_SELECT types
              if (property?.type === "SELECT" && typeof value === "string") {
                const selectedOption = property.options?.find((opt) => opt.key === value);
                displayValue = selectedOption?.label || value;
              } else if (property?.type === "MULTI_SELECT" && Array.isArray(value)) {
                const labels = value.map((val) => {
                  const selectedOption = property.options?.find((opt) => opt.key === val);
                  return selectedOption?.label || val;
                });
                displayValue = labels.join(", ");
              } else if (typeof value === "boolean") {
                displayValue = value ? t("Có") : t("Không");
              } else if (value === null || value === undefined) {
                displayValue = t("Không có thông tin");
              } else if (typeof value === "object") {
                displayValue = JSON.stringify(value);
              }

              return (
                <div
                  key={key}
                  className={`flex flex-row px-4 py-3 ${
                    index % 2 === 0 ? "bg-gray-50" : "bg-white"
                  } hover:bg-gray-100 transition-colors`}
                >
                  <div className="font-semibold w-36">{displayLabel}:</div>
                  <div className="text-gray-900">
                    {typeof displayValue === "string" && displayValue.startsWith("http") ? (
                      <Link
                        href={displayValue}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {t("Xem liên kết")}
                      </Link>
                    ) : (
                      displayValue
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </AccordionGroup>
    </div>
  );
}
