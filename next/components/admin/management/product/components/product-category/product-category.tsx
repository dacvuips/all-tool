import React, { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";

import { useTranslation } from "react-i18next";
import { Field, Input } from "../../../../../shared/utilities/form";
import { ClassificationSection } from "./classification-section";
import { ClassificationGroup, Variant, VariantField } from "./types";
import { VariantTable } from "./variant-table";

export const ProductCategory: React.FC = () => {
  const { t } = useTranslation();

  const { setValue, watch, register } = useFormContext();
  const [groups, setGroups] = useState<ClassificationGroup[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Register classification field to ensure it's included in form submission
  register("classification");
  const classification = watch("classification");

  // Load data from form context when editing (only once on mount)
  useEffect(() => {
    if (classification?.tiers && classification?.variants && !isDataLoaded) {
      // Map backend tiers to frontend groups
      const loadedGroups: ClassificationGroup[] = classification.tiers.map((tier: any) => ({
        code: tier.code || crypto.randomUUID(),
        name: tier.name,
        options: tier.options.map((opt: any) => ({
          code: opt.code || crypto.randomUUID(),
          name: opt.name,
          image: opt.imageUrl || opt.image || undefined,
        })),
      }));

      // Map backend variants to frontend variants
      const loadedVariants: Variant[] = classification.variants.map((variant: any) => {
        const option1Id = variant.optionCodes?.[0] || "";
        const option2Id = variant.optionCodes?.[1];
        const code = option2Id ? `${option1Id}-${option2Id}` : option1Id;

        return {
          code,
          option1Id,
          option2Id,
          price: variant.price || 0,
          stock: variant.stock || 0,
          sku: variant.sku || "",
        };
      });

      setGroups(loadedGroups);
      setVariants(loadedVariants);
      setIsDataLoaded(true);
    } else if (!classification && !isDataLoaded) {
      // Mark as loaded even if no data to prevent infinite loop
      setIsDataLoaded(true);
    }
  }, [classification]);
  // Effect: Rebuild variants whenever groups or options change (only after initial load)
  useEffect(() => {
    if (isDataLoaded) {
      generateVariants();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  const generateVariants = () => {
    const group1 = groups[0];
    const group2 = groups[1];

    if (!group1 || group1.options.length === 0) {
      setVariants([]);
      return;
    }

    const newVariants: Variant[] = [];
    // Explicitly type the Map to ensure 'existing' is correctly typed as 'Variant | undefined'
    const existingVariantsMap = new Map<string, Variant>(
      variants.map((v) => [v.code, v] as [string, Variant])
    );

    // Helper to generate consistent ID for variants to preserve data
    const getVariantId = (opt1Id: string, opt2Id?: string) => {
      return opt2Id ? `${opt1Id}-${opt2Id}` : `${opt1Id}`;
    };

    group1.options.forEach((opt1) => {
      if (group2 && group2.options.length > 0) {
        // Two groups
        group2.options.forEach((opt2) => {
          const code = getVariantId(opt1.code, opt2.code);
          const existing = existingVariantsMap.get(code);
          newVariants.push({
            code,
            option1Id: opt1.code,
            option2Id: opt2.code,
            price: existing?.price || 0,
            stock: existing?.stock || 0,
            sku: existing?.sku || "",
          });
        });
      } else {
        // One group only
        const code = getVariantId(opt1.code);
        const existing = existingVariantsMap.get(code);
        newVariants.push({
          code,
          option1Id: opt1.code,
          price: existing?.price || 0,
          stock: existing?.stock || 0,
          sku: existing?.sku || "",
        });
      }
    });

    setVariants(newVariants);
  };

  const updateVariant = (id: string, field: VariantField, value: string | number) => {
    setVariants((prev) =>
      prev.map((v) => {
        if (v.code === id) {
          if (field === "price" || field === "stock") {
            // Convert to number for price and stock
            const numValue =
              typeof value === "string" ? parseFloat(value.replace(/,/g, "")) || 0 : value || 0;
            return { ...v, [field]: numValue };
          } else {
            // Keep as string for sku
            return { ...v, [field]: String(value || "") };
          }
        }
        return v;
      })
    );
  };

  const updateOptionImage = (optionId: string, imageUrl: string) => {
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        options: g.options.map((o) => (o.code === optionId ? { ...o, image: imageUrl } : o)),
      }))
    );
  };

  const applyBulkEdit = (price: number, stock: number, sku: string) => {
    setVariants((prev) =>
      prev.map((v) => ({
        ...v,
        price: price || v.price,
        stock: stock || v.stock,
        sku: sku !== "" ? sku : v.sku,
      }))
    );
  };

  // Sync data to form context whenever groups or variants change
  useEffect(() => {
    // Only sync if we have at least one variant (user has created variants)
    // if (variants.length === 0 && groups.length === 0) {
    //   // Clear classification if no data
    //   setValue("classification", undefined);
    //   return;
    // }

    // 1. Map Frontend Groups -> Backend Tiers
    const tiers = groups.map((group) => ({
      code: group.code,
      name: group.name,
      options: group.options.map((opt) => ({
        code: opt.code,
        name: opt.name,
        imageUrl: opt.image || undefined, // Use imageUrl according to schema
      })),
    }));

    // 2. Map Frontend Variants -> Backend Variants
    const backendVariants = variants.map((v) => {
      // Gom option1Id và option2Id thành mảng optionCodes
      const optionCodes = [v.option1Id];
      if (v.option2Id) {
        optionCodes.push(v.option2Id);
      }

      return {
        code: v.code,
        sku: v.sku || "",
        // Chuyển đổi string sang number, mặc định 0 nếu rỗng
        price: v.price || 0,
        stock: v.stock || 0,
        optionCodes,
      };
    });
    const classification = watch("classification");
    // 3. Update form context with classification data
    setValue("classification", {
      ...classification,
      tiers,
      variants: backendVariants,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, variants]);

  return (
    <div className="grid grid-cols-12 gap-x-5">
      {groups.length === 0 && (
        <>
          <Field name="classification.originalPrice" label={t("Giá")} cols={6}>
            <Input number placeholder={t("Nhập giá vào")} />
          </Field>
          <Field name="classification.totalStock" label={t("Kho hàng")} cols={6}>
            <Input number placeholder={t("Nhập tồn kho")} />
          </Field>
        </>
      )}

      <ClassificationSection groups={groups} setGroups={setGroups} />

      <VariantTable
        groups={groups}
        variants={variants}
        updateVariant={updateVariant}
        updateOptionImage={updateOptionImage}
        applyBulkEdit={applyBulkEdit}
      />
    </div>
  );
};
