import { useEffect, useMemo, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FcGoogle } from "react-icons/fc";
import { HiOutlineMail } from "react-icons/hi";
import { validateEmail } from "../../../../../lib/helpers/validateJSON";
import { useScreen } from "../../../../../lib/hooks/useScreen";
import { useTimeBlockButtonForgetPassword } from "../../../../../lib/hooks/useTimeBlockButtonForgetPassword";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { CustomerService } from "../../../../../lib/repo/customer/customer.repo";
import { loginModeEnum } from "../../../../../lib/repo/types";
import { SlideCaptchaVerifyDialog } from "../../../common/slide-captcha_verify";
import { DialogProps } from "../../../utilities/dialog/dialog";
import { Button, Field, Form, Input } from "../../../utilities/form";
import { AuthDialogHeader } from "../../auth-dialog-header";
interface Props extends DialogProps {}

export const CustomerLoginEmailTab = ({ ...props }: Props) => {
  const { t } = useTranslation();
  const toast = useToast();
  const screenLg = useScreen("lg");
  const languageRef = useRef();
  const { timeBlockRemain, removeTimeBlock } = useTimeBlockButtonForgetPassword();
  const time = timeBlockRemain();
  const [otpDelay, setOTPDelay] = useState(time);
  const [mode, setMode] = useState<loginModeEnum>(loginModeEnum.login);
  const [defaultValues, setDefaultValues] = useState({});
  const { customer, customerLoginFirebaseEmail } = useAuth();
  const [forgotPassQuery, setForgotPassQuery] = useState<boolean>(false);
  const [openSlideVerify, setOpenSlideVerify] = useState(null);

  useEffect(() => {
    if (otpDelay > 0) {
      setTimeout(() => {
        setOTPDelay(otpDelay - 1);
      }, 1000);
    } else {
      removeTimeBlock();
    }
  }, [otpDelay]);

  const isWaitingOTPDelay = useMemo(() => otpDelay > 0, [otpDelay]);

  const handleSubmit = async ({ email, password, name, introduceCode }) => {
    try {
      if (mode == loginModeEnum.regis) {
        if (!customer) {
          await CustomerService.customerRegisterWithEmail({
            name,
            email,
            password: password,
            ...(introduceCode ? { introduceCode } : {}),
          })
            .then((res) => {
              toast.success(t("Đăng ký thành công."));
              setMode(loginModeEnum.login);
            })
            .catch((err) => {
              toast.error(`${t("Đăng ký thất bại")},${err} `);
            });

          return;
        }
      } else {
        await setOpenSlideVerify({ email, password: password });
      }
    } catch (error) {
      let errorMessage = "";
      if (mode == loginModeEnum.regis) {
        switch (error.code) {
          case "auth/invalid-verification-code": {
            errorMessage = t("Mã OTP không chính xác. Vui lòng nhập lại.");
            break;
          }
          case "auth/missing-verification-code": {
            errorMessage = t("Mã OTP bị thiếu. Vui lòng nhập OTP để đăng nhập.");
            break;
          }
          default: {
            errorMessage = t("Đăng nhập thất bại. Vui lòng nhập lại sau.");
            break;
          }
        }
      } else {
        errorMessage = error;
      }
      toast.error(errorMessage);
    }
  };

  useEffect(() => {
    if (customer) {
      props.onClose();
    }
  }, [customer]);

  useEffect(() => {
    if (!props.isOpen) {
      setDefaultValues({});
    }
  }, [props.isOpen]);

  return (
    <>
      <Form
        dialog
        minWidth={screenLg ? "400px" : "280px"}
        defaultValues={defaultValues}
        allowResetDefaultValues
        dialogClass="rounded-2xl relative bg-white my-auto"
        {...props}
        onSubmit={handleSubmit}
        bodyClass=" "
        slideFromBottom="none"
      >
        <div className="p-5">
          <AuthDialogHeader
            title={t("Chào mừng đến với StoreMMO")}
            subtitle={`${
              forgotPassQuery
                ? t("Nhập email của bạn để lấy lại mật khẩu")
                : mode !== loginModeEnum.regis
                ? t("Vui lòng đăng nhập để tiếp tục")
                : t("Đăng ký tài khoản")
            }`}
            onClose={props.onClose}
          />
          <div className="flex flex-col items-center pb-5 w-full lg:pb-2">
            <CustomerLoginFields
              isWaitingOTPDelay={isWaitingOTPDelay}
              setOTPDelay={setOTPDelay}
              otpDelay={otpDelay}
              forgotPassQuery={forgotPassQuery}
              setForgotPassQuery={setForgotPassQuery}
              mode={mode}
              setMode={setMode}
            />
          </div>
        </div>
      </Form>
      <SlideCaptchaVerifyDialog
        openSlideVerify={openSlideVerify}
        setOpenSlideVerify={setOpenSlideVerify}
        onSuccess={async () => {
          await customerLoginFirebaseEmail(openSlideVerify.email, openSlideVerify.password)
            .then((res) => {
              toast.success(t("Đăng nhập thành công."));
              setOpenSlideVerify(undefined);
              setForgotPassQuery(false);
            })
            .catch((err) => {
              toast.error(`${t("Đăng nhập thất bại")},${err} `);
              setOpenSlideVerify(undefined);
              setForgotPassQuery(false);
            });
        }}
        onFail={() => toast.error(t("Xác thực bảo mật thất bại"))}
      />
    </>
  );
};

function CustomerLoginFields({
  isWaitingOTPDelay,
  otpDelay,
  setOTPDelay,
  mode,
  setMode,
  forgotPassQuery,
  setForgotPassQuery,
}: {
  isWaitingOTPDelay: boolean;
  setOTPDelay: (sec: number) => any;
  otpDelay: number;
  mode: loginModeEnum;
  setMode: (mode: loginModeEnum) => any;
  forgotPassQuery: boolean;
  setForgotPassQuery: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const { resetPasswordFirebaseEmail, loginCustomerWithGoogle } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const captchaRef = useRef(null);

  const [forgetPasswordNoteText, setForgetPasswordNoteText] = useState<string>();
  const [openSlideVerify, setOpenSlideVerify] = useState(null);
  const [emailError, setEmailError] = useState<string>();

  const { setTimeBlock, timeBlockRemain, removeTimeBlock } = useTimeBlockButtonForgetPassword();

  const {
    getValues,
    formState: { isSubmitting },
  } = useFormContext();

  const handleForgotPasswordClick = () => {
    if (mode == loginModeEnum.regis) {
      setMode(loginModeEnum.login);
      setForgotPassQuery(false);
    } else {
      setForgotPassQuery(true);
      setMode(loginModeEnum.regis);
    }
  };

  const handleSubmitForgotPassword = async () => {
    const email = getValues("email");

    if (email) {
      setLoading(true);
      try {
        const exitEmail = await CustomerService.checkCustomerEmail(email);

        if (exitEmail) {
          handelSendResetPassword(email);
        } else {
          setLoading(false);
          setEmailError(t("Email không tồn tại"));
        }
      } catch (error) {
        setLoading(false);
      }
    }
  };

  const handelSendResetPassword = async (email) => {
    await resetPasswordFirebaseEmail(email)
      .then(async (res) => {
        setLoading(false);

        await setTimeBlock();
        await setOTPDelay(timeBlockRemain());
        toast.success(
          t("Đã gửi yêu cầu lấy lại mật khẩu vào email của bạn vui lòng vào email để xác nhận")
        );

        setForgetPasswordNoteText(
          t("Đã gửi yêu cầu lấy lại mật khẩu vào email của bạn vui lòng vào email để xác nhận")
        );
      })
      .catch(async (err) => {
        setLoading(false);
        await removeTimeBlock();
        await setOTPDelay(0);
        toast.error(`${t("Lấy lại mật khẩu thất bại")},${err} `);
      });
  };

  const handleOpenSlideVerifyForgotPassword = () => {
    const email = getValues("email");
    const validate = validateEmail(email);
    if (validate) {
      setEmailError(validate);

      return;
    }
    if (email) {
      setOpenSlideVerify(true);
    } else {
      toast.info(t("Vui lòng nhập email cần lấy lại mật khẩu"));
      setLoading(false);
    }
  };

  return (
    <>
      <div className="" id="recaptcha-container" ref={captchaRef}></div>
      {mode === loginModeEnum.regis && !forgotPassQuery && (
        <Field className="w-full" name="name" label={t("Tên khách hàng")} required>
          <Input
            className="text-sm font-light border-gray-200 sm:h-12 sm:text-base"
            placeholder={t("Nhập tên của bạn")}
          />
        </Field>
      )}
      <Field
        className="w-full"
        name="email"
        label={t("Email")}
        validation={{ email: true }}
        required
        error={emailError}
        tooltip={
          mode != loginModeEnum.regis
            ? t("Email chính xác của bạn, để nhận email từ sàn, dành để lấy lại mật khẩu sau này")
            : t("Email chính xác của bạn")
        }
      >
        <Input
          className="text-sm font-light border-gray-200 sm:h-12 sm:text-base"
          placeholder={t("Nhập email của bạn")}
          onChange={() => {
            setEmailError("");
          }}
          suffix={
            forgotPassQuery ? (
              <Button
                onClick={handleOpenSlideVerifyForgotPassword}
                disabled={isWaitingOTPDelay || isSubmitting}
                text={
                  !isWaitingOTPDelay
                    ? t("Lấy lại mật khẩu")
                    : t("Gửi lại") + (isWaitingOTPDelay ? ` (${otpDelay}s)` : "")
                }
                isLoading={loading}
                className={`text-sm rounded-sm ${
                  isWaitingOTPDelay ? "bg-gray-100" : "bg-primary-light"
                } border-l rounded-l-none h-full`}
                textPrimary
              />
            ) : (
              <i className="px-1">
                <HiOutlineMail />
              </i>
            )
          }
        />
      </Field>

      {forgotPassQuery && (
        <div className="max-w-xs text-sm text-center text-gray-600">{forgetPasswordNoteText}</div>
      )}

      {!forgotPassQuery && (
        <Field
          required
          className="w-full"
          name="password"
          label={t("Mật khẩu")}
          tooltip={t(`Mật khẩu đăng nhập của bạn`)}
          validation={{
            newPassword: (value, values) => {
              if (value === values["oldPassword"])
                return t("Mật khẩu không được trùng với mật khẩu cũ");
              return "";
            },
          }}
        >
          <Input
            placeholder={t("Nhập mật khẩu")}
            type="password"
            className="text-sm font-light border-gray-200 sm:h-12 sm:text-base"
          />
        </Field>
      )}
      {mode === loginModeEnum.regis && !forgotPassQuery && (
        <>
          <Field
            required
            className={`w-full`}
            name="retypePassword"
            label={t("Nhập lại mật khẩu")}
            tooltip={t("Xác nhận lại mật khẩu đăng nhập của bạn")}
            validation={{
              checkPassword: (value, values) => {
                if (value != values["password"]) return t("Mật khẩu nhập lại không khớp");
                return "";
              },
            }}
          >
            <Input
              placeholder={t("Xác nhận lại mật khẩu")}
              type="password"
              className="text-sm font-light border-gray-200 sm:h-12 sm:text-base"
            />
          </Field>
          <Field
            className="w-full"
            name="introduceCode"
            label={t("Mã giới thiệu")}
            tooltip={t("Nhập mã giới thiệu nếu có (không bắt buộc)")}
            validation={{ code: true }}
          >
            <Input
              placeholder={t("Nhập mã giới thiệu (nếu có)")}
              className="text-sm font-light border-gray-200 sm:h-12 sm:text-base"
            />
          </Field>
        </>
      )}
      {(forgotPassQuery || mode != loginModeEnum.regis) && (
        <div className="flex justify-end mb-2 w-full">
          <Button
            unfocusable
            text={mode != loginModeEnum.regis ? t("Quên mật khẩu") : t("Quay lại")}
            disabled={isSubmitting}
            className="h-8 text-sm underline"
            onClick={handleForgotPasswordClick}
          />
        </div>
      )}
      {!forgotPassQuery && (
        <div className="flex flex-col gap-2 items-center w-full">
          <div className="flex flex-col gap-2 items-center w-full">
            <Button
              text={mode != loginModeEnum.regis ? t("Đăng nhập") : t("Đăng ký")}
              primary
              isLoading={isSubmitting}
              submit
              className="px-5 w-full h-11 whitespace-nowrap rounded-full shadow sm:mt-2 sm:px-12"
            />
            <div className="text-sm text-gray-600">
              {mode == loginModeEnum.regis ? (
                <>
                  {t("Bạn đã có tài khoản?")}{" "}
                  <span
                    className="underline cursor-pointer text-primary"
                    onClick={() => setMode(loginModeEnum.login)}
                  >
                    {t("Đăng nhập")}
                  </span>
                </>
              ) : (
                <>
                  {t("Bạn chưa có tài khoản?")}{" "}
                  <span
                    className="underline cursor-pointer text-primary"
                    onClick={() => setMode(loginModeEnum.regis)}
                  >
                    {t("Đăng ký")}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="text-center">
            <div className="my-2">{`-- ${t("hoặc")} --`}</div>
            <div className="flex gap-1 items-center cursor-pointer">
              <Button
                outline
                icon={<FcGoogle />}
                text={t("Đăng nhập bằng Google")}
                className="h-8 text-sm hover:underline"
                onClick={loginCustomerWithGoogle}
              />
            </div>
          </div>
        </div>
      )}
      <SlideCaptchaVerifyDialog
        openSlideVerify={openSlideVerify}
        setOpenSlideVerify={setOpenSlideVerify}
        onSuccess={async () => {
          await handleSubmitForgotPassword();
          setOpenSlideVerify(undefined);
        }}
        onFail={() => toast.error(t("Xác thực bảo mật thất bại"))}
      />
    </>
  );
}
