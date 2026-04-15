import { Player } from "@lottiefiles/react-lottie-player";
import { useRouter } from "next/router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Field, Form, Input } from "../../../components/shared/utilities/form";
import { useOptionsTranslation } from "../../../lib/hooks/useOptionsTranslate";
import { useAuth } from "../../../lib/providers/auth-provider";
import { useToast } from "../../../lib/providers/toast-provider";
import { CustomerService } from "../../../lib/repo";
import { Locale } from "../../../lib/repo/types";

export function UpdatePhoneNumberDialog({ ...props }) {
  return <UpdatePhoneNumberForm />;
}

const UpdatePhoneNumberForm = () => {
  const { t } = useTranslation();
  const { customer, setCustomer } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const toast = useToast();
  const [isSuccess, setIsSuccess] = useState(false);

  const { LOCALES } = useOptionsTranslation();
  const [selectCountryCode, setSelectCountryCode] = useState(LOCALES[0].value);
  const selectLocale = LOCALES.find((item) => item.value === selectCountryCode);

  // useEffect(() => {
  //   if (customer && !isOpen) {
  //     setIsOpen(!!customer?.phoneNumber ? false : true);
  //   }
  // }, [customer]);

  const handleSubmit = async (data) => {
    setLoading(true);
    try {
      await CustomerService.customerUpdatePhoneNumberAndPassword({
        password: data.password,
        ...(data.introduceCode ? { introduceCode: data.introduceCode } : {}),
      }).then((res) => {
        setLoading(false);
        toast.success(t("Cập nhật thành công"));
        setIsSuccess(true);
      });
    } catch (error) {
      toast.error(`${t("Cập nhật không thành công")}, ${error.message}`);
      setLoading(false);
    }
  };

  if (!customer) return null;
  return (
    <>
      <Form
        dialog
        width={400}
        onSubmit={handleSubmit}
        isOpen={isOpen}
        slideFromBottom={"none"}
        hasCloseIcon={false}
        onOverlayClick={() => {}}
      >
        {isSuccess ? (
          <UpdateSuccess setIsOpenModal={setIsOpen} />
        ) : (
          <UpdatePhoneNumberAndPasswordFields
            setSelectCountryCode={setSelectCountryCode}
            selectLocale={selectLocale}
            loading={loading}
          />
        )}
      </Form>
    </>
  );
};

interface UpdatePhoneNumberFormProps {
  selectLocale: Option<Locale> & {
    language: string;
    countryCode: string;
  };
  setSelectCountryCode: (value: Locale) => void;
  loading?: boolean;
}
const UpdatePhoneNumberAndPasswordFields = ({
  selectLocale,
  setSelectCountryCode,
  loading,
}: UpdatePhoneNumberFormProps) => {
  const { t } = useTranslation();

  return (
    <>
      <div>
        <div className="pt-3 pb-1 text-lg font-semibold text-center uppercase text-primary-dark">
          {t("Cập nhật số điện thoại")}
        </div>
      </div>
      <div className="mb-5">
        {t(
          "Tài khoản chưa có số điện thoại và mật khẩu, số điện thoại dùng để phục vụ việc mua hàng của quý khách, nên cập nhật chính xác !"
        )}
      </div>

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
      <Form.Footer cancelText="" isLoading={loading} />
    </>
  );
};

const UpdateSuccess = ({ setIsOpenModal }: { setIsOpenModal: (value: boolean) => void }) => {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <div className="flex flex-col justify-center items-center">
      <Player
        autoplay
        loop
        src={`/assets/lottie/success.json`}
        style={{ height: "200px", width: "200px" }}
      ></Player>
      <span className="text-lg font-semibold text-center">
        {t("Cập nhật số điện thoại và mật khẩu thành công")}
      </span>
      <span className="mt-2 text-sm text-center text-gray-500">
        {t("Bây giờ bạn cũng có thể đăng nhập hệ thống bằng mật khẩu mới này!")}
      </span>
      <div className="flex flex-wrap-reverse justify-center items-center mt-5">
        <Button
          primary
          text={t("Đóng")}
          onClick={() => {
            setIsOpenModal(false);
          }}
        />
      </div>
    </div>
  );
};
