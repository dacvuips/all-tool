import { useEffect, useState } from "react";

import { useFormContext } from "react-hook-form";
import { useAuth } from "../../../lib/providers/auth-provider";
import { useToast } from "../../../lib/providers/toast-provider";
import { SlideCaptchaVerifyDialog } from "../../shared/common/slide-captcha_verify";
import { Button } from "../../shared/utilities/form/button";
import { Field } from "../../shared/utilities/form/field";
import { Form } from "../../shared/utilities/form/form";
import { Input } from "../../shared/utilities/form/input";
import { Spinner } from "../../shared/utilities/misc";

import { useTranslation } from "react-i18next";
import { RiUser3Line } from "react-icons/ri";
export function LoginPage() {
  const { t } = useTranslation();
  const { user, loginFirebaseEmail, redirectToAdmin } = useAuth();
  const [openSlideVerify, setOpenSlideVerify] = useState(null);
  const toast = useToast();

  useEffect(() => {
    if (user) {
      redirectToAdmin();
    }
  }, [user]);

  const login = async ({ username, password }) => {
    if (username && password) {
      setOpenSlideVerify({ username, password: password });
    }
  };

  return (
    <div
      className="flex flex-col min-h-screen bg-center bg-no-repeat bg-cover"
      style={{
        backgroundImage: `url(/assets/img/bg-admin-login.jpg)`,
      }}
    >
      <div className="flex items-center justify-center flex-1 w-screen ">
        {user !== undefined ? (
          <Spinner />
        ) : (
          <Form
            className="flex flex-col w-11/12 p-6 bg-white rounded-lg shadow-xl md:w-5/12 max-w-screen-xs"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.85)" }}
            onSubmit={async (data) => {
              await login(data);
            }}
          >
            <img className="w-44 h-auto py-4 mx-auto" src="/assets/img/logo-full.png" />
            <h2 className="mb-4 text-xl font-semibold text-center text-gray-700 uppercase">
              {t("Đăng nhập Admin")}
            </h2>
            <Field className="mb-1" name="username" required>
              <Input
                className="rounded-full h-14"
                placeholder={t("Email / Tên đăng nhập")}
                autoFocus
                suffix={<RiUser3Line />}
              />
            </Field>
            <Field className="mb-1 " name="password" required>
              <Input className="rounded-full h-14" type="password" placeholder={t("Mật khẩu")} />
            </Field>
            <SubmitButton />
          </Form>
        )}
      </div>
      <SlideCaptchaVerifyDialog
        openSlideVerify={openSlideVerify}
        setOpenSlideVerify={setOpenSlideVerify}
        onSuccess={async () => {
          await loginFirebaseEmail(openSlideVerify.username, openSlideVerify.password)
            .then((user) => {
              setOpenSlideVerify(undefined);
            })
            .catch((err) => {
              console.error(err);
              toast.error(t("Đăng nhập thất bại.") + err.message);
              setOpenSlideVerify(undefined);
            });
        }}
        onFail={() => toast.error(t("Xác thực bảo mật thất bại"))}
      />
      {/* <Footer className="border-none text-primary-light" /> */}
    </div>
  );
}

function SubmitButton() {
  const { t } = useTranslation();
  const {
    formState: { isSubmitting },
  } = useFormContext();
  return (
    <Button
      submit
      primary
      className="h-14"
      text={t("Đăng nhập quản trị")}
      isLoading={isSubmitting}
    />
  );
}
