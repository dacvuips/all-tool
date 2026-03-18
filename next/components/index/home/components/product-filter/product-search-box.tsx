import { useState } from "react";
import { ScrollbarWidthDisplayButton } from "../../../../shared/common/scrollbard-display-button";
import { ProductPrice } from "./product-price";
import { ProductPriceSort } from "./product-price-sort";
import { ProductSearchText } from "./product-search-text";

export function ProductSearch() {
  const [showInput, setShowInput] = useState(false);

  return (
    <div className="relative gap-2 p-1.5 w-full bg-white rounded-md border">
      <div
        className={`flex gap-2 ${showInput ? "flex-col justify-start" : "flex-row items-center"}`}
      >
        <div className="flex flex-nowrap gap-x-1.5 items-center">
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
