import copy from "copy-to-clipboard";
import { useRouter } from "next/router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AiOutlineMail, AiOutlineMobile, AiOutlineUser } from "react-icons/ai";
import { RiCameraSwitchFill, RiLockPasswordLine, RiUser2Line } from "react-icons/ri";
import { useHomeLayoutContext } from "../../../../../layouts/home-layout/provider/home-layout-provider";
import { uploadImage } from "../../../../../lib/helpers/image";
import { useScreen } from "../../../../../lib/hooks/useScreen";
import { useSettingPublic } from "../../../../../lib/hooks/useSettingPublic";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useGlobalContext } from "../../../../../lib/providers/global-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { NotifyText } from "../../../../shared/common/notify-text";
import { Button, Field, Form, Input } from "../../../../shared/utilities/form";
import { Img } from "../../../../shared/utilities/misc";
import { AddressSelector } from "../../../cart/address-selector";
import { ProfileAccountBankInfo } from "./profile-account-bank";
export function ProfileAccount({ ...props }) {
  const { t } = useTranslation();
  const toast = useToast();
  const router = useRouter();
  const screenLg = useScreen("lg");
  const isMandatoryBankUpdate = useSettingPublic("pa-c-bank");
  const { customer, setCustomer, customerUpdateProfile } = useAuth();

  const { wallet } = useHomeLayoutContext();
  const { setOpenChangePasswordDialog } = useGlobalContext();
  const [uploading, setUploading] = useState(false);
  const [hiddenPhone, setHiddenPhone] = useState<Boolean>(true);
  function copyToClipboard(text) {
    copy(text);
    toast.success(t("Đã sao chép mã khách hàng"), { position: "bottom-right" });
  }
  const handleChangeAvatar = async () => {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();
    input.onchange = async () => {
      setUploading(true);
      const file = input.files[0];
      try {
        const res = await uploadImage(file, true, { width: 200, height: 200, quality: 100 });

        await customerUpdateProfile({
          avatarUrl: res.link,
          name: customer.name,
          address: customer.address,
        }).then((res) => {
          toast.success(t("Cập nhật ảnh đại diện thành công"));
        });
      } catch (err) {
        console.error(err);
        toast.error(t("Cập nhật ảnh đại diện thất bại"));
      } finally {
        setUploading(false);
      }
    };
  };

  return (
    <div className="p-4 text-base bg-white rounded-md text-accent ">
      <div className="flex gap-2 items-center px-1 pb-2 border-gray-100">
        <RiUser2Line className="text-xl text-primary" />
        <div>
          <p className="font-semibold text-gray-800">{t("Hồ sơ của tôi")}</p>
        </div>
      </div>

      <div className="flex flex-row items-center justify-between overflow-hidden">
        <div className="flex flex-row items-center">
          <div className="relative hover:opacity-70">
            <Img
              src={customer?.avatarUrl}
              avatar
              className="object-cover w-16 border border-gray-100 rounded-full shadow-sm lg:w-20"
            />
            <Button
              icon={<RiCameraSwitchFill />}
              iconClassName="text-xl lg:text-2xl"
              className="absolute bottom-0 h-6 text-accent hover:text-primary -right-7"
              onClick={handleChangeAvatar}
              isLoading={uploading}
              tooltip={t("Đổi ảnh đại diện")}
            />
          </div>
          <div className="ml-4 overflow-hidden">
            <div className="flex items-center">
              <div className="font-bold leading-6 capitalize text-ellipsis text-accent text-20">
                {customer?.name?.slice(0, 30)}
              </div>
            </div>
            <div className="mb-2" onClick={() => copyToClipboard(customer?.code)}>
              <span className="font-semibold">{`[${t("Mã KH")}]: `}</span>
              <span>{customer?.code}</span>
            </div>

            {/* <div className="flex flex-row items-center overflow-hidden text-sm lg:text-base text-ellipsis">
              <div className="text-gray-400 whitespace-nowrap">Số dư ví: </div>{" "}
              <div className="ml-2 text-accent text-ellipsis">
                {parseNumber(globalCustomer?.walletGlobal.balance)} đ
              </div>{" "}
            </div> */}
          </div>
        </div>
      </div>
      <NotifyText
        color="blue"
        className="mt-2"
        text={t(
          "Quý khách hàng tuyệt đối không cung cấp số điện thoại, mật khẩu, otp cho bất kỳ ai kể cả Admin và giao dịch viên"
        )}
      />
      <div className="my-4 mt-0 lg:mt-0 lg:my-8">
        {!!isMandatoryBankUpdate && (
          <>
            <Form.Title
              className="pt-2 font-semibold text-primary"
              title={t("Thông tin ngân hàng")}
            />
            <ProfileAccountBankInfo />
          </>
        )}
        <Form
          grid
          defaultValues={customer}
          onSubmit={async (data) => {
            await customerUpdateProfile({ avatarUrl: customer.avatarUrl, ...data })
              .then(async (res) => {
                toast.success(t(`Cập nhật thông tin thành công`));
              })
              .catch((err) => {
                toast.error(`${t("Cập nhật thông tin thất bại")}. ${err.message}`);
              });
          }}
        >
          <Form.Title className="mt-5 font-semibold text-primary" title={t("Thông tin hồ sơ")} />
          <Field
            name="name"
            label={t("Họ và tên")}
            cols={screenLg ? 6 : 12}
            required
            validation={{ min: 6 }}
          >
            <Input
              suffix={<AiOutlineUser />}
              suffixClassName="text-gray-400 text-xl"
              inputClassName="text-sm font-semibold text-gray-600"
              placeholder={`${t("Nhập họ và tên")}...`}
            />
          </Field>
          <Field name="phoneNumber" label={t("Số điện thoại")} cols={screenLg ? 6 : 12} readOnly>
            <Input
              type="password"
              suffix={<AiOutlineMobile />}
              suffixClassName="text-gray-400 text-xl"
              inputClassName="text-sm font-semibold text-gray-600"
              placeholder={`${t("Nhập sdt")}...`}
            />
          </Field>
          <Field name="email" label="Email" cols={screenLg ? 6 : 12} readOnly>
            <Input
              suffix={<AiOutlineMail />}
              suffixClassName="text-gray-400 text-xl"
              inputClassName="text-sm font-semibold text-gray-600"
              placeholder={t("Nhập email")}
            />
          </Field>
          <AddressSelector />
          <div
            className="flex items-center col-span-12 mb-2 text-sm font-semibold cursor-pointer hover:text-danger text-primary md:text-base"
            onClick={() => setOpenChangePasswordDialog(true)}
          >
            <i className="mr-2 text-20">
              <RiLockPasswordLine />
            </i>
            {t("Đổi mật khẩu")}
          </div>
          <Form.Footer
            submitText={t("Lưu thay đổi")}
            submitProps={{
              className: "w-full flex flex-1 lg:w-auto lg:flex-none",
              large: !screenLg,
            }}
            cancelText=""
          />
        </Form>
      </div>
    </div>
  );
}
