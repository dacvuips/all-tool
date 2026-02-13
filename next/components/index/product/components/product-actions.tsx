import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiPhotograph, HiShoppingBag, HiShoppingCart } from "react-icons/hi";
import { useCart } from "../../../../lib/providers/cart-provider";

import { useToast } from "../../../../lib/providers/toast-provider";
import { guestService } from "../../../../lib/repo/guest/guest.repo";
import { Button } from "../../../shared/utilities/form";
import { useProductDetailContext } from "../provider/product-detail-provider";
import { TryOnDialog } from "./try-on-dialog";

// Helper function to get variant option names from option codes
const getVariantOptionNames = (optionCodes?: string[], tiers?: any[]): string => {
  if (!optionCodes || !tiers || optionCodes.length === 0) {
    return "";
  }

  const optionNames: string[] = [];

  for (const code of optionCodes) {
    // Search through all tiers to find the option with matching code
    for (const tier of tiers) {
      if (tier.options) {
        const option = tier.options.find((opt: any) => opt.code === code);
        if (option) {
          optionNames.push(option.name);
          break; // Found the option, move to next code
        }
      }
    }
  }

  return optionNames.join(" - ");
};

export function ProductActions() {
  const { t } = useTranslation();
  const router = useRouter();
  const { product, maxStock, variantImageUrl, quantity, selectedVariant, pricing } =
    useProductDetailContext();
  const { addToCart } = useCart();

  const toast = useToast();
  const [showTryOnDialog, setShowTryOnDialog] = useState(false);
  const [loading, setLoading] = useState(false);
 const [guestLimit, setGuestLimit] = useState<number | null>(null);

 // Fetch guest limit when dialog opens
  useEffect(() => {
    getGuestLimit();
  }, []);

  const getGuestLimit = async() => {
    try {
       guestService.getGuestTryOnLimit().then((limit) => {
        setGuestLimit(limit);
      });
    } catch (error) {
      console.error("Get guest limit error:", error);
    }
  };


  const handleAddToCart = async () => {
    if (!product) return;

    try {
      setLoading(true);

      const variantName = getVariantOptionNames(
        selectedVariant?.optionCodes,
        product.classification?.tiers
      );

      await addToCart({
        productId: product.id,
        variantId: selectedVariant?.code,
        sku: selectedVariant?.sku || product.otherInfo?.sku,
        productName: product.name,
        variantName: variantName || undefined,
        thumbnail: variantImageUrl || product.coverImg,
        price: pricing.price || 0,
        originalPrice: pricing.originalPrice,
        quantity: quantity,
        maxQuantity: maxStock,
      });

      toast.success(t("Đã thêm vào giỏ hàng"));
    } catch (error) {
      console.error("Add to cart error:", error);
      toast.error(t("Không thể thêm vào giỏ hàng"));
    } finally {
      setLoading(false);
    }
  };

  const handleBuyNow = async () => {
    if (!product) return;

    try {
      setLoading(true);

      const variantName = getVariantOptionNames(
        selectedVariant?.optionCodes,
        product.classification?.tiers
      );

      // Add to cart
      await addToCart({
        productId: product.id,
        variantId: selectedVariant?.code,
        sku: selectedVariant?.sku || product.otherInfo?.sku,
        productName: product.name,
        variantName: variantName || undefined,
        thumbnail: variantImageUrl || product.coverImg,
        price: pricing.price || 0,
        originalPrice: pricing.originalPrice,
        quantity: quantity,
        maxQuantity: maxStock,
      });

      toast.success(t("Đã thêm vào giỏ hàng"));

      // Redirect to cart page
      router.push("/cart");
    } catch (error) {
      console.error("Add to cart error:", error);
      toast.error(t("Không thể thêm vào giỏ hàng"));
    } finally {
      setLoading(false);
    }
  };

  const handleTryOn = () => {
    setShowTryOnDialog(true);
  };

  const isAvailable = (maxStock || 0) > 0;

  return (
    <>
      <div className="flex flex-col gap-3 py-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            outline
            className="flex-1 py-3 text-base font-semibold transition-colors border-2 border-primary text-primary hover:bg-gray-100 hover:text-gray-50"
            icon={<HiShoppingCart className="w-5 h-5" />}
            text={t("Thêm vào giỏ hàng")}
            onClick={handleAddToCart}
            disabled={!isAvailable || loading}
            isLoading={loading}
          />
          <Button
            primary
            className="flex-1 py-3 text-base font-semibold transition-colors bg-primary hover:bg-primary-dark"
            icon={<HiShoppingBag className="w-5 h-5" />}
            text={t("Mua ngay")}
            onClick={handleBuyNow}
            disabled={!isAvailable || loading}
            isLoading={loading}
          />
        </div>
        <Button
          accent
          className="w-full py-3 text-base font-semibold text-white transition-colors border-2 border-accent hover:bg-blue-900 hover:text-white"
          icon={<HiPhotograph className="w-5 h-5" />}
          text={`${t("Thử đồ ngay")} (${t("Còn")} ${guestLimit} ${t("lượt")})`}
          onClick={handleTryOn}
        />
        {!isAvailable && (
          <div className="text-sm text-center text-red-600">{t("Sản phẩm hiện đang hết hàng")}</div>
        )}
      </div>
      <TryOnDialog
        isOpen={showTryOnDialog}
        onClose={() => setShowTryOnDialog(false)}
        productImage={variantImageUrl || product?.coverImg}
        guestLimit={guestLimit}
        setGuestLimit={setGuestLimit}
      />
    </>
  );
}
