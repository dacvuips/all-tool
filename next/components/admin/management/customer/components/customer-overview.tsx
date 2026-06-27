import { useState } from "react";
import { HiCurrencyDollar } from "react-icons/hi";
import {
  RiAccountPinBoxFill,
  RiLockPasswordLine,
  RiStackLine,
  RiUserStarLine,
} from "react-icons/ri";
import { uploadImage } from "../../../../../lib/helpers/image";
import { parseNumber } from "../../../../../lib/helpers/parser";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";

import { CustomerStatusEnum, UserRoleEnum } from "../../../../../lib/repo/types";
import { Button, DatePicker, Field, Form, Input, Switch } from "../../../../shared/utilities/form";
import { Img } from "../../../../shared/utilities/misc";

import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { useScreen } from "../../../../../lib/hooks/useScreen";
import { Customer, CustomerService } from "../../../../../lib/repo/customer/customer.repo";
import { CustomerCreditPointConfigDialog } from "./customer-credit-point-config-dialog";
import { CustomerPackageConfigDialog } from "./customer-package-config-dialog";
interface Props extends ReactProps {
  customer: Customer;
  setCustomer: (customer: Customer) => any;
  loadAll?: () => void;
  refreshList?: () => void;
}
export function CustomerOverviewTab({
  customer,
  loadAll,
  refreshList,
  setCustomer,
}: {
  customer: Customer;
  loadAll: () => void;
  refreshList?: () => void;
  setCustomer: (customer: Customer) => any;
}) {
  return (
    <>
      <ProfileHeader
        customer={customer}
        setCustomer={setCustomer}
        loadAll={loadAll}
        refreshList={refreshList}
      />
      <ProfileForm customer={customer} setCustomer={setCustomer} />
    </>
  );
}

function ProfileHeader({ customer, setCustomer, loadAll, refreshList }: Props) {
  const { t } = useTranslation();
  const { userPermission, user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [openChangePasswordUser, setOpenChangePasswordUser] = useState<Customer>(null);
  const [uploading, setUploading] = useState(false);
  const [openCustomerCreditPointConfig, setOpenCustomerCreditPointConfig] = useState(false);
  const [openCustomerPackageConfig, setOpenCustomerPackageConfig] = useState(false);

  const { CUSTOMER_STATUS_OPTIONS } = useOptionsTranslation();

  const imageHandler = async () => {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();
    input.onchange = async () => {
      setUploading(true);
      const file = input.files[0];
      try {
        const res = await uploadImage(file, true, { width: 200, height: 200, quality: 100 });
        await CustomerService.update({
          id: customer.id,
          data: { avatarUrl: res.link },
        }).then((res) => {
          setCustomer({ ...customer, ...res });
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
    <>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex gap-x-2 xs:gap-x-0">
          <Img
            lazyload={false}
            className="w-20 rounded"
            src={customer?.avatarUrl || "/assets/img/logo-icon.png"}
            alt={customer?.name}
          />
          <div className="xs:px-4">
            <div className="flex flex-row whitespace-nowrap">
              <div className="font-semibold text-accent">
                [{customer.name.slice(-20) || t("Chưa đặt tên")}]|
              </div>
              {user.role == UserRoleEnum.ADMIN && (
                <div className="font-semibold text-primary">{customer.phoneNumber}</div>
              )}
            </div>
            <div className="flex flex-row">
              <div className="text-accent">{parseNumber(customer.rewardPoint)}</div>
              <div className="mr-2 w-4">
                <HiCurrencyDollar className="text-yellow-500 text-20" />
              </div>
              <div className="mr-1 text-gray-500">{t("Điểm thưởng")} </div>
            </div>
            <div className="flex flex-col gap-2 items-start mt-1 md:flex-row">
              <Button
                small
                primary
                icon={<RiAccountPinBoxFill />}
                className="w-32 whitespace-nowrap"
                text={t("Đổi avatar")}
                isLoading={uploading}
                onClick={imageHandler}
                disabled={!userPermission("EDIT_CUSTOMER")}
              />
              <Button
                small
                accent
                icon={<RiLockPasswordLine />}
                className="w-32 whitespace-nowrap"
                text={t("Đổi mật khẩu")}
                onClick={() => setOpenChangePasswordUser(customer)}
                disabled={user.role !== "ADMIN"}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-row">
          <div className="relative w-full border-gray-200 sm:pl-4 sm:border-l">
            <div className="text-sm font-semibold text-gray-600 pb-0.5">{t("Gói dùng thử")}</div>
            <div
              className={`font-semibold text-base ${
                customer.hasActivatedTrial ? "text-amber-700" : "text-gray-400"
              }`}
            >
              {customer.hasActivatedTrial ? t("Đã kích hoạt 1 lần") : t("Chưa kích hoạt")}
            </div>
            <div className="text-sm font-semibold text-gray-600 pb-0.5 mt-2">{t("Trạng thái")}</div>
            <div
              className={`uppercase font-semibold text-base text-${
                CUSTOMER_STATUS_OPTIONS.find((x) => x.value == customer.status)?.color
              }`}
            >
              {CUSTOMER_STATUS_OPTIONS.find((x) => x.value == customer.status)?.label}
            </div>
            <Switch
              placeholder={t("Kích hoạt")}
              className="whitespace-nowrap"
              readOnly={!userPermission("EDIT_CUSTOMER")}
              value={customer.status == "ACTIVE"}
              onChange={async (val) => {
                if (val === true && userPermission("EDIT_CUSTOMER")) {
                  await CustomerService.update({
                    id: customer.id,
                    data: { status: CustomerStatusEnum.ACTIVE },
                  })
                    .then((res) => {
                      toast.success(t("Kích hoạt tài khoản thành công"));
                      router.replace({ pathname: location.pathname, query: {} });
                    })

                    .catch((err) => {
                      toast.error(t("Kích hoạt tài khoản thất bại"));
                    });
                  return;
                } else {
                  if (val === false && userPermission("EDIT_CUSTOMER")) {
                    await CustomerService.update({
                      id: customer.id,
                      data: { status: CustomerStatusEnum.BLOCKED },
                    })
                      .then((res) => {
                        toast.success(t("Khóa tài khoản thành công"));
                        router.replace({ pathname: location.pathname, query: {} });
                      })

                      .catch((err) => {
                        toast.error(t("Khóa tài khoản thất bại"));
                      });
                    return;
                  }
                }
              }}
            />
            <div className={`flex flex-row gap-2`}>
              <Button
                small
                outline
                disabled={!userPermission("EDIT_CUSTOMER")}
                icon={<RiUserStarLine />}
                text={t("Cấu hình uy tín")}
                className="whitespace-nowrap"
                onClick={() => setOpenCustomerCreditPointConfig(true)}
              />
              <Button
                small
                outline
                disabled={!userPermission("EDIT_CUSTOMER")}
                icon={<RiStackLine />}
                text={t("Cấu hình gói")}
                className="whitespace-nowrap"
                onClick={() => setOpenCustomerPackageConfig(true)}
              />
            </div>
          </div>
        </div>
      </div>
      <Form
        title={t("Thay đổi mật khẩu")}
        defaultValues={openChangePasswordUser}
        dialog
        width="400px"
        isOpen={!!openChangePasswordUser}
        onClose={() => setOpenChangePasswordUser(null)}
        slideFromBottom="none"
        onSubmit={async (data) => {
          try {
            await CustomerService.customerChangePasswordUser({
              customerId: openChangePasswordUser?.id,
              newPassword: data.newPassword,
            });
            setOpenChangePasswordUser(null);
            toast.success(t("Thay đổi mật khẩu thành công."));
          } catch (err) {
            toast.error(t("Thay đổi mật khẩu thất bại. ") + err.message);
          }
        }}
      >
        <Field readOnly label={t("Tài khoản")}>
          <Input value={`${openChangePasswordUser?.name} - ${openChangePasswordUser?.email}`} />
        </Field>

        <Field required name="newPassword" label={t("Mật khẩu mới")} validation={{ min: 6 }}>
          <Input type="password" placeholder={t("Nhập mật khẩu mới")} />
        </Field>
        <Field
          label={t("Xác nhận mật khẩu mới")}
          name="retypePassword"
          required
          cols={6}
          validation={{
            confirmPassword: (value, values) => {
              if (value !== values["newPassword"]) return t("Mật khẩu xác nhận không khớp");
              return "";
            },
          }}
        >
          <Input type="password" placeholder={t("Nhập lại mật khẩu mới")} />
        </Field>

        <Form.Footer
          onCancel={() => setOpenChangePasswordUser(null)}
          submitProps={{ disabled: !userPermission("EDIT_CUSTOMER") }}
        />
      </Form>

      <CustomerCreditPointConfigDialog
        isOpen={openCustomerCreditPointConfig}
        onClose={() => {
          setOpenCustomerCreditPointConfig(false);
        }}
        loadAll={loadAll}
        customer={customer}
      />

      <CustomerPackageConfigDialog
        isOpen={openCustomerPackageConfig}
        onClose={() => {
          setOpenCustomerPackageConfig(false);
        }}
        setCustomer={setCustomer}
        refreshList={refreshList}
        customer={customer}
      />
    </>
  );
}

function ProfileForm({ setCustomer, ...props }: Props) {
  const { t } = useTranslation();
  const { userPermission, user } = useAuth();
  const toast = useToast();
  const sm = useScreen("sm");
  return (
    <Form<Customer>
      grid
      defaultValues={props.customer}
      onSubmit={async (data) => {
        await CustomerService.update({
          id: props.customer.id,
          data,
        })
          .then((res) => {
            toast.success(t("Cập nhật khách hàng thành công"));
            setCustomer({ ...props.customer, ...res });
          })
          .catch((err) => {
            toast.success(t("Cập nhật khách hàng thất bại"));
            console.log(err);
          });
      }}
    >
      <Form.Title title={t("Thông tin tài khoản")} />

      <Field label={t("Họ và tên")} name="name" cols={sm ? 6 : 12}>
        <Input />
      </Field>
      {user.role == UserRoleEnum.ADMIN && (
        <Field
          label={t("Số điện thoại")}
          name="phoneNumber"
          validation={{ phone: true }}
          cols={sm ? 6 : 12}
          readOnly
        >
          <Input />
        </Field>
      )}

      <Field label={t("Ngày sinh")} name="birthday" cols={sm ? 6 : 12}>
        <DatePicker
          fullHeader
          defaultValue={new Date(1970, 0, 1)}
          yearRange={{ start: 1930, end: new Date().getFullYear() }}
        />
      </Field>
      {/* <Field label={"Giới tính"} name="gender"  cols={sm ? 6 : 12}>
        <Select options={USER_GENDERS} />
      </Field> */}
      <Field label={t("Địa chỉ")} name="address" cols={sm ? 6 : 12}>
        <Input />
      </Field>
      <Field label={t("Email")} name="email" cols={sm ? 6 : 12}>
        <Input />
      </Field>

      <Form.Footer
        cancelText=""
        submitProps={{ disabled: !userPermission("EDIT_CUSTOMER") }}
        className="pb-14 lg:pb-0"
      />
    </Form>
  );
}
