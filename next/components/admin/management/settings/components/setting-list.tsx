import cloneDeep from "lodash/cloneDeep";
import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { HiCog } from "react-icons/hi";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { SETTING_TYPES, Setting } from "../../../../../lib/repo";
import { Button, Checkbox, Field, Form, Input, Select } from "../../../../shared/utilities/form";
import { NotFound, Spinner } from "../../../../shared/utilities/misc";
import { useSettingsContext } from "../providers/settings-provider";
import { SettingItem } from "./setting-item";
import { ShopeeSignerBalancePanel } from "./shopee-signer-balance-panel";

export interface MutableSetting extends Setting {
  values: {
    key: string;
    value: string;
  }[];
}

interface PropTypes extends ReactProps {}
export function SettingList(props: PropTypes) {
  const { t } = useTranslation();
  const { userPermission } = useAuth();
  const [openSettings, setOpenSettings] = useState(null);
  const { loadingSettings, saveSettings, settings, settingGroup, saveSetting, deleteSetting } =
    useSettingsContext();

  const [mutableSettings, setMutableSettings] = useState<MutableSetting[]>(null);
  useEffect(() => {
    onInitData();
  }, [settings]);

  const [isStaticSettings, setIsStaticSettings] = useState<boolean>(false);
  useEffect(() => {
    if (settingGroup) {
      if (settingGroup.slug == "TRANG_CHU") {
        setIsStaticSettings(true);
      } else {
        setIsStaticSettings(false);
      }
    }
  }, [settingGroup]);

  const onSettingChanged = (setting: MutableSetting, id: string) => {
    let index = mutableSettings.findIndex((x) => x.id == id);
    if (index >= 0) {
      mutableSettings[index] = setting;
    }
    setMutableSettings([...mutableSettings]);
  };

  const onInitData = () => {
    if (settings) {
      let clonedSettings = cloneDeep(settings) as MutableSetting[];

      for (let setting of clonedSettings) {
        switch (setting.type) {
          case "object": {
            setting.valueKeys = Object.keys(setting?.value || {});
            // setting.values = Object.keys(setting.value).map((key) => ({ key, value: setting.value[key] }));
            break;
          }
        }
      }

      setMutableSettings(clonedSettings);
    } else {
      setMutableSettings(null);
    }
  };

  return (
    <>
      {loadingSettings ? (
        <Spinner />
      ) : (
        <>
          {!!mutableSettings && (
            <>
              {
                <Form className="bg-white border border-gray-300 rounded shadow-sm">
                  <div className="px-5 py-3 font-semibold text-gray-600 border-b border-gray-200">
                    {t(settingGroup.name)}
                  </div>
                  <div
                    className="px-5 py-3 v-scrollbar"
                    style={{ maxHeight: "calc(100vh - 220px)", minHeight: "250px" }}
                  >
                    {!mutableSettings.length ? (
                      <>
                        <NotFound text={t("Chưa có cấu hình nào")} icon={<HiCog />} />
                      </>
                    ) : (
                      <>
                        {settingGroup?.slug === "Shopee Video Upload" && mutableSettings?.length ? (
                          <ShopeeSignerBalancePanel settings={mutableSettings} />
                        ) : null}
                        {isStaticSettings ? (
                          <> {{}[settingGroup.slug]} </>
                        ) : (
                          <>
                            {" "}
                            {mutableSettings.map((setting) => (
                              <SettingItem
                                key={setting.id}
                                setting={setting}
                                onChange={(setting) => onSettingChanged(setting, setting.id)}
                                onEdit={setOpenSettings}
                                onDelete={deleteSetting}
                              />
                            ))}{" "}
                          </>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex justify-end px-5 py-3 border-t border-gray-200">
                    <Button
                      gray
                      text={t("Reset dữ liệu")}
                      onClick={onInitData}
                      disabled={!userPermission("EDIT_CONFIG")}
                    />
                    <Button
                      primary
                      submit
                      disabled={!userPermission("EDIT_CONFIG")}
                      className="ml-2"
                      text={t("Lưu thay đổi")}
                      onClick={async () => await saveSettings(mutableSettings)}
                    />
                  </div>
                  <Form
                    dialog
                    grid
                    width="550px"
                    title={`${openSettings ? t("Cập nhật") : t("Tạo")} ${t("cấu hình")}`}
                    defaultValues={openSettings}
                    isOpen={!!openSettings}
                    onClose={() => setOpenSettings(null)}
                    onSubmit={async (data) => {
                      await saveSetting(openSettings.id, data).then((res) => {
                        setOpenSettings(null);
                      });
                    }}
                  >
                    <Field name="name" label={t("Tên cấu hình")} cols={6} required>
                      <Input autoFocus />
                    </Field>
                    <Field
                      readOnly
                      name="key"
                      label={t("Mã cấu hình")}
                      cols={6}
                      required
                      validation={{ code: true }}
                    >
                      <Input />
                    </Field>
                    <Field name="type" label={t("Loại cấu hình")} cols={6} required>
                      <Select options={SETTING_TYPES} readOnly={openSettings?.id} />
                    </Field>
                    <Field name="isActive" label=" " cols={6}>
                      <Checkbox placeholder={t("Đang hoạt động")} />
                    </Field>
                    <ValueKeysField />
                    <Field name="readOnly" cols={6}>
                      <Checkbox placeholder={t("Không thể chỉnh sửa")} />
                    </Field>
                    <Field name="isPrivate" cols={6}>
                      <Checkbox placeholder={t("Chế độ riêng tư")} />
                    </Field>
                    <Form.Footer submitProps={{ disabled: !userPermission("EDIT_CONFIG") }} />
                  </Form>
                </Form>
              }
            </>
          )}
        </>
      )}
    </>
  );
}

function ValueKeysField() {
  const { t } = useTranslation();
  const { watch } = useFormContext();
  const type = watch("type");

  if (type !== "object") return;
  return (
    <Field name="valueKeys" label={t("Nhập tên các trường tuỳ chỉnh")} cols={12} required>
      <Input multi />
    </Field>
  );
}
