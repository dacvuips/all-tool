import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { CategoryService } from "../../../../../lib/repo";
import { Field, ImageInput, Input, Select } from "../../../../shared/utilities/form";

function flattenCategoryOptions(
  tree: { id?: string; name?: string; parentId?: string | null; children?: any[] }[],
  level = 0
): { value: string; label: string; isDisabled?: boolean }[] {
  const options: { value: string; label: string; isDisabled?: boolean }[] = [];
  const prefix = "— ".repeat(level);
  for (const n of tree) {
    if (!n.id) continue;
    options.push({
      value: n.id,
      label: prefix + (n.name || "(Chưa đặt tên)"),
      isDisabled: !n.parentId,
    });
    if (n.children?.length) options.push(...flattenCategoryOptions(n.children, level + 1));
  }
  return options;
}

/** Lấy slug list từ API route /api/app-pages */
async function fetchAppPageSlugs(): Promise<{ value: string; label: string }[]> {
  try {
    const res = await fetch("/api/app-pages");
    if (!res.ok) return [];
    const data = await res.json();
    return (data.slugs ?? []).map((s: { slug: string; filename: string }) => ({
      value: s.slug,
      label: s.slug,
    }));
  } catch {
    return [];
  }
}

export function ProductField() {
  const { t } = useTranslation();
  const { userPermission } = useAuth();
  const [categoryOptions, setCategoryOptions] = useState<
    { value: string; label: string; isDisabled?: boolean }[]
  >([]);
  const [slugOptions, setSlugOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    CategoryService.getCategoryTree()
      .then((tree) => {
        setCategoryOptions(flattenCategoryOptions(tree));
      })
      .catch(() => setCategoryOptions([]));

    // Load slug options từ pages/app/
    fetchAppPageSlugs().then(setSlugOptions);
  }, []);

  return (
    <>
      <Field name="name" label={t("Tên sản phẩm")} cols={7} required>
        <Input placeholder={t("Nhập tên sản phẩm")} />
      </Field>
      <Field name="coverImg" label={t("Hình ảnh bìa")} cols={5} required className="w-full">
        <ImageInput
          placeholder={t("Nhập link hoặc tải lên")}
          readOnly={!userPermission("EDIT_PRODUCT")}
        />
      </Field>

      {/* Slug: chọn từ danh sách pages/app/ hoặc nhập tay */}
      <Field
        name="slug"
        label={t("Slug / App Page")}
        cols={6}
        tooltip={t("Chọn page tương ứng trong thư mục pages/app/")}
      >
        {slugOptions.length > 0 ? (
          <Select
            options={slugOptions}
            placeholder={t("Chọn slug từ pages/app/")}
            clearable
          />
        ) : (
          <Input placeholder={t("VD: page-1")} />
        )}
      </Field>

      <Field name="creditCost" label={t("Credit (mỗi lần dùng)")} cols={6}>
        <Input type="number" placeholder="0" />
      </Field>

      <Field name="categoryIds" label={t("Danh mục hiển thị")} cols={12}>
        <Select
          multi
          options={categoryOptions}
          placeholder={t("Chọn danh mục (có thể chọn nhiều)")}
          clearable
        />
      </Field>

      <Field name="des" label={t("Mô tả sản phẩm")} cols={12}>
        <Input placeholder={t("Nhập mô tả ngắn")} />
      </Field>
    </>
  );
}
