import Link from "next/link";
import { useTranslation } from "react-i18next";
import { BsCashCoin } from "react-icons/bs";
import { HiChevronDown } from "react-icons/hi";
import { Button } from "../../../shared/utilities/form";
import { Img, Spinner } from "../../../shared/utilities/misc";
import { useHomeContext } from "../provider/home-provider";

export function HomeProducts() {
  const { t } = useTranslation();
  const { products, loading, loadingMore, loadMore } = useHomeContext();

  if (loading) {
    return (
      <div className="p-4 w-full bg-white rounded-lg">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:gap-3">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="mb-2 bg-gray-200 rounded-lg aspect-square"></div>
              <div className="mb-2 h-4 bg-gray-200 rounded"></div>
              <div className="w-3/4 h-6 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <div className="p-3 w-full bg-white rounded-lg sm:p-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:gap-3">
        {products.map((product) => {
          const creditCostTotal = product.creditCostTotal || 0;
          return (
            <Link
              key={product.id}
              href={`/${product.slug}`}
              className="flex overflow-hidden flex-col bg-white rounded-lg border border-gray-200 transition-shadow duration-200 group hover:border-primary"
            >
              {/* Product Image */}
              <div className="overflow-hidden relative w-full bg-gray-100 aspect-square">
                {product.coverImg ? (
                  <Img
                    src={product.coverImg}
                    alt={product.name}
                    className="w-full h-full"
                    imageClassName="absolute top-0 left-0 object-cover w-full h-full transition-transform duration-200 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex justify-center items-center w-full h-full text-gray-400">
                    <span className="text-3xl">📦</span>
                  </div>
                )}

                {/* Discount Badge */}
                {/* {discount && discount > 0 && (
                  <div className="absolute top-0 right-0 bg-red-500 text-white text-xs sm:text-sm font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-bl-lg">
                    -{discount}%
                  </div>
                )} */}

                {/* Badges - Optional */}
                <div className="flex absolute top-2 left-2 flex-col gap-1">
                  {/* Add badges here if needed, e.g., "Trả chậm 0%", etc. */}
                </div>
              </div>

              {/* Product Info */}
              <div className="flex flex-col flex-1 p-2 sm:p-3">
                {/* Product Name */}
                <h3 className="text-xs sm:text-sm text-gray-800 line-clamp-2 mb-1 sm:mb-2 min-h-[32px] sm:min-h-[40px] group-hover:text-blue-600">
                  {product.name}
                </h3>

                {/* Price Section */}
                <div className="flex flex-col gap-0.5 sm:gap-1 mt-auto">
                  <div className="flex gap-1 items-baseline sm:gap-2">
                    <div className="flex gap-1 items-center text-xs text-primary">
                      <BsCashCoin />
                      {creditCostTotal > 0 ? creditCostTotal + " " + t("Credit") : t("Miễn phí")}
                    </div>
                  </div>

                  {/* Original Price */}
                  {/* {originalPrice && originalPrice > minPrice && (
                    <div className="flex gap-1 items-center sm:gap-2">
                      <span className="text-xs text-gray-400 line-through">
                        {formatPrice(originalPrice)}
                      </span>
                      <span className="text-xs font-medium text-red-500">-{discount}%</span>
                    </div>
                  )} */}
                </div>

                {/* Rating and Sales - Optional */}
                {/* <div className="flex gap-2 items-center mt-2 text-xs text-gray-500">
                  <div className="flex items-center gap-0.5">
                    <span className="text-yellow-400">★</span>
                    <span>4.9</span>
                  </div>
                  <span className="text-gray-300">|</span>
                  <span>Đã bán 17.3k</span>
                </div> */}

                {/* Additional Info - Optional */}
                {/* <div className="mt-1 text-xs text-gray-600 sm:mt-2">
                  <div className="text-gray-500 truncate">Made in Japan</div>
                </div> */}

                {/* Delivery Badge - Optional */}
                {/* <div className="flex gap-1 items-center mt-1 text-xs sm:mt-2">
                  <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">
                    NOW
                  </span>
                  <span className="text-gray-600">Giao siêu tốc 2h</span>
                </div> */}
              </div>
            </Link>
          );
        })}
      </div>

      {loadMore && (
        <div className="flex justify-center mt-8">
          <Button
            onClick={() => loadMore()}
            disabled={loading || loadingMore}
            icon={loadingMore ? <Spinner className="w-4 h-4" /> : <HiChevronDown />}
            iconPosition="end"
          >
            {loadingMore ? (
              <span className="flex gap-2 items-center">{t("Đang tải")}...</span>
            ) : (
              t("Tải thêm")
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
