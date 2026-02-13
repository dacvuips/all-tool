import { useEffect, useState } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { HiOutlineTrash, HiPlus, HiX } from "react-icons/hi";
import { useScreen } from "../../../../../lib/hooks/useScreen";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";

import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { Category, CategoryService } from "../../../../../lib/repo";
import { Dialog } from "../../../../shared/utilities/dialog/dialog";
import {
  Button,
  Field,
  Form,
  ImageInput,
  Input,
  Select,
  Switch,
} from "../../../../shared/utilities/form";

export function CategoryOverviewTab({
  category,
  loadAll,
}: {
  category: Category;
  loadAll: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const sm = useScreen("sm");
  const xl = useScreen("xl");
  const { userPermission } = useAuth();

  const onSubmit = async (data) => {
    await CategoryService.createOrUpdate({ id: category.id, data: { ...data } })
      .then((res) => {
        toast.success(`${category.id ? t("Cập nhật") : t("Tạo")} ${t("danh mục thành công")}`);

        loadAll();
      })
      .catch((err) => {
        console.error(err);
        toast.error(
          `${category.id ? t("Cập nhật") : t("Tạo")} ${t("danh mục thất bại")}. ${err.message}`
        );
      });
  };
  return (
    <>
      <Form className="grid grid-cols-12 gap-2" defaultValues={category} onSubmit={onSubmit}>
        <Field label={t("Tên")} name="name" required cols={xl ? 2 : sm ? 4 : 6}>
          <Input placeholder={t("Nhập tên danh mục")} />
        </Field>

        <Field label={t("Mô tả")} name="description" cols={xl ? 2 : sm ? 4 : 6}>
          <Input placeholder={t("Nhập mô tả")} />
        </Field>
        <Field label={t("Hình ảnh")} name="imgUrl" cols={xl ? 2 : sm ? 4 : 6}>
          <ImageInput placeholder={t("Nhập link ảnh")} />
        </Field>

        <Field label={t("Ưu tiên")} name="priority" cols={xl ? 1 : sm ? 4 : 6}>
          <Input number placeholder={t("Nhập số ưu tiên")} />
        </Field>
        <Field label={t("Trạng thái")} name="active" cols={xl ? 1 : sm ? 4 : 6}>
          <Switch />
        </Field>
        <div className="col-span-12">
          <Properties />
        </div>
        <Form.Footer
          className="pb-14 lg:pb-0"
          cancelText=""
          submitProps={{ disabled: !userPermission("EDIT_CATEGORY") }}
        />
      </Form>
    </>
  );
}

function Properties() {
  const { t } = useTranslation();
  const sm = useScreen("sm");
  const xl = useScreen("xl");
  const { CATEGORY_PROPERTIES_OPTION } = useOptionsTranslation();

  const { append, remove, fields } = useFieldArray({
    name: "properties",
  });
  const name = "properties";
  const [openFieldDialog, setOpenFieldDialog] = useState(false);
  const [type, setType] = useState(CATEGORY_PROPERTIES_OPTION[0].value);
  const { userPermission } = useAuth();

  return (
    <>
      {(fields as (any & { id: string })[])?.map((item, index) => (
        <div className="p-2 -m-1 mb-3 bg-gray-50 rounded-md border border-gray-200" key={index}>
          <div className="grid grid-cols-12 gap-x-2">
            <TypeField type={item.type} fieldIndex={index} />
            <Field
              label={t("Mã dữ liệu")}
              name={`${name}.${index}.key`}
              validation={{ code: true }}
              required
              cols={xl ? 1 : sm ? 3 : 6}
              disabled={item.key == "SV" || item.key == "TYPE"}
            >
              <Input placeholder={t("Nhập mã dữ liệu")} />
            </Field>

            <Field
              label={t("Tên dữ liệu")}
              name={`${name}.${index}.label`}
              required
              cols={xl ? 1 : sm ? 3 : 6}
              disabled={item.key == "SV" || item.key == "TYPE"}
            >
              <Input stringLength={10} placeholder={t("Nhập tên dữ liệu")} />
            </Field>
            <Field
              label={t("Nội dung")}
              name={`${name}.${index}.placeholder`}
              cols={xl ? 3 : sm ? 3 : 6}
              disabled={item.key == "SV" || item.key == "TYPE"}
            >
              <Input placeholder={t("Nhập nội dung...")} />
            </Field>

            <Field
              label={t("Giải thích")}
              name={`${name}.${index}.tooltip`}
              cols={xl ? 3 : sm ? 3 : 6}
              disabled={item.key == "SV" || item.key == "TYPE"}
            >
              <Input placeholder={t("Giải thích trường cần nhập")} />
            </Field>

            <Field
              label={t("Bắt buộc")}
              name={`${name}.${index}.required`}
              cols={xl ? 1 : sm ? 3 : 6}
              disabled={item.key == "SV" || item.key == "TYPE"}
            >
              <Switch />
            </Field>
            <Field
              label={t("Để trống")}
              name={`${name}.${index}.clearable`}
              cols={xl ? 1 : sm ? 3 : 6}
              disabled={item.key == "SV" || item.key == "TYPE"}
            >
              <Switch />
            </Field>
            <Button
              className="mt-7"
              icon={<HiOutlineTrash />}
              outline
              hoverDanger
              disabled={item.default == true}
              // disabled={!userPermission("SAVE_GENERAL_CONFIG")}
              onClick={() => {
                remove(index);
              }}
            />
          </div>
          {(item.type == "SELECT" || item.type == "MULTI-SELECT") && (
            <SelectFields fieldIndex={index} />
          )}
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
      >
        <Dialog.Body>
          <Field label={t("Loại")}>
            <Select
              options={CATEGORY_PROPERTIES_OPTION}
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
    </>
  );
}

function TypeField({ type, fieldIndex }) {
  const { t } = useTranslation();
  const sm = useScreen("sm");
  const xl = useScreen("xl");
  const { register, watch } = useFormContext();
  register(`properties.${fieldIndex}.type`);
  const { CATEGORY_PROPERTIES_OPTION } = useOptionsTranslation();
  return (
    <Field label={t("Loại dữ liệu")} cols={xl ? 1 : sm ? 3 : 6}>
      <Input value={CATEGORY_PROPERTIES_OPTION.find((x) => x.value == type)?.label} readOnly />
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
  // const [valuess, setValue] = useState();
  // const optionId = watch("value.option.id");
  register(`properties.${fieldIndex}.options`);

  // useEffect(() => {
  //   const values = watch(`value`);
  //   // setValue(values);
  // }, []);
  // console.log(valuess);

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
