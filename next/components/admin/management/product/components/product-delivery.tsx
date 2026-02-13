import { useTranslation } from "react-i18next";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { Field, Input, Label } from "../../../../shared/utilities/form";

export function ProductDelivery() {
  const { t } = useTranslation();

  const { userPermission } = useAuth();
  return (
    <div className="grid grid-cols-12 gap-x-5">
      <Field
        name="delivery.weight"
        description={t("Là cơ sở chính để tính chi phí vận chuyển")}
        label={t("Cân nặng (sau khi đóng gói)")}
        cols={12}
        required
      >
        <Input
          number
          placeholder={t("Nhập cân nặng của sản phẩm")}
          readOnly={!userPermission("EDIT_PRODUCT")}
          suffix={"gr"}
          suffixClassName="border-l"
        />
      </Field>
      <Label text={t("Kích thước đóng gói")} className="col-span-12" />
      <Field name="delivery.length" cols={4} label={t("Dài")}>
        <Input
          number
          readOnly={!userPermission("EDIT_PRODUCT")}
          suffix={"cm"}
          placeholder={t("Dài")}
          suffixClassName="border-l"
        />
      </Field>
      <Field name="delivery.width" label={t("Rộng")} cols={4}>
        <Input
          number
          placeholder={t("Rộng")}
          readOnly={!userPermission("EDIT_PRODUCT")}
          suffix={"cm"}
          suffixClassName="border-l"
        />
      </Field>
      <Field name="delivery.height" label={t("Cao")} cols={4}>
        <Input
          number
          placeholder={t("Cao")}
          readOnly={!userPermission("EDIT_PRODUCT")}
          suffix={"cm"}
          suffixClassName="border-l"
        />
      </Field>
      <Field label={t("Phí vận chuyển")} name="delivery.price" cols={12}>
        <Input
          number
          placeholder={t("Nhập phí vận chuyển")}
          readOnly={!userPermission("EDIT_PRODUCT")}
        />
      </Field>
    </div>
  );
}
