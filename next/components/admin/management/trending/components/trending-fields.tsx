import { useTranslation } from "react-i18next";
import { TrendingCategoryService } from "../../../../../lib/repo/list/trendingCategory.repo";
import { Field, ImageInput, Input, Textarea } from "../../../../shared/utilities/form";
import { Select } from "../../../../shared/utilities/form/select";
import { Switch } from "../../../../shared/utilities/form/switch";

export function TrendingFields() {
  const { t } = useTranslation();

  return (
    <>
      <Field name="imageUrls" label={t("Danh sách ảnh")} cols={12}>
        <ImageInput largeImage cover multi />
      </Field>
      <Field name="name" label={t("Tên trending")} cols={12} required>
        <Input />
      </Field>
      <Field name="prompt" label={t("Prompt mô tả")} cols={12}>
        <Textarea />
      </Field>
      <Field name="des" label={t("Mô tả")} cols={12}>
        <Textarea />
      </Field>
      <Field name="price" label={t("Giá tiền")} cols={6}>
        <Input number />
      </Field>
      <Field name="trendingCategoryIds" label={t("Danh mục trending")} cols={12}>
        <Select
          multi
          autocompletePromise={(props) =>
            TrendingCategoryService.getAllAutocompletePromise(props, {
              fragment: "id name",
              parseOption: (data) => ({
                value: data.id,
                label: data.name,
              }),
            })
          }
        />
      </Field>

      <Field name="isActive" label={t("Kích hoạt")} cols={6}>
        <Switch />
      </Field>
    </>
  );
}
