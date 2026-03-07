import { ScrollbarWidthDisplayButton } from "../../../../shared/common/scrollbard-display-button";
import { ProductFilter } from "./product-filter";

import { useState } from "react";
import { ProductPrice } from "./product-price";
import { ProductPriceSort } from "./product-price-sort";
// ...existing imports...
import { ProductSearchText } from "./product-search-text";
export function ProductSearch() {
  const [showInput, setShowInput] = useState(false);

  return (
    <div className="relative gap-2 p-2 mb-4 w-full bg-white rounded-md border">
      <div className={`flex   gap-2 ${showInput ? "flex-col justify-start" : "flex-row"}`}>
        <div className="flex flex-nowrap gap-2">
          <ProductFilter />
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
