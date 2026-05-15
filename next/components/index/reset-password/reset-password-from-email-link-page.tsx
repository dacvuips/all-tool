import { Player } from "@lottiefiles/react-lottie-player";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiArrowLeftSLine } from "react-icons/ri";
import { useScreen } from "../../../lib/hooks/useScreen";
import { useAuth } from "../../../lib/providers/auth-provider";
import { useGlobalContext } from "../../../lib/providers/global-provider";
import { useToast } from "../../../lib/providers/toast-provider";
import { AuthDialogHeader } from "../../shared/auth/auth-dialog-header";
import { SlideCaptchaVerifyDialog } from "../../shared/common/slide-captcha_verify";
import { Button, Field, Form, Input } from "../../shared/utilities/form";
import { Spinner } from "../../shared/utilities/misc";

export const ResetPasswordFromEmailPage: React.FC = () => {
  const { t } = useTranslation();
  const screenLg = useScreen("lg");
  const toast = useToast();
  const { customer } = useAuth();
  const [openSlideVerify, setOpenSlideVerify] = useState(null);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const query = router.query;

  const { confirmPasswordReset, checkExpiredActionCode } = useAuth();

  const handleSubmit = async (values) => {
    setOpenSlideVerify({
      password: values.password,
    });
  };

  useEffect(() => {
    if (query.oobCode) {
      checkActionCode();
    }
  }, [query]);

  const checkActionCode = async () => {
    await checkExpiredActionCode(query?.oobCode as string)
      .then((res) => {
        setLoading(false);
      })
      .catch((error) => {
        router.replace("/");
        toast.error(`${t("Đổi mật khẩu thất bại")} ${error}`);
      });
  };

  if (!!customer) {
    router.replace("/");
    return null;
  }
  const handleConfirmResetPassword = async () => {
    await confirmPasswordReset(query?.oobCode as string, openSlideVerify.password)
      .then(() => {
        // Reset mật khẩu thành công, nhưng không trả về email
        toast.success(t("Reset mật khẩu thành công"));
        setOpenSlideVerify(undefined);
        setSuccess(true);
      })
      .catch((error) => {
        // Xử lý lỗi nếu có
        toast.error(`${t("Đổi mật khẩu thất bại")} ${error}`);
        setOpenSlideVerify(undefined);
        router.push("/");
      });
  };

  if (loading) return <Spinner />;
  return (
    <Form
      title={t("Đổi mật khẩu")}
      minWidth={screenLg ? "400px" : "280px"}
      allowResetDefaultValues
      headerClass={`bg-white rounded-2xl flex flex-row px-5 pt-2`}
      className="max-w-sm p-4 m-auto bg-white rounded-2xl"
      onSubmit={handleSubmit}
    >
      {success ? <ResetPasswordSuccess /> : <ResetPasswordField />}

      <SlideCaptchaVerifyDialog
        openSlideVerify={openSlideVerify}
        setOpenSlideVerify={setOpenSlideVerify}
        onSuccess={handleConfirmResetPassword}
        onFail={() => toast.error(t("Xác thực bảo mật thất bại"))}
      />
    </Form>
  );
};

const ResetPasswordField = () => {
  const { t } = useTranslation();

  return (
    <>
      <AuthDialogHeader
        title={t("Chào mừng đến với Việt Theo Veo 3")}
        subtitle={t("Nhập mật khẩu mới của bạn")}
        noCloseButton={false}
      />
      <Field
        required
        className="w-full"
        name="password"
        label={t("Mật khẩu mới")}
        tooltip={t(`Mật khẩu đăng nhập mới của bạn`)}
        validation={{
          newPassword: (value, values) => {
            if (value === values["oldPassword"])
              return t("Mật khẩu không được trùng với mật khẩu cũ");
            return "";
          },
        }}
      >
        <Input
          placeholder={t("Nhập mật khẩu mới")}
          type="password"
          className="text-sm font-light border-gray-200 sm:h-12 sm:text-base"
        />
      </Field>
      <Field
        required
        className={`w-full`}
        name="retypePassword"
        label={t("Nhập lại mật khẩu mới")}
        tooltip={t("Xác nhận lại mật khẩu đăng nhập mới của bạn")}
        validation={{
          checkPassword: (value, values) => {
            if (value != values["password"]) return t("Mật khẩu nhập lại không khớp");
            return "";
          },
        }}
      >
        <Input
          placeholder={t("Xác nhận lại mật khẩu mới")}
          type="password"
          className="text-sm font-light border-gray-200 sm:h-12 sm:text-base"
        />
      </Field>
      <Form.Footer cancelText="" submitText={t("Xác nhận")} />
    </>
  );
};

const ResetPasswordSuccess = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { setOpenCustomerLoginDialog } = useGlobalContext();

  return (
    <div className="flex flex-col items-center justify-center">
      <Player
        autoplay
        loop
        src={`/assets/lottie/success.json`}
        style={{ height: "200px", width: "200px" }}
      ></Player>
      <span className="text-lg font-semibold text-center">{t("Đổi mật khẩu thành công")}</span>
      <span className="mt-2 text-sm text-center text-gray-500 ">
        {t(
          "Mật khẩu của bạn đã được thay đổi thành công, bây giờ bạn có thể đăng nhập với mật khẩu mới"
        )}
      </span>
      <div className="flex flex-wrap-reverse items-center justify-center mt-5 ">
        <Button
          icon={<RiArrowLeftSLine />}
          iconClassName="text-xl"
          text={t("Về trang chủ")}
          onClick={() => router.replace("/")}
        />
        <Button
          primary
          text={t("Đăng nhập ngay")}
          onClick={() => setOpenCustomerLoginDialog(true)}
        />
      </div>
    </div>
  );
};
