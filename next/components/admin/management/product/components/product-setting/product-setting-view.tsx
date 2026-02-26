import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useScreen } from "../../../../../../lib/hooks/useScreen";
import { PropertyTypeEnum } from "../../../../../../lib/repo";
import {
  Field,
  ImageInput,
  Input,
  Select,
  Switch,
  Textarea,
} from "../../../../../shared/utilities/form";
import { NotFound } from "../../../../../shared/utilities/misc";

export const ProductSettingView = () => {
  const { t } = useTranslation();
  const xs2 = useScreen("2xs");
  const { watch } = useFormContext();
  const properties = watch("properties");

  return (
    <div
      style={{ width: "375px", minWidth: "375px" }}
      className="border-2 border-primary rounded-lg p-2 shadow"
    >
      {properties?.length ? (
        <>
          {properties?.map((field, index) => {
            return (
              <Field
                namePrefix="categoryProperties"
                key={field.key || index}
                name={field.key}
                label={field.label}
                cols={xs2 ? 6 : 12}
                required={field.required}
                tooltip={field.tooltip}
                readOnly
              >
                {field.type == PropertyTypeEnum.TEXT && (
                  <Input clearable={field.clearable} placeholder={field.placeholder} />
                )}
                {field.type == PropertyTypeEnum.NUMBER && (
                  <Input clearable={field.clearable} number placeholder={field.placeholder} />
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
                    options={field?.options?.map((x) => ({
                      value: x.key,
                      label: x.label,
                    }))}
                  />
                )}

                {field.type == PropertyTypeEnum.TEXTAREA && (
                  <Textarea placeholder={field.placeholder} />
                )}
                {(field.type == PropertyTypeEnum.IMAGE ||
                  field.type == PropertyTypeEnum.MUILTI_IMAGE) && (
                  <ImageInput
                    multi={field.type == PropertyTypeEnum.MUILTI_IMAGE}
                    placeholder={field.placeholder}
                  />
                )}
              </Field>
            );
          })}
        </>
      ) : (
        <NotFound text={t("Chưa chọn trường")} />
      )}
    </div>
  );
};
