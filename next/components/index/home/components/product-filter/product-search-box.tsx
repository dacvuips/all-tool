import { ScrollbarWidthDisplayButton } from "../../../../shared/common/scrollbard-display-button";
import { ProductFilter } from "./product-filter";

import { useState } from "react";
import { ProductPrice } from "./product-price";
import { ProductPriceSort } from "./product-price-sort";
import { ProductProperty } from "./product-property";
// ...existing imports...
import { ProductSearchText } from "./product-search-text";
import { ProductSelectCategory } from "./product-select-category";
export function ProductSearch() {
  const [showInput, setShowInput] = useState(false);

  return (
    <div className="relative w-full gap-2 p-2 mb-4 bg-white border rounded-md">
      <div className={`flex   gap-2 ${showInput ? "flex-col  justify-start" : "flex-row"}`}>
        <div className="flex gap-2 flex-nowrap">
          <ProductFilter />
          <ProductSearchText showInput={showInput} setShowInput={setShowInput} />
        </div>

        <ScrollbarWidthDisplayButton>
          <div className="flex items-center gap-2 flex-nowrap">
            <ProductSelectCategory />
            <ProductProperty />
            <ProductPrice />
            <ProductPriceSort />
          </div>
        </ScrollbarWidthDisplayButton>
      </div>
    </div>
  );
}
