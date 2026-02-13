import { useFormContext } from "react-hook-form";
import { BannerActionType } from "../../../../../lib/repo/list/banner.repo";

import { useTranslation } from "react-i18next";
import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { useScreen } from "../../../../../lib/hooks/useScreen";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { Field, ImageInput, Input, Select } from "../../../../shared/utilities/form";
import { Accordion } from "../../../../shared/utilities/misc";

export function BannerFields() {
  const { t } = useTranslation();
  const sm = useScreen("sm");
  const { userPermission } = useAuth();
  const { BANNER_ACTIONS } = useOptionsTranslation();
  const POSITION_OPTIONS = [
    { label: "Top", value: "Top" },
    { label: "TopRight", value: "TopRight" },
    { label: "Middle", value: "Middle" },
    { label: "Explore", value: "Explore" },
  ];

  return (
    <>
      <Field name="image" label={t("Hình banner")} cols={sm ? 5 : 12} required>
        <ImageInput largeImage ratio169 cover readOnly={!userPermission("EDIT_BANNER")} />
      </Field>
      <div className="grid-cols-12 col-span-12 sm:col-span-7 sm:gap-3">
        <Field name="priority" label={t("Ưu tiên")} cols={sm ? 4 : 12}>
          <Input number />
        </Field>
        <Field name="position" label={t("Vị trí")} cols={sm ? 4 : 12}>
          <Select options={POSITION_OPTIONS} defaultValue={"Top"} />
        </Field>
        <Field name="actionType" label={t("Loại hành động")} cols={sm ? 4 : 12} required>
          <Select options={BANNER_ACTIONS} />
        </Field>
        <ActionTypeFields />
      </div>
    </>
  );
}

function ActionTypeFields() {
  const { t } = useTranslation();
  const { watch, setValue } = useFormContext();
  const actionType: BannerActionType = watch("actionType");
  const memberId: BannerActionType = watch("memberId");

  return (
    <>
      <Accordion className="col-span-12" isOpen={actionType == "WEBSITE"}>
        <Field
          name="link"
          label={t("Đường dẫn website")}
          cols={12}
          required={actionType == "WEBSITE"}
        >
          <Input type="url" />
        </Field>
      </Accordion>
    </>
  );
}
