import { useEffect, useState } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { HiOutlineTrash, HiPlus, HiX } from "react-icons/hi";
import { useOptionsTranslation } from "../../../../../../lib/hooks/useOptionsTranslate";
import { useScreen } from "../../../../../../lib/hooks/useScreen";
import { useAuth } from "../../../../../../lib/providers/auth-provider";
import { PropertyTypeEnum } from "../../../../../../lib/repo";
import { Dialog } from "../../../../../shared/utilities/dialog/dialog";
import { Button, Field, Input, Select, Switch } from "../../../../../shared/utilities/form";

export const ProductSettingForm = () => {
  const { t } = useTranslation();
  const sm = useScreen("sm");
  const xl = useScreen("xl");
  const { PRODUCT_PROPERTY_TYPE_OPTIONS } = useOptionsTranslation();

  const { append, remove, fields } = useFieldArray({
    name: "properties",
  });
  const name = "properties";
  const [openFieldDialog, setOpenFieldDialog] = useState(false);
  const [type, setType] = useState(PRODUCT_PROPERTY_TYPE_OPTIONS[0].value);
  const { userPermission } = useAuth();

  return (
    <div className="w-full space-y-4">
      {/* Label node (khi chỉnh node trong flow) */}
      <Field label={t("Tên hiển thị node")} name="label" cols={12}>
        <Input placeholder={t("vd: Generate Video")} />
      </Field>

      {/* Config API (provider, endpoint, method, bodyTemplate) */}
      <div className="w-full border p-2 rounded-md bg-gray-50/50">
        <div className="text-sm font-semibold text-gray-700 mb-2">{t("Cấu hình API")}</div>
        <div className="grid grid-cols-12 gap-x-2 gap-y-2">
          <Field label={t("Provider")} name="config.provider" cols={6}>
            <Input placeholder="vd: veo3" />
          </Field>
          <Field label={t("Method")} name="config.method" cols={6}>
            <Input placeholder="POST" />
          </Field>
          <Field label={t("Endpoint")} name="config.endpoint" cols={12}>
            <Input placeholder="/generate-video" />
          </Field>
          <Field label={t("Body template")} name="config.bodyTemplate" cols={12}>
            <Input placeholder="{ prompt: {{prompt}}, duration: {{duration}} }" />
          </Field>
        </div>
      </div>

      <div className="w-full border p-2 rounded-md">
        <div className="text-sm font-semibold text-gray-700 mb-2">{t("Thuộc tính (properties)")}</div>
      <div className="col-span-12">
        {(fields as (any & { id: string })[])?.map((item, index) => (
          <div
            className="p-2 -m-1 mb-3 bg-gray-50 rounded-md border border-gray-200"
            key={item.id + index}
          >
            <div className="grid grid-cols-12 gap-x-2">
              <TypeField type={item.type} fieldIndex={index} />
              <Field
                label={t("Mã dữ liệu")}
                name={`${name}.${index}.key`}
                validation={{ code: true }}
                required
                cols={xl ? 2 : sm ? 3 : 6}
              >
                <Input placeholder={t("Nhập mã dữ liệu")} />
              </Field>

              <Field
                label={t("Tên dữ liệu")}
                name={`${name}.${index}.label`}
                required
                cols={xl ? 2 : sm ? 3 : 6}
              >
                <Input placeholder={t("Nhập tên dữ liệu")} />
              </Field>
              <Field
                label={t("Nội dung")}
                name={`${name}.${index}.placeholder`}
                cols={xl ? 2 : sm ? 3 : 6}
              >
                <Input placeholder={t("Nhập nội dung...")} />
              </Field>

              <Field
                label={t("Giải thích")}
                name={`${name}.${index}.tooltip`}
                cols={xl ? 4 : sm ? 3 : 6}
              >
                <Input placeholder={t("Giải thích trường cần nhập")} />
              </Field>

              {(item.type == PropertyTypeEnum.SELECT ||
                item.type == PropertyTypeEnum.MULTI_SELECT ||
                item.type == PropertyTypeEnum.TEXT ||
                item.type == PropertyTypeEnum.NUMBER) && (
                <Field
                  label={t("Để trống")}
                  name={`${name}.${index}.clearable`}
                  cols={xl ? 1 : sm ? 3 : 6}
                >
                  <Switch defaultValue={item.clearable} />
                </Field>
              )}
              <Field
                label={t("Bắt buộc")}
                name={`${name}.${index}.required`}
                cols={xl ? 1 : sm ? 3 : 6}
              >
                <Switch defaultValue={item.required} />
              </Field>
              <Button
                className="mt-7"
                icon={<HiOutlineTrash />}
                outline
                hoverDanger
                // disabled={!userPermission("SAVE_GENERAL_CONFIG")}
                onClick={() => {
                  remove(index);
                }}
              />
            </div>
            {(item.type == PropertyTypeEnum.SELECT ||
              item.type == PropertyTypeEnum.MULTI_SELECT) && <SelectFields fieldIndex={index} />}
          </div>
        ))}
        <Button
          accent
          text={t("Thêm dữ liệu")}
          icon={<HiPlus />}
          disabled={!userPermission("EDIT_CATEGORY")}
          onClick={() => {
            setOpenFieldDialog(true);
          }}
        />
        <Dialog
          width={350}
          title={t("Loại dữ liệu")}
          slideFromBottom="none"
          isOpen={openFieldDialog}
          onClose={() => setOpenFieldDialog(false)}
          style={{ zIndex: 1100 }}
        >
          <Dialog.Body>
            <Field label={t("Loại")}>
              <Select
                options={PRODUCT_PROPERTY_TYPE_OPTIONS}
                value={type}
                onChange={setType}
                clearable={false}
              />
            </Field>
            <div className="flex justify-end">
              <Button text={t("Đóng")} onClick={() => setOpenFieldDialog(false)} />
              <Button
                // disabled={!userPermission("SAVE_GENERAL_CONFIG")}
                primary
                text={t("Thêm dữ liệu")}
                onClick={() => {
                  append({
                    type,
                  });
                  setOpenFieldDialog(false);
                }}
              />
            </div>
          </Dialog.Body>
        </Dialog>
      </div>
      </div>
    </div>
  );
};

function TypeField({ type, fieldIndex }) {
  const { t } = useTranslation();
  const sm = useScreen("sm");
  const xl = useScreen("xl");
  const { register } = useFormContext();
  register(`properties.${fieldIndex}.type`);
  const { PRODUCT_PROPERTY_TYPE_OPTIONS } = useOptionsTranslation();
  return (
    <Field label={t("Loại dữ liệu")} cols={xl ? 2 : sm ? 3 : 6}>
      <Input value={PRODUCT_PROPERTY_TYPE_OPTIONS.find((x) => x.value == type)?.label} readOnly />
    </Field>
  );
}

function SelectFields({ fieldIndex }) {
  const { t } = useTranslation();
  const { register, watch } = useFormContext();
  const { update, append, remove, fields } = useFieldArray({
    name: `properties.${fieldIndex}.options`,
    keyName: "key",
  });
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");

  const [openOptionDialog, setOpenOptionDialog] = useState(undefined);

  register(`properties.${fieldIndex}.options`);

  return (
    <div className="mb-3">
      <div className="flex flex-wrap gap-2">
        {(
          fields as {
            label: string;
            key: string;
            // fieldMatch: string;
            // unMatch: string;
          }[]
        )?.map((item, index) => (
          <div key={index} className="flex rounded-full border border-gray-300 border-group">
            <div
              className={`flex items-center px-2 py-1 font-semibold text-gray-900 cursor-pointer hover:bg-bluegray-300`}
              onClick={() => {
                setKey(item.key);
                setLabel(item.label);
                setOpenOptionDialog(index);
              }}
            >
              {item.key} - {item.label}
            </div>
            <div
              className="px-2 py-1 h-full text-gray-600 border-l border-gray-300 cursor-pointer hover:text-danger flex-center"
              onClick={() => {
                remove(index);
              }}
            >
              <HiX />
            </div>
            <OptionRegister fieldIndex={fieldIndex} optionIndex={index} option={item} />
          </div>
        ))}
        <Button
          className="h-9 rounded-full"
          outline
          text={t("Thêm lựa chọn")}
          onClick={() => {
            setKey("");
            setLabel("");
            setOpenOptionDialog(-1);
          }}
        />
      </div>
      <Dialog
        title={`${openOptionDialog ? t("Chỉnh sửa") : t("Thêm")} ${t("lựa chọn")}`}
        isOpen={openOptionDialog !== undefined}
        slideFromBottom="none"
        onClose={() => {
          setOpenOptionDialog(undefined);
        }}
        style={{ zIndex: 1100 }}
      >
        <Dialog.Body>
          <Field label={t("Mã lựa chọn")}>
            <Input value={key} onChange={setKey} autoFocus placeholder={t("Nhập mã lựa chọn")} />
          </Field>
          <Field label={t("Tên lựa chọn")}>
            <Input value={label} onChange={setLabel} placeholder={t("Nhập tên lựa chọn")} />
          </Field>

          <div className="flex justify-end">
            <Button text={t("Đóng")} onClick={() => setOpenOptionDialog(undefined)} />
            <Button
              primary
              text={`${openOptionDialog ? t("Chỉnh sửa") : t("Thêm")}`}
              onClick={() => {
                if (!key || !label) return;
                if (openOptionDialog >= 0) {
                  update(openOptionDialog, {
                    key,
                    label,
                  });
                } else {
                  append({ key, label });
                }
                setOpenOptionDialog(undefined);
              }}
            />
          </div>
        </Dialog.Body>
      </Dialog>
    </div>
  );
}

function OptionRegister({ fieldIndex, optionIndex, option }) {
  const { register, setValue } = useFormContext();

  useEffect(() => {
    const keyPath = `properties.${fieldIndex}.options.${optionIndex}.key`;
    const labelPath = `properties.${fieldIndex}.options.${optionIndex}.label`;

    register(keyPath);
    register(labelPath);

    if (option?.key !== undefined && option?.key !== null) {
      setValue(keyPath, option.key, { shouldValidate: false });
    }
    if (option?.label !== undefined && option?.label !== null) {
      setValue(labelPath, option.label, { shouldValidate: false });
    }
  }, [fieldIndex, optionIndex, option, register, setValue]);

  return <></>;
}
