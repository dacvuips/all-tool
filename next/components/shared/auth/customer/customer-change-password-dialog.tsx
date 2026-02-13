import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { useToast } from "../../../../lib/providers/toast-provider";
import { DialogProps } from "../../utilities/dialog/dialog";
import { Field } from "../../utilities/form/field";
import { Form } from "../../utilities/form/form";
import { Input } from "../../utilities/form/input";
interface Props extends DialogProps {}
export function CustomerChangePasswordDialog({ ...props }: Props) {
  const { t } = useTranslation();
  const { customer } = useAuth();
  const [defaultValues, setDefaultValues] = useState<any>({});
  const toast = useToast();
  const { customerExchangePassword } = useAuth();

  useEffect(() => {
    if (props.isOpen) {
      setDefaultValues({});
    }
  }, [props.isOpen]);

  if (!customer) return <></>;
  return (
    <>
      <Form
        title={t("Đổi mật khẩu")}
        dialog
        defaultValues={defaultValues}
        allowResetDefaultValues
        headerClass={`bg-white rounded-2xl flex flex-row px-5 pt-2`}
        dialogClass="rounded-2xl relative bg-white my-auto"
        width={350}
        {...props}
        onClose={() => {
          props.onClose();
        }}
        onSubmit={async (data) => {
          try {
            const reqData = {
              oldPassword: data.oldPassword,
              newPassword: data.password,
            };
            await customerExchangePassword(reqData);

            toast.success(t("Đổi mật khẩu thành công"));
            props.onClose();
          } catch (err) {
            console.error(err);
            toast.error(t("Đổi mật khẩu thất bại.") + err.message);
          }
        }}
      >
        <Field required name="oldPassword" label={t("Mật khẩu cũ")}>
          <Input
            type="password"
            className="text-sm font-light border-gray-200 sm:h-12 sm:text-base"
            placeholder={t("Nhập lại mật khẩu cũ của bạn")}
          />
        </Field>
        <Field
          required
          name="password"
          label={t("Mật khẩu mới")}
          validation={{
            newPassword: (value, values) => {
              if (value === values["oldPassword"])
                return t("Mật khẩu mới không được trùng với mật khẩu cũ");
              return "";
            },
          }}
        >
          <Input
            type="password"
            className="text-sm font-light border-gray-200 sm:h-12 sm:text-base"
            placeholder={t("Nhập mật khẩu mới của bạn")}
          />
        </Field>
        <Field
          required
          name="retypePassword"
          label={t("Nhập lại mật khẩu mới")}
          validation={{
            checkPassword: (value, values) => {
              if (value != values["password"]) return t("Mật khẩu nhập lại không khớp");
              return "";
            },
          }}
        >
          <Input
            type="password"
            className="text-sm font-light border-gray-200 sm:h-12 sm:text-base"
            placeholder={t("Nhập lại mật khẩu mới của bạn")}
          />
        </Field>
        <Form.Footer cancelText="" submitText={t("Đổi mật khẩu")} />
      </Form>
    </>
  );
}
