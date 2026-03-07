import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RiMenu3Line } from "react-icons/ri";
import { useScreen } from "../../../../../lib/hooks/useScreen";
import { useGlobalContext } from "../../../../../lib/providers/global-provider";
import { ScrollbarWidthDisplayButton } from "../../../../shared/common/scrollbard-display-button";
import { Button } from "../../../../shared/utilities/form";
import { ProductPrice } from "./product-price";
import { ProductPriceSort } from "./product-price-sort";
import { ProductSearchText } from "./product-search-text";

export function ProductSearch() {
  const { t } = useTranslation();
  const screenXl = useScreen("xl");
  const { setOpenSidebarSlideout } = useGlobalContext();
  const [showInput, setShowInput] = useState(false);

  return (
    <div className="relative gap-2 p-1.5 w-full bg-white rounded-md border">
      <div
        className={`flex gap-2 ${showInput ? "flex-col justify-start" : "flex-row items-center"}`}
      >
        <div className="flex flex-nowrap gap-x-1.5 items-center">
          {!screenXl && (
            <div className="pr-2 border-r-2 border-gray-200">
              <Button
                outline
                tooltip={t("Danh mục")}
                small
                icon={<RiMenu3Line />}
                className="p-0 w-8 h-8 text-xl rounded-md text-primary"
                onClick={() => setOpenSidebarSlideout?.(true)}
              />
            </div>
          )}

          {/* <ProductFilter /> */}
          <ProductSearchText showInput={showInput} setShowInput={setShowInput} />
        </div>

        <ScrollbarWidthDisplayButton>
          <div className="flex flex-nowrap gap-2 items-center">
            {/* <ProductSelectCategory /> */}
            {/* <ProductProperty /> */}
            <ProductPrice />
            <ProductPriceSort />
          </div>
        </ScrollbarWidthDisplayButton>
      </div>
    </div>
  );
}
