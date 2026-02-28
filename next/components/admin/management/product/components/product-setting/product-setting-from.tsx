import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { HiOutlineMenuAlt4, HiOutlineTrash, HiPlus, HiX } from "react-icons/hi";
import {
  API_OUTPUT_TYPES,
  type ApiOutputTypeValue
} from "../../../../../../lib/constants/api-config.const";
import { useOptionsTranslation } from "../../../../../../lib/hooks/useOptionsTranslate";
import { useScreen } from "../../../../../../lib/hooks/useScreen";
import { useAuth } from "../../../../../../lib/providers/auth-provider";
import { AiProviderService, PropertyTypeEnum } from "../../../../../../lib/repo";
import { Dialog } from "../../../../../shared/utilities/dialog/dialog";
import { Button, Field, Input, Select, Switch } from "../../../../../shared/utilities/form";
import { JSONEditor } from "../../../../../shared/utilities/form/json-editor";

export const ProductSettingForm = () => {
  const { t } = useTranslation();
  const sm = useScreen("sm");
  const xl = useScreen("xl");
  const { PRODUCT_PROPERTY_TYPE_OPTIONS } = useOptionsTranslation();

  const { append, remove, move, fields } = useFieldArray({
    name: "properties",
  });
  const name = "properties";
  const [openFieldDialog, setOpenFieldDialog] = useState(false);
  const [type, setType] = useState(PRODUCT_PROPERTY_TYPE_OPTIONS[0].value);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const { userPermission } = useAuth();

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };
  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null) return;
    setDragOverIndex(index);
  };
  const handleDragLeave = () => {
    setDragOverIndex(null);
  };
  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === toIndex) return;
    move(draggedIndex, toIndex);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="space-y-4 w-full">
      <div className="p-2 w-full rounded-md border">
        <div className="mb-2 text-sm font-semibold text-gray-700">
          {t("Thuộc tính (properties)")}
        </div>
        <div className="col-span-12">
          {(fields as (any & { id: string })[])?.map((item, index) => (
            <div
              className={`p-2 -m-1 mb-3 hover:bg-gray-100 hover:border-gray-300  bg-gray-50 rounded-md border transition-colors ${
                dragOverIndex === index ? "border-primary border-2 bg-primary/5" : "border-gray-200"
              } ${draggedIndex === index ? "opacity-50" : ""}`}
              key={item.id}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
            > 
            <div className="flex gap-2 justify-between items-center">
            <div className="flex items-center text-gray-400 cursor-pointer cursor-grab hover:text-gray-600" 
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragEnd={handleDragEnd}
            onMouseDown={(e) => e.stopPropagation()}
            data-tooltip={t("Kéo để sắp xếp thứ tự")}
            data-tooltip-position="top"
          >
            <HiOutlineMenuAlt4 className="w-5 h-5" />
          </div>
              <div className="grid grid-cols-12 gap-x-2 pl-2 border-l-2 border-gray-200">
              
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
              </div></div> 
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
      {/* Cấu hình API: ảnh, video, file từ các nền tảng AI */}
      <ApiConfigSection />
    </div>
  );
};

/** Form cấu hình gọi API tạo ảnh / video / file từ các nền tảng AI (OpenAI, Google, Replicate, Runway, ...) */
function ApiConfigSection() {
  const { t } = useTranslation();
  const { setValue } = useFormContext();
  const outputType = useWatch({ name: "config.outputType" }) as ApiOutputTypeValue | undefined;
  const providerId = useWatch({ name: "config.providerId" }) as string | undefined;
  const modelValue = useWatch({ name: "config.model" }) as string | undefined;

  const outputTypeOptions = useMemo(
    () => API_OUTPUT_TYPES.map((x) => ({ value: x.value, label: t(x.label) || x.label })),
    [t]
  );
 
 

   
 
 

   


  return (
    <div className="p-4 w-full rounded-lg border border-gray-200 bg-gray-50/50">
      <div className="mb-3 text-sm font-semibold text-gray-800">{t("Cấu hình API (ảnh / video / file)")}</div>
      <div className="grid grid-cols-12 gap-x-3 gap-y-3">
        <Field label={t("Loại output")} name="config.outputType" cols={6} required>
          <Select
            options={outputTypeOptions}
            placeholder={t("Chọn loại: Ảnh, Video, File...")}
            clearable={false}
          />
        </Field>
        <Field label={t("Provider")} name="config.providerId" cols={6}>
        <Select hasImage
          optionsPromise={() =>
            AiProviderService.getAiProviderSelect().then((res) => {
              return res?.map((item) => ({
                value: item._id,
                label: item.name,
                image: item.imgUrl,
              }));
            })
          }
          value={providerId}
        />
        </Field>
        <Field label={t("Model")} name="config.model" cols={12}>
            <Input placeholder={t("VD: my-custom-model")} />
        
        </Field> 
        <Field label={t("Method")} name="config.method" cols={4}>
          <Select
            options={[
              { value: "POST", label: "POST" },
              { value: "GET", label: "GET" },
              { value: "PUT", label: "PUT" },
              { value: "PATCH", label: "PATCH" },
            ]}
            placeholder="POST"
          />
        </Field>
        <Field label={t("Endpoint")} name="config.endpoint" cols={8}>
          <Input
            placeholder={
               "/generate-image"
            }
          />
        </Field>
        <Field label={t("Headers (JSON)")} name="config.headers" cols={12}>
          <JSONEditor height="120px" placeholder='{ "Authorization": "Bearer {{apiKey}}", "Content-Type": "application/json" }' />
        </Field>
        <Field label={t("Body template (JSON)")} name="config.bodyTemplate" cols={12}>
          <JSONEditor  height="200px" placeholder="{ 'prompt': '{{prompt}}', 'model': '{{model}}', 'size': '1024x1024' }" />
        </Field>
        <Field label={t("Response path (URL kết quả)")} name="config.responsePath" cols={12}>
          <Input
            placeholder={
               "data[0].url hoặc result.media[0].url"
            }
          />
        </Field>
      </div>
    </div>
  );
}

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
