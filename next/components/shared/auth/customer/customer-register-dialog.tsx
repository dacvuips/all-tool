import { Player } from "@lottiefiles/react-lottie-player";
import md5 from "md5";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AiOutlineUser } from "react-icons/ai";
import { HiOutlineMail } from "react-icons/hi";
import { RiBarcodeBoxLine, RiStore2Line } from "react-icons/ri";
import { useDevice } from "../../../../lib/hooks/useDevice";
import { useScreen } from "../../../../lib/hooks/useScreen";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { useGlobalContext } from "../../../../lib/providers/global-provider";
import { useToast } from "../../../../lib/providers/toast-provider";
import { CustomerService } from "../../../../lib/repo";
import { SlideCaptchaVerifyDialog } from "../../common/slide-captcha_verify";
import { DialogProps } from "../../utilities/dialog/dialog";
import { Checkbox, Field, Form, Input } from "../../utilities/form";

interface Props extends DialogProps {
  idToken: string;
}
export function CustomerRegisterDialog({ idToken, ...props }: Props) {
  const { t } = useTranslation();
  const { customer, setCustomer } = useAuth();
  const [defaultValues, setDefaultValues] = useState<any>({});
  const { setOpenCustomerLoginDialog } = useGlobalContext();
  const [openSlideVerify, setOpenSlideVerify] = useState(null);
  const [introduceValue, setIntroduceValue] = useState<string>(null); // [1
  const toast = useToast();
  const { isMobile } = useDevice();
  const screenLg = useScreen("lg");

  useEffect(() => {
    if (props.isOpen) {
      setDefaultValues({});
    }
  }, [props.isOpen, idToken]);

  return (
    <>
      <Form
        title={t("Yêu cầu đăng ký tài khoản")}
        dialog
        minWidth={screenLg ? "400px" : "280px"}
        headerClass={`bg-white rounded-2xl flex flex-row px-5 pt-2`}
        defaultValues={defaultValues}
        allowResetDefaultValues
        dialogClass="rounded-2xl relative bg-white my-auto"
        bodyClass="p-5"
        {...props}
        onOverlayClick={() => toast.info(t("Vui lòng hoàn thành bảng đăng ký"))}
        hasCloseIcon={false}
        onClose={() => {
          if (!customer) {
            toast.info(t("Bạn chưa tạo xong bảng đăng ký."));
            return;
          }
          props.onClose();
        }}
        onSubmit={async (data) => {
          const value = {
            firebaseToken: idToken,
            name: data.name,
            email: data.email,
            password: md5(data.password),
            shopName: data.shopName,
            introduceCode: data.introduceCode.toString().trim().toUpperCase(),
          };
          await setOpenSlideVerify({ value });
        }}
      >
        <div className="flex">
          {screenLg && !isMobile && (
            <Player
              autoplay
              loop
              src={`/assets/lottie/regis-customer.json`}
              style={{ height: "350px", width: "350px" }}
            ></Player>
          )}
          <div className={`${screenLg && !isMobile ? "w-96 bg-gray-50 p-4 rounded-lg" : "w-full"}`}>
            <Field
              name="name"
              label={t("Họ và tên")}
              description={t("Họ tên đầy đủ của bạn")}
              required
              validation={{ min: 6 }}
            >
              <Input
                suffix={<AiOutlineUser />}
                className="text-sm font-light border-gray-200 sm:h-12 sm:text-base"
                suffixClassName="text-gray-400 text-xl"
                placeholder={`${t("Nhập họ và tên")}...`}
                stringLength={25}
              />
            </Field>
            <Field
              name="email"
              label={t("Email")}
              description={t("Email chính xác của bạn, để nhận email từ sàn")}
              required
              validation={{ email: true }}
            >
              <Input
                suffix={<HiOutlineMail />}
                className="text-sm font-light border-gray-200 sm:h-12 sm:text-base"
                suffixClassName="text-gray-400 text-xl"
                placeholder={`${t("Nhập email của bạn")}...`}
                stringLength={40}
              />
            </Field>
            <Field
              required
              name="password"
              label={t("Mật khẩu mới")}
              description={t("Mật khẩu đăng nhập của bạn")}
              validation={{
                newPassword: (value, values) => {
                  if (value === values["oldPassword"])
                    return t("Mật khẩu mới không được trùng với mật khẩu cũ");
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
              name="retypePassword"
              label={t("Nhập lại mật khẩu mới")}
              description={t("Xác nhận lại mật khẩu đăng nhập của bạn")}
              validation={{
                checkPassword: (value, values) => {
                  if (value != values["password"]) return t("Mật khẩu nhập lại không khớp");
                  return "";
                },
              }}
            >
              <Input
                placeholder={t("Xác mật khẩu mới")}
                type="password"
                className="text-sm font-light border-gray-200 sm:h-12 sm:text-base"
              />
            </Field>

            <Field
              name="shopName"
              label={t("Tên cửa hàng")}
              description={t(
                "Tên cửa hàng bạn muốn đăng ký mới (free), tạo cửa hàng để bạn có thể mua/bán vật phẩm trên sàn giao dịch an toàn 100%"
              )}
              required
              validation={{ min: 6 }}
            >
              <Input
                suffix={<RiStore2Line />}
                className="text-sm font-light border-gray-200 sm:h-12 sm:text-base"
                suffixClassName="text-gray-400 text-xl"
                placeholder={`${t("Nhập tên cửa hàng mong muốn")}...`}
                stringLength={25}
              />
            </Field>

            <Field
              name="introduceCode"
              label={t("Mã giới thiệu")}
              description={t("Mã code mà người giới thiệu bạn đưa cho bạn (nếu có)")}
              validation={{ code: true }}
            >
              <Input
                suffix={<RiBarcodeBoxLine />}
                inputStyle={{ textTransform: `${introduceValue ? "uppercase" : ""}` }}
                className="text-sm font-light border-gray-200 sm:h-12 sm:text-base"
                suffixClassName="text-gray-400 text-xl"
                placeholder={`${t("Nhập mã giới thiệu của bạn (nếu có)")}...`}
                stringLength={15}
                onChange={(e) => setIntroduceValue(e)}
              />
            </Field>

            <Field name="confirm" required className="flex flex-row w-full">
              <Checkbox
                value={true}
                textCustom={
                  <span>
                    {t("Tôi đã đọc và ")}
                    <Link
                      href={"/post/policy"}
                      target="_blank"
                      className="underline hover:text-primary"
                    >
                      {t("chấp nhận chính sách sàn!")}
                    </Link>
                  </span>
                }
              />
            </Field>
            <Form.Footer cancelText="" submitText={t("Gửi đăng ký")} />
          </div>
        </div>
      </Form>
      <SlideCaptchaVerifyDialog
        openSlideVerify={openSlideVerify}
        setOpenSlideVerify={setOpenSlideVerify}
        onSuccess={async () => {
          await CustomerService.customerRegister(openSlideVerify.value)
            .then(async (res) => {
              setOpenSlideVerify(undefined);
              toast.success(t("Đăng ký thành công"));

              await props.onClose();
              await setOpenCustomerLoginDialog(true);
            })
            .catch((err) => {
              setOpenSlideVerify(undefined);
              console.error(err);
              toast.error(t("Đăng ký thất bại. ") + err.message);
            });
        }}
        onFail={() => toast.error(t("Xác thực bảo mật thất bại"))}
      />
    </>
  );
}
