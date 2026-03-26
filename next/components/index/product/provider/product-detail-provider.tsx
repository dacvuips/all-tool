import { useRouter } from "next/router";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ProductApp, ProductAppService } from "../../../../lib/repo/product/productApp.repo";

export type ProductMediaItem = {
  type: "video" | "image";
  url: string;
  optionCode?: string;
};

type ScrollToImageHandler = (imageUrl: string, optionCode?: string) => void;

type ProductPricing = {
  price: number | null;
  maxPrice: number | null;
  originalPrice: number | null;
  showPriceRange: boolean;
  discountPercent: number;
  stock: number;
};

interface ProductDetailContextValue {
  product?: ProductApp;
  loading: boolean;
  quantity: number;
  setQuantity: (value: number) => void;
  selectedOptions: Record<string, string>;
  handleOptionSelect: (tierCode: string, optionCode: string) => void;
  selectedVariant?: any;
  variantImageUrl?: string | null;
  productMedia: ProductMediaItem[];
  registerScrollToImage: (handler: ScrollToImageHandler) => void;
  scrollToImage: ScrollToImageHandler;
  maxStock: number;
  pricing: ProductPricing;
}

const defaultPricing: ProductPricing = {
  price: null,
  maxPrice: null,
  originalPrice: null,
  showPriceRange: false,
  discountPercent: 0,
  stock: 0,
};

const calculateDiscountPercent = (original: number | null, price: number | null) => {
  if (original == null || price == null || original <= price) return 0;
  return Math.round(((original - price) / original) * 100);
};

export const ProductDetailContext = createContext<ProductDetailContextValue>({
  loading: false,
  quantity: 1,
  setQuantity: () => undefined,
  selectedOptions: {},
  handleOptionSelect: () => undefined,
  productMedia: [],
  registerScrollToImage: () => undefined,
  scrollToImage: () => undefined,
  maxStock: 0,
  pricing: defaultPricing,
});

export function ProductDetailProvider({ ...props }) {
  const router = useRouter();
  const scrollToImageRef = useRef<ScrollToImageHandler>();

  const [product, setProduct] = useState<ProductApp>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  const slug = router.query.slug as string;

  useEffect(() => {
    !!slug && GetOneProductSlug();
  }, [slug]);

  const GetOneProductSlug = async () => {
    setLoading(true);
    await ProductAppService.getProductSlug(slug)
      .then((res) => {
        setProduct(res);
      })
      .catch((err) => {
        console.error("Error fetching product:", err);
        setProduct(null);
      })
      .finally(() => setLoading(false));
  };

  // Initialize default selected options when product changes
  useEffect(() => {
    if (!product?.classification?.tiers) {
      setSelectedOptions({});
      return;
    }
    const defaults: Record<string, string> = {};
    product.classification.tiers.forEach((tier) => {
      if (tier?.options?.length) {
        defaults[tier.code] = tier.options[0].code;
      }
    });
    setSelectedOptions(defaults);
  }, [product?.id]);

  // Reset quantity to 1 whenever selectedOptions change (Classifications changed)
  useEffect(() => {
    setQuantity(1);
  }, [selectedOptions]);

  const handleOptionSelect = (tierCode: string, optionCode: string) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [tierCode]: optionCode,
    }));

    const tier = product?.classification?.tiers?.find((t) => t.code === tierCode);
    const option = tier?.options?.find((opt) => opt.code === optionCode);
    if (option?.imageUrl) {
      scrollToImageRef.current?.(option.imageUrl, option.code);
    }
  };

  const selectedVariant = useMemo(() => {
    if (!product?.classification?.variants?.length || !product?.classification?.tiers?.length)
      return null;

    const optionCodes = product.classification.tiers
      .map((tier) => selectedOptions[tier.code])
      .filter(Boolean);

    if (optionCodes.length !== product.classification.tiers.length) return null;

    return product.classification.variants.find((variant) =>
      optionCodes.every((code) => variant.optionCodes.includes(code))
    );
  }, [product, selectedOptions]);

  const variantImageUrl = useMemo(() => {
    if (!selectedVariant || !product?.classification?.tiers) return null;

    for (const tier of product.classification.tiers) {
      const selectedOption = tier.options?.find((opt) =>
        selectedVariant.optionCodes.includes(opt.code)
      );
      if (selectedOption?.imageUrl) return selectedOption.imageUrl;
    }
    return null;
  }, [product, selectedVariant]);

  const productMedia = useMemo<ProductMediaItem[]>(() => {
    const media: ProductMediaItem[] = [];
    const added = new Set<string>();

    const addMedia = (item: ProductMediaItem) => {
      if (!item?.url || added.has(item.url)) return;
      media.push(item);
      added.add(item.url);
    };

    if (product?.video) addMedia({ type: "video", url: product.video });

    // product?.classification?.tiers?.forEach((tier: ProductTier) => {
    //   tier.options?.forEach((option) => {
    //     if (option.imageUrl) {
    //       addMedia({ type: "image", url: option.imageUrl, optionCode: option.code });
    //     }
    //   });
    // });

    if (variantImageUrl) addMedia({ type: "image", url: variantImageUrl });

    if (product?.coverImg) addMedia({ type: "image", url: product.coverImg });

    product?.imgs?.forEach((img) => addMedia({ type: "image", url: img }));

    return media;
  }, [product, variantImageUrl]);

  const pricing = useMemo<ProductPricing>(() => {
    const classification = product?.classification;
    if (!classification) return defaultPricing;

    const hasTiers = !!classification.tiers?.length;
    const minPrice = product?.minPrice ?? null;
    const maxPriceValue = product?.maxPrice ?? null;
    const originalPrice = classification.originalPrice ?? null;
    const totalStock = classification.totalStock ?? 0;

    if (!hasTiers) {
      const price = originalPrice;
      return {
        price,
        maxPrice: price,
        originalPrice,
        showPriceRange: false,
        discountPercent: 0,
        stock: totalStock,
      };
    }

    if (selectedVariant) {
      const variantPrice = selectedVariant.price ?? null;
      const variantStock = selectedVariant.stock ?? totalStock;
      const discountPercent = calculateDiscountPercent(originalPrice, variantPrice);

      return {
        price: variantPrice,
        maxPrice: variantPrice,
        originalPrice,
        showPriceRange: false,
        discountPercent,
        stock: variantStock,
      };
    }

    const resolvedMinPrice = minPrice ?? maxPriceValue ?? originalPrice;
    const resolvedMaxPrice = maxPriceValue ?? minPrice ?? originalPrice;
    const showPriceRange =
      resolvedMinPrice != null && resolvedMaxPrice != null && resolvedMinPrice !== resolvedMaxPrice;

    const discountPercent = !showPriceRange
      ? calculateDiscountPercent(originalPrice, resolvedMinPrice)
      : 0;

    return {
      price: resolvedMinPrice,
      maxPrice: resolvedMaxPrice,
      originalPrice,
      showPriceRange,
      discountPercent,
      stock: totalStock,
    };
  }, [product?.classification, selectedVariant, selectedOptions]);

  const registerScrollToImage = (handler: ScrollToImageHandler) => {
    scrollToImageRef.current = handler;
  };

  const scrollToImage: ScrollToImageHandler = (imageUrl, optionCode) => {
    scrollToImageRef.current?.(imageUrl, optionCode);
  };

  const maxStock = pricing.stock ?? 0;

  return (
    <ProductDetailContext.Provider
      value={{
        product,
        loading,
        quantity,
        setQuantity,
        selectedOptions,
        handleOptionSelect,
        selectedVariant,
        variantImageUrl,
        productMedia,
        registerScrollToImage,
        scrollToImage,
        maxStock,
        pricing,
      }}
    >
      {props.children}
    </ProductDetailContext.Provider>
  );
}

export const useProductDetailContext = () => useContext(ProductDetailContext);
