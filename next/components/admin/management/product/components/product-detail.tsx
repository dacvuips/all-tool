import { useFormContext } from "react-hook-form";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDevice } from "../../../../../lib/hooks/useDevice";
import { useScreen } from "../../../../../lib/hooks/useScreen";
import { Category, CategoryService } from "../../../../../lib/repo";
import { PropertyTypeEnum } from "../../../../../lib/repo/types";
import { Field, Input, Select, Switch } from "../../../../shared/utilities/form";
import { NotFound } from "../../../../shared/utilities/misc";

export function ProductDetail() {
  const { t } = useTranslation();
  const { watch } = useFormContext();
  const { isMobile } = useDevice();
  const xs2 = useScreen("2xs");
  const sm = useScreen("sm");
  const [category, setCategory] = useState<Category>();
  const categoryId = watch("categoryId");

  useEffect(() => {
    categoryId && getCategory();
  }, [categoryId]);

  const getCategory = async () => {
    await CategoryService.getOne({ id: categoryId }).then((res) => {
      setCategory(res);
    });
  };

  return (
    <div className="grid grid-cols-12 gap-x-5">
      {category?.properties.length ? (
        <>
          {category?.properties.map((field) => {
            return (
              <Field
                namePrefix="categoryProperties"
                key={field.key}
                name={field.key}
                label={field.label}
                cols={xs2 ? 6 : 12}
                required={field.required}
                tooltip={field.tooltip}
              >
                {field.type == PropertyTypeEnum.TEXT && <Input placeholder={field.placeholder} />}
                {field.type == PropertyTypeEnum.NUMBER && (
                  <Input number placeholder={field.placeholder} />
                )}
                {field.type == PropertyTypeEnum.BOOLEAN && (
                  <Switch placeholder={field.placeholder} />
                )}
                {(field.type == PropertyTypeEnum.SELECT ||
                  field.type == PropertyTypeEnum.MULTI_SELECT) && (
                  <Select
                    clearable={field.clearable}
                    multi={field.type == PropertyTypeEnum.MULTI_SELECT}
                    placeholder={field.placeholder}
                    menuPosition="absolute"
                    options={field.options.map((x) => ({
                      value: x.key,
                      label: x.label,
                    }))}
                  />
                )}
              </Field>
            );
          })}
        </>
      ) : (
        <NotFound text={t("Chưa chọn ngành hàng")} />
      )}
    </div>
  );
}
