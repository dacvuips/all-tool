import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FcGoogle } from "react-icons/fc";
import { HiOutlinePhone } from "react-icons/hi";
import { firebase } from "../../../../../lib/helpers/firebase";
import { validateVietnamesePhoneNumber } from "../../../../../lib/helpers/validateJSON";

import { useScreen } from "../../../../../lib/hooks/useScreen";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useGlobalContext } from "../../../../../lib/providers/global-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { CustomerService } from "../../../../../lib/repo/customer/customer.repo";
import { SlideCaptchaVerifyDialog } from "../../../common/slide-captcha_verify";
import { DialogProps } from "../../../utilities/dialog/dialog";
import { Button, Field, Form, Input } from "../../../utilities/form";
import { AuthDialogHeader } from "../../auth-dialog-header";
interface Props extends DialogProps {}
export const CustomerLoginPhoneNumberTab = ({ ...props }: Props) => {
  const { t } = useTranslation();
  const [otpDelay, setOTPDelay] = useState(0);
  const toast = useToast();
  const screenLg = useScreen("lg");
  const [mode, setMode] = useState<"otp" | "password">("password");
  const [defaultValues, setDefaultValues] = useState({});
  const { customer, loginCustomerByPhoneAndPassword, loginCustomerWithGoogle } = useAuth();
  let [confirmResult, setConfirmResult] = useState(null);
  const [forgotPassQuery, setForgotPassQuery] = useState<boolean>(false);
  const [openSlideVerify, setOpenSlideVerify] = useState(null);

  const {
    setOpenRegisCustomerDialog,
    setOpenCustomerForgotPasswordDialog,
    setOpenCustomerLoginDialog,
  } = useGlobalContext();

  useEffect(() => {
    if (otpDelay > 0) {
      setTimeout(() => {
        setOTPDelay(otpDelay - 1);
      }, 1000);
    }
  }, [otpDelay]);

  const isWaitingOTPDelay = useMemo(() => otpDelay > 0, [otpDelay]);

  const handleSubmit = async ({ phone, name, password, otp }) => {
    try {
      if (mode == "otp") {
        if (!confirmResult) {
          toast.info(t("Yêu cầu nhập số điện thoại và bấm gửi mã OTP để đăng nhập"));
          return;
        }
        const res = await confirmResult.confirm(otp);
        const idToken = await res.user.getIdToken();

        if (forgotPassQuery) {
          props.onClose();
          setMode("password");
          setOpenCustomerForgotPasswordDialog(idToken);
          setForgotPassQuery(false);
          return;
        }
        // await loginCustomerByPhone(idToken);
        if (!customer) {
          toast.success(t("Xác nhận OTP thành công, chuyển sang trang đăng ký."));
          await setOpenRegisCustomerDialog(idToken);
          setMode("password");
          props.onClose();
          return;
        }
      } else {
        await setOpenSlideVerify({ phone, password });
      }

      // router.reload();
    } catch (error) {
      let errorMessage = "";
      if (mode == "otp") {
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
        title={screenLg ? "" : mode == "otp" ? t("Đăng ký bằng OTP") : t("Đăng nhập")}
        onSubmit={handleSubmit}
        bodyClass=" "
        slideFromBottom="none"
      >
        {/* <OTPButton /> */}

        <div className="p-5">
          <AuthDialogHeader
            title={t("Chào mừng đến với Việt Theo Veo 3")}
            subtitle={`${
              forgotPassQuery
                ? t("Nhập mã OTP từ điện thoại để đổi mật khẩu")
                : t("Vui lòng đăng nhập để tiếp tục")
            }`}
            onClose={props.onClose}
          />
          <div className="flex flex-col items-center pb-5 w-full lg:pb-2">
            <CustomerLoginFields
              isWaitingOTPDelay={isWaitingOTPDelay}
              setOTPDelay={setOTPDelay}
              confirmResult={confirmResult}
              setConfirmResult={setConfirmResult}
              forgotPassQuery={forgotPassQuery}
              setForgotPassQuery={setForgotPassQuery}
              mode={mode}
              setMode={setMode}
            />
            {isWaitingOTPDelay && (
              <div className="text-xs text-gray-600">
                {t("Có thể gửi lại mã OTP sau")} <span className="font-medium">{otpDelay}s</span>
              </div>
            )}
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
        </div>
      </Form>
      <SlideCaptchaVerifyDialog
        openSlideVerify={openSlideVerify}
        setOpenSlideVerify={setOpenSlideVerify}
        onSuccess={async () => {
          await loginCustomerByPhoneAndPassword(openSlideVerify.phone, openSlideVerify.password)
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
  setOTPDelay,
  confirmResult,
  setConfirmResult,
  mode,
  setMode,
  forgotPassQuery,
  setForgotPassQuery,
}: {
  isWaitingOTPDelay: boolean;
  setOTPDelay: (sec: number) => any;
  confirmResult;
  setConfirmResult;
  mode: "otp" | "password";
  setMode: (mode: "otp" | "password") => any;
  forgotPassQuery: boolean;
  setForgotPassQuery: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();

  const {
    getValues,
    formState: { isSubmitting },
  } = useFormContext();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const captchaRef = useRef(null);
  let [appVerifier, setAppVerifier] = useState();

  const getConfirmResult = async (phone: string) => {
    setLoading(true);
    try {
      const _firebase = await firebase();
      if (!appVerifier) {
        appVerifier = new _firebase.auth.RecaptchaVerifier(captchaRef.current, {
          size: "invisible",
          callback: (response: any) => {},
        });
        setAppVerifier(appVerifier);
      }
      confirmResult = await _firebase
        .auth()
        .signInWithPhoneNumber(`+84${phone.substring(1, phone.length)}`, appVerifier);
      toast.info(t("Mã OTP đã được gửi đến số điện thoại"));
      setOTPDelay(60);
    } catch (error) {
      if (error.code === "auth/invalid-phone-number") {
        toast.error(t("Số điện thoại không hợp lệ"));
      } else {
        toast.error(t("Đã xảy ra lỗi.") + error);
      }
    } finally {
      setConfirmResult(confirmResult);
      setLoading(false);
    }
  };

  const handleForgotPasswordClick = () => {
    if (mode == "otp") {
      const newQuery = { ...router.query };
      delete newQuery.forgotPassword;
      router.push({
        pathname: router.pathname,
        query: { ...newQuery },
      });
      setMode("password");
      setForgotPassQuery(false);
    } else {
      // router.push({
      //   pathname: router.asPath,
      //   query: { forgotPassword: true },
      // });
      setForgotPassQuery(true);
      setMode("otp");
    }
  };

  return (
    <>
      <div className="" id="recaptcha-container" ref={captchaRef}></div>
      <Field
        className="w-full"
        name="phone"
        label={t("Số điện thoại")}
        validation={{ phone: true }}
        required
      >
        <Input
          className="text-sm font-light border-gray-200 sm:h-12 sm:text-base"
          placeholder={t("Số điện thoại")}
          suffix={
            mode == "otp" ? (
              <Button
                onClick={async () => {
                  const phone = getValues("phone");

                  if (phone) {
                    // validate phone number
                    const validatePhoneNumber = validateVietnamesePhoneNumber(phone);
                    if (validatePhoneNumber) {
                      toast.error(validatePhoneNumber);
                      return;
                    }
                    await CustomerService.checkCustomerPhone(phone).then(async (res) => {
                      if (forgotPassQuery) {
                        res.isExist == false
                          ? toast.info(t("Số điện thoại này không tồn tại"))
                          : await getConfirmResult(phone);
                      } else {
                        res.isExist == false
                          ? await getConfirmResult(phone)
                          : toast.info(t("Số điện thoại này đã tồn tại"));
                      }
                    });
                  } else {
                    toast.info(t("Vui lòng nhập số điện thoại"));
                  }
                }}
                disabled={isWaitingOTPDelay || isSubmitting}
                text={t("Gửi mã OTP")}
                isLoading={loading}
                className={`text-sm rounded-sm ${
                  isWaitingOTPDelay ? "bg-gray-100" : "bg-primary-light"
                } border-l rounded-l-none h-full`}
                textPrimary
              />
            ) : (
              <i className="px-1">
                <HiOutlinePhone />
              </i>
            )
          }
        />
      </Field>
      <Field
        className={`w-full ${mode != "otp" && "hidden"}`}
        name="otp"
        label={t("Mã OTP")}
        required={mode == "otp"}
      >
        <Input
          stringLength={6}
          placeholder={t("Mã OTP sẽ được gửi qua tin nhắn")}
          className="text-sm font-light border-gray-200 sm:h-12 sm:text-base"
        />
      </Field>
      <Field
        className={`w-full ${mode != "password" && "hidden"}`}
        name="password"
        label={t("Mật khẩu")}
        required={mode == "password"}
      >
        <Input
          type="password"
          placeholder={t("Mật khẩu")}
          className="text-sm font-light border-gray-200 sm:h-12 sm:text-base"
        />
      </Field>
      <div className="flex justify-end mb-2 w-full">
        <Button
          unfocusable
          text={mode != "otp" ? t("Quên mật khẩu") : t("Quay lại")}
          disabled={isSubmitting}
          className="h-8 text-sm underline"
          onClick={handleForgotPasswordClick}
        />
      </div>
      <div className="flex flex-row gap-2 items-center">
        <Button
          text={
            mode != "otp" || (mode === "otp" && forgotPassQuery) ? t("Đăng nhập") : t("Đăng ký")
          }
          primary
          isLoading={isSubmitting}
          submit
          className="px-5 h-11 whitespace-nowrap rounded-full shadow sm:mt-2 sm:px-12"
        />
        {!forgotPassQuery && (
          <>
            <Button
              unfocusable
              textPrimary
              text={mode == "otp" ? t("Đăng nhập") : t("Đăng ký")}
              disabled={isSubmitting}
              className="h-5 underline whitespace-nowrap"
              onClick={() => {
                if (mode == "otp") {
                  setMode("password");
                } else {
                  setMode("otp");
                }
              }}
            />
          </>
        )}
      </div>
    </>
  );
}
