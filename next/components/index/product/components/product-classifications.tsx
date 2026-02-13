import { useTranslation } from "react-i18next";
import { Img } from "../../../shared/utilities/misc";
import { useProductDetailContext } from "../provider/product-detail-provider";

export function ProductClassifications() {
  const { t } = useTranslation();
  const { product, selectedOptions, handleOptionSelect } = useProductDetailContext();

  const tiers = product?.classification?.tiers || [];
  const variants = product?.classification?.variants || [];

  if (!tiers.length) return null;

  return (
    <div className="flex flex-col gap-4 py-4 border-b">
      {tiers.map((tier) => (
        <div key={tier.code} className="flex flex-col gap-2">
          <div className="flex gap-2 items-center">
            <span className="text-sm font-semibold text-gray-700">{tier.name}:</span>
            {selectedOptions[tier.code] && (
              <span className="text-sm text-gray-600">
                {tier.options.find((opt) => opt.code === selectedOptions[tier.code])?.name}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {tier.options.map((option) => {
              const isSelected = selectedOptions[tier.code] === option.code;
              const isAvailable = variants.some((variant) =>
                variant.optionCodes.includes(option.code)
              );

              return (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => handleOptionSelect(tier.code, option.code)}
                  disabled={!isAvailable}
                  className={`
                    relative px-4 py-2 text-sm font-medium rounded-lg border-2 transition-all
                    ${
                      isSelected
                        ? "text-white border-primary bg-primary"
                        : "text-gray-700 bg-white border-gray-300 hover:border-primary hover:bg-primary hover:bg-opacity-10"
                    }
                    ${!isAvailable ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                  `}
                >
                  {option.imageUrl && (
                    <div className="overflow-hidden absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full border-2 border-white">
                      <Img
                        src={option.imageUrl}
                        alt={option.name}
                        className="object-cover w-full h-full"
                      />
                    </div>
                  )}
                  {option.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
