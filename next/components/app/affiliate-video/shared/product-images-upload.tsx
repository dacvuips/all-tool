/**
 * Upload ảnh sản phẩm tham chiếu — UI giống ElementImagesUpload, tối đa 5 ảnh.
 * Đồng bộ productImageRefs (lưu base64) và productImages (URL/data URL cho panel phải).
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { ElementFormImage } from "../constants";
import { ElementImagesUpload } from "../elements/sibar/element-images-upload";
import { elementFormImageToDataUrl } from "../elements/utils/elementFormImageUtils";

export const PRODUCT_IMAGE_UPLOAD_MAX = 5;

export type ProductImagesPatch = {
  productImageRefs?: ElementFormImage[];
  productImages?: string[];
};

function legacyUrlsToRefs(urls: string[] | undefined): ElementFormImage[] {
  if (!urls?.length) return [];
  return urls.filter(Boolean).map((url, index) => {
    const dataMatch = url.match(/^data:([^;]+);base64,(.+)$/);
    if (dataMatch) {
      return {
        fifeUrl: "",
        imageBytes: dataMatch[2],
        mimeType: dataMatch[1],
        name: `product-${index + 1}`,
      };
    }
    return {
      fifeUrl: url,
      imageBytes: "",
      mimeType: "image/jpeg",
      name: `product-${index + 1}`,
    };
  });
}

export function productImageRefsToUrls(refs: ElementFormImage[] | undefined): string[] | undefined {
  if (!refs?.length) return undefined;
  return refs
    .filter((img) => img.imageBytes || img.fifeUrl)
    .map(elementFormImageToDataUrl);
}

export function resolveProductImageRefs(options: {
  productImageRefs?: ElementFormImage[];
  productImages?: string[];
}): ElementFormImage[] {
  if (options.productImageRefs?.length) return options.productImageRefs;
  return legacyUrlsToRefs(options.productImages);
}

export function resolveSidebarProductImages(options: {
  scriptProductImages?: string[];
  configProductImages?: string[];
}): string[] {
  const fromConfig = options.configProductImages?.filter(Boolean);
  if (fromConfig?.length) return fromConfig;
  return options.scriptProductImages?.filter(Boolean) ?? [];
}

export interface ProductImagesUploadProps {
  productImageRefs?: ElementFormImage[];
  productImages?: string[];
  onChange: (patch: ProductImagesPatch) => void;
  readOnly?: boolean;
  label?: string;
}

export function ProductImagesUpload({
  productImageRefs,
  productImages,
  onChange,
  readOnly = false,
  label,
}: ProductImagesUploadProps) {
  const { t } = useTranslation();

  const value = useMemo(
    () => resolveProductImageRefs({ productImageRefs, productImages }),
    [productImageRefs, productImages]
  );

  const handleChange = (refs: ElementFormImage[] | undefined) => {
    onChange({
      productImageRefs: refs,
      productImages: productImageRefsToUrls(refs),
    });
  };

  return (
    <ElementImagesUpload
      label={label ?? t("Ảnh sản phẩm tham chiếu (tùy chọn)")}
      artStyleImg={value}
      onArtStyleImgChange={handleChange}
      readOnly={readOnly}
      maxImages={PRODUCT_IMAGE_UPLOAD_MAX}
    />
  );
}
