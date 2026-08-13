import { useRef, useState } from "react";
import { RiLock2Line } from "react-icons/ri";

import { useTranslation } from "react-i18next";
import {
  TERMS_OF_SERVICE_SAMPLE_HTML,
  TERMS_OF_SERVICE_SETTING_KEY,
} from "../../../../../lib/constants/terms-of-service.sample";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { Setting } from "../../../../../lib/repo";
import {
  Button,
  Editor,
  Field,
  ImageInput,
  Input,
  Switch,
  Textarea,
} from "../../../../shared/utilities/form";
import { JSONEditor } from "../../../../shared/utilities/form/json-editor";
import { Dropdown } from "../../../../shared/utilities/popover/dropdown";
import { MutableSetting } from "./setting-list";

interface PropTypes extends ReactProps {
  setting: MutableSetting;
  onChange: (setting: MutableSetting) => any;
  onEdit: (setting: Setting) => any;
  onDelete: (setting: Setting) => any;
}
export function SettingItem({ setting, ...props }: PropTypes) {
  const { t } = useTranslation();
  const ref = useRef();
  const { user } = useAuth();
  const [htmlEditorKey, setHtmlEditorKey] = useState(0);
  const onSettingValueChanged = (value: any) => {
    props.onChange({ ...setting, value });
  };

  const onItemValueChanged = (key: string, value: string) => {
    const index = setting.values?.findIndex((x) => x.key == key);
    if (index >= 0) {
      setting.values[index].value = value;
      setting.value = setting.values.reduce(
        (obj, item) => ({
          ...obj,
          [item.key]: setting.value[item.value] || "",
        }),
        {}
      );
      props.onChange({ ...setting });
    }
    setting.value[key] = value;
    props.onChange({ ...setting });
  };

  return (
    <div className="pb-3">
      <div className="flex pb-1 pl-1 font-semibold text-gray-600">
        <div className="flex flex-col">
          <div className="flex ">
            <span
              className={`flex ${setting.isActive ? "" : "line-through"} ${
                setting.readOnly ? "text-gray-400" : ""
              }`}
              data-tooltip={setting.isActive ? "" : t("Không hoạt động")}
            >
              {t(setting.name)}
            </span>
            {setting.isPrivate && (
              <i className="ml-2 text-xl" data-tooltip={t("Chế độ riêng tư")}>
                <RiLock2Line />
              </i>
            )}
          </div>
          <span className="font-normal text-13">{t(setting.desc)}</span>
        </div>

        {user.role == "ADMIN" && (
          <div
            className="flex items-center h-6 pl-4 pr-2 ml-auto text-gray-600 cursor-pointer hover:text-primary"
            ref={ref}
            // onClick={(e) => e.preventDefault()}
          >
            <span className={`flex text-gray-400`}>{setting.key}</span>
            {/* <i className="text-2xl">
            <RiMoreFill />
          </i> */}
          </div>
        )}
        <Dropdown placement="right-start" reference={ref}>
          <Dropdown.Item text={t("Chỉnh sửa")} onClick={() => props.onEdit(setting)} />
          <Dropdown.Item hoverDanger text={t("Xoá")} onClick={() => props.onDelete(setting)} />
        </Dropdown>
      </div>
      {
        {
          boolean: (
            <Switch
              readOnly={setting.readOnly}
              value={setting.value}
              onChange={onSettingValueChanged}
            />
          ),
          image: (
            <ImageInput
              readOnly={setting.readOnly}
              value={setting.value}
              onChange={onSettingValueChanged}
            />
          ),
          string: (
            <Input
              readOnly={setting.readOnly}
              value={setting.value}
              onChange={onSettingValueChanged}
            />
          ),
          number: (
            <Input
              number
              decimal
              decimalSeparator="dot"
              readOnly={setting.readOnly}
              value={setting.value}
              onChange={(val, extraVal) => onSettingValueChanged(extraVal)}
            />
          ),
          richText: (
            <Textarea
              readOnly={setting.readOnly}
              value={setting.value}
              onChange={onSettingValueChanged}
            />
          ),
          object: (
            <>
              {setting.value &&
                Object.keys(setting.value).map((key, index, arr) => (
                  <Input
                    readOnly={setting.readOnly}
                    key={key}
                    value={setting.value[key]}
                    prefix={key}
                    prefixClassName="bg-gray-100 border-r border-gray-400 min-w-4xs"
                    className={`${index == 0 ? "" : "rounded-t-none"} ${
                      index == arr.length - 1 ? "" : "rounded-b-none"
                    } min-w`}
                    onChange={(val) => onItemValueChanged(key, val)}
                  />
                ))}
            </>
          ),
          array: (
            <Input
              multi
              readOnly={setting.readOnly}
              name={setting.name}
              value={setting.value}
              onChange={onSettingValueChanged}
            />
          ),
          json: (
            <JSONEditor
              readOnly={setting.readOnly}
              name={setting.name}
              value={setting.value}
              onChange={onSettingValueChanged}
            />
          ),
          html: (
            <div>
              {setting.key === TERMS_OF_SERVICE_SETTING_KEY && (
                <div className="flex justify-end mb-2">
                  <Button
                    small
                    gray
                    text={t("Reset về mẫu")}
                    disabled={setting.readOnly}
                    onClick={() => {
                      onSettingValueChanged(TERMS_OF_SERVICE_SAMPLE_HTML);
                      setHtmlEditorKey((key) => key + 1);
                    }}
                  />
                </div>
              )}
              <Field name={setting.name} noError>
                <Editor
                  key={`${setting.id}-${htmlEditorKey}`}
                  maxHeight="calc(100vh - 150px)"
                  readOnly={setting.readOnly}
                  name={setting.name}
                  noBorder
                  defaultValue={setting.value}
                  value={setting.value}
                  placeholder={
                    setting.key === TERMS_OF_SERVICE_SETTING_KEY
                      ? t("Nội dung điều khoản sử dụng dịch vụ")
                      : t("Nội dung và lý do ngưng hoạt động sàn")
                  }
                  onChange={(val) => onSettingValueChanged(val)}
                />
              </Field>
            </div>
          ),
        }[setting.type]
      }
    </div>
  );
}
