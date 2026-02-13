import md5 from "md5";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useScreen } from "../../../../lib/hooks/useScreen";
import { useGlobalContext } from "../../../../lib/providers/global-provider";
import { useToast } from "../../../../lib/providers/toast-provider";
import { CustomerService } from "../../../../lib/repo";
import { SlideCaptchaVerifyDialog } from "../../common/slide-captcha_verify";
import { Field, Form, Input } from "../../utilities/form";

export function CustomerForgotPasswordDialog({ ...props }) {
  const { t } = useTranslation();
  const toast = useToast();
  const screenLg = useScreen("lg");
  const { setOpenCustomerLoginDialog, openCustomerForgotPasswordDialog } = useGlobalContext();
  const [openSlideVerify, setOpenSlideVerify] = useState(null);

  const handleSubmit = async (data) => {
    if (!openCustomerForgotPasswordDialog) return;
    await setOpenSlideVerify({ newPassword: md5(data.password) });
  };

  const handleClose = () => {
    props.onClose();
  };

  return (
    <>
      <Form
        title={t("Đổi mật khẩu")}
        dialog
        headerClass={`bg-white rounded-2xl flex flex-row px-5 pt-2`}
        allowResetDefaultValues
        minWidth={screenLg ? "400px" : "280px"}
        {...props}
        onClose={handleClose}
        onSubmit={handleSubmit}
        slideFromBottom="none"
        defaultValues={{
          password: "",
          confirmPassword: "",
        }}
      >
        <Field required name="password" label={t("Mật khẩu mới")}>
          <Input type="password" placeholder={t("Nhập mật khẩu mới của bạn")} />
        </Field>
        <Field
          required
          name="confirmPassword"
          label={t("Xác nhận mật khẩu mới")}
          validation={{
            confirmPassword: (confirmPassword, data) => {
              return confirmPassword !== data.password ? t("Mật khẩu không trùng nhau") : "";
            },
          }}
        >
          <Input type="password" placeholder={t("Nhập lại mật khẩu mới của bạn")} />
        </Field>
        <Form.Footer cancelText="" submitText={t("Đổi mật khẩu")} />
      </Form>
      <SlideCaptchaVerifyDialog
        openSlideVerify={openSlideVerify}
        setOpenSlideVerify={setOpenSlideVerify}
        onSuccess={async () => {
          await CustomerService.customerResetPassword({
            firebaseToken: openCustomerForgotPasswordDialog,
            newPassword: openSlideVerify.newPassword,
          })
            .then((res) => {
              toast.success(t("Đổi mật khẩu thành công. Nhập mật khẩu mới để đăng nhập."));
              props.onClose();
              setOpenCustomerLoginDialog(true);
              setOpenSlideVerify(undefined);
            })
            .catch((err) => {
              console.error(err);
              toast.error(t("Đổi mật khẩu thất bại.") + err.message);
              setOpenSlideVerify(undefined);
            });
        }}
        onFail={() => toast.error(t("Xác thực bảo mật thất bại"))}
      />
    </>
  );
}
