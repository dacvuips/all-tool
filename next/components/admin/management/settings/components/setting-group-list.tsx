import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { SettingGroup } from "../../../../../lib/repo/general/setting-group.repo";
import { Field, Form, Input, Textarea } from "../../../../shared/utilities/form";
import { useSettingsContext } from "../providers/settings-provider";
import { SettingGroupItem } from "./setting-group-item";
interface PropTypes extends ReactProps {}
export function SettingGroupList(props: PropTypes) {
  const { t } = useTranslation();
  const [openSettingGroup, setOpenSettingGroup] = useState<Partial<SettingGroup>>(null);
  const { settingGroups, saveSettingGroup, deleteSettingGroup } = useSettingsContext();
  const { userPermission } = useAuth();
  return (
    <div className="border border-gray-300 rounded bg-gray-50">
      {settingGroups.map((settingGroup, index) => (
        <SettingGroupItem
          key={settingGroup.id}
          settingGroup={settingGroup}
          onEdit={setOpenSettingGroup}
          onDelete={deleteSettingGroup}
        />
      ))}
      {/* <Button
        className="w-full"
        icon={<RiAddCircleLine />}
        text="Thêm nhóm cấu hình mới"
        onClick={() => {
          setOpenSettingGroup({ name: "", slug: "", desc: "", readOnly: false });
        }}
      /> */}
      <Form
        title={`${openSettingGroup ? t("Cập nhật") : t("Tạo")} ${t("nhóm cấu hình")}`}
        dialog
        width="550px"
        grid
        defaultValues={openSettingGroup}
        isOpen={!!openSettingGroup}
        onClose={() => setOpenSettingGroup(null)}
        onSubmit={async (data) => {
          await saveSettingGroup(data.id, data).then((res) => {
            setOpenSettingGroup(null);
          });
        }}
      >
        <Field label={t("Tên nhóm cấu hình")} name="name" cols={6} required>
          <Input />
        </Field>
        <Field
          label={t("Slug nhóm cấu hình")}
          name="slug"
          cols={6}
          required
          validation={{ slug: true }}
        >
          <Input readOnly={!!openSettingGroup?.id} />
        </Field>
        <Field label={t("Mô tả nhóm cấu hình")} name="desc" cols={12}>
          <Textarea />
        </Field>
        <Form.Footer submitProps={{ disabled: !userPermission("EDIT_CONFIG") }} />
      </Form>
    </div>
  );
}
