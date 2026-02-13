import { useRouter } from "next/router";
import { useState } from "react";
import {
  RiAccountPinBoxFill,
  RiBankCardLine,
  RiLockPasswordLine,
  RiUserSettingsLine,
} from "react-icons/ri";
import { uploadImage } from "../../../../../lib/helpers/image";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { AuthorityService, User, UserService } from "../../../../../lib/repo";
import { UserRoleEnum } from "../../../../../lib/repo/types";
import {
  Button,
  DatePicker,
  Field,
  Form,
  Input,
  Select,
  Switch,
} from "../../../../shared/utilities/form";
import { Img } from "../../../../shared/utilities/misc";

import { useTranslation } from "react-i18next";
import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { useScreen } from "../../../../../lib/hooks/useScreen";
import { UserBanksDialog } from "./account-banks-dialog";
import { SettingUserDialog } from "./account-partner-config-dialog";

interface Props extends ReactProps {
  user: User;
  setUser: (user: User) => any;
  loadAll?: (value: boolean) => any;
}

export function AccountOverview({ user, setUser, loadAll }: Props) {
  return (
    <>
      <ProfileHeader user={user} setUser={setUser} loadAll={loadAll} />
      <ProfileForm user={user} setUser={setUser} />
    </>
  );
}

function ProfileHeader({ user, setUser, loadAll }: Props) {
  const { t } = useTranslation();
  const { userPermission } = useAuth();
  const toast = useToast();
  const md = useScreen("md");
  const sm = useScreen("sm");
  const [openChangePasswordUser, setOpenChangePasswordUser] = useState<User>(null);
  const [openUserSetting, setOpenUserSetting] = useState<boolean>(false);
  const [openUserBanks, setOpenUserBanks] = useState<boolean>(false);
  const [uploading, setUploading] = useState(false);
  const login = useAuth();

  const { USER_STATUS_OPTIONS } = useOptionsTranslation();

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
        await UserService.update({ id: user.id, data: { avatar: res.link } }).then((res) => {
          setUser({ ...user, ...res });
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
      <div className="flex flex-col gap-2 xs:flex-row">
        <div className="flex">
          <Img
            lazyload={false}
            className="w-20 rounded"
            src={user?.avatar || "https://placekitten.com/120"}
            alt={user.name}
          />
          <div className="px-4">
            <div className="font-semibold text-gray-700">{user.name}</div>
            <div className="text-sm -mt-0.5 text-gray-600">{user.email}</div>
            <div className="flex flex-col gap-2 items-end mt-1 space-x-3 md:flex-row">
              <Button
                small
                primary
                icon={<RiAccountPinBoxFill />}
                className="w-32 whitespace-nowrap"
                text={t("Đổi avatar")}
                isLoading={uploading}
                onClick={imageHandler}
                disabled={login.user.id !== user.id && login.user.role !== "ADMIN"}
              />
              {login.user.id !== user.id && login.user.role == "ADMIN" && login.user.root && (
                <Button
                  small
                  accent
                  icon={<RiLockPasswordLine />}
                  className="w-32 whitespace-nowrap"
                  text={t("Đổi mật khẩu")}
                  onClick={() => setOpenChangePasswordUser(user)}
                />
              )}
            </div>
          </div>
        </div>
        <div className="relative w-40 border-gray-200 xs:pl-4 xs:border-l">
          <div className="text-sm font-semibold text-gray-600 pb-0.5">{t("Trạng thái")}</div>
          <div
            className={`uppercase font-semibold text-base text-${
              USER_STATUS_OPTIONS.find((x) => x.value == user.status)?.color
            }`}
          >
            {USER_STATUS_OPTIONS.find((x) => x.value == user.status)?.label}
          </div>
          <Switch
            placeholder={t("Kích hoạt")}
            className="whitespace-nowrap"
            readOnly={
              login.user.id == user.id ||
              (user.role === "ADMIN" && user.root) ||
              !userPermission("EDIT_USER")
            }
            value={user.status == "ACTIVE"}
            onChange={async (val) => {
              if (val === false && !userPermission("CREATE_USER")) {
                return toast.error(t("Bạn không đủ quyền"));
              }
              if (val === true && userPermission("CREATE_USER")) {
                await UserService.activeUser(user.id)
                  .then((res) => {
                    toast.success(t("Kích hoạt tài khoản thành công"));
                  })

                  .catch((err) => {
                    toast.error(t(`Kích hoạt tài khoản thất bại`), err);
                  });
                return;
              } else {
                if (val === true && !userPermission("CREATE_USER")) {
                  return toast.error(t("Bạn không đủ quyền"));
                }

                if (val === false && userPermission("CREATE_USER")) {
                  await UserService.blockUser(user.id)
                    .then((res) => {
                      toast.success(t("Khoá tài khoản thành công"));
                    })
                    .catch((err) => {
                      toast.error(t("Khoá tài khoản thất bại"), err);
                    });
                }
                // toast.error(t("Khoá tài khoản thất bại"));
              }
            }}
          />
          <div className={`absolute top-0 -right-12`}>
            {user.role === UserRoleEnum.PARTNER && (
              <Button
                className="p-3 mr-2 cursor-pointer"
                iconClassName="text-20"
                outline
                tooltip={t("Giới hạn tài khoản")}
                onClick={() => setOpenUserSetting(true)}
                icon={<RiUserSettingsLine />}
                disabled={!userPermission("LIMIT_USER")}
              />
            )}

            <Button
              iconClassName=" text-20"
              className="p-3 cursor-pointer"
              outline
              tooltip={t("Quản lý tài khoản ngân hàng")}
              onClick={() => setOpenUserBanks(true)}
              icon={<RiBankCardLine />}
              disabled={!userPermission("BANK_USER")}
            />
          </div>
        </div>

        <SettingUserDialog
          isOpen={openUserSetting}
          onClose={() => {
            setOpenUserSetting(false);
            loadAll(true);
          }}
          userId={user.id}
        />
        <UserBanksDialog
          isOpen={openUserBanks}
          onClose={() => setOpenUserBanks(false)}
          userId={user.id}
        />
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
            await UserService.updateUserPassword(openChangePasswordUser?.id, data.password);
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
        {/* <Field required name="oldPassword" label={t("Mật khẩu cũ")}>
          <Input type="password" />
        </Field> */}
        <Field required name="password" label={t("Mật khẩu mới")} validation={{ min: 6 }}>
          <Input type="password" />
        </Field>
        <Field
          label={t("Xác nhận mật khẩu mới")}
          name="retypePassword"
          required
          cols={6}
          validation={{
            confirmPassword: (value, values) => {
              if (value !== values["password"]) return t("Mật khẩu xác nhận không khớp");
              return "";
            },
            min: 6,
          }}
        >
          <Input type="password" />
        </Field>

        <Form.Footer
          cancelText=""
          submitText={t("Thay đổi")}
          onCancel={() => setOpenChangePasswordUser(null)}
        />
      </Form>
    </>
  );
}

function ProfileForm({ setUser, ...props }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const router = useRouter();
  const sm = useScreen("sm");
  const { user, userPermission } = useAuth();

  const onClose = () => router.replace({ pathname: location.pathname, query: {} });

  const { GENDER_OPTIONS } = useOptionsTranslation();
  const { USER_ROLES_OPTION } = useOptionsTranslation();
  return (
    <Form<User>
      grid
      defaultValues={props.user}
      onSubmit={async (data) => {
        await UserService.update({ id: props.user.id, data, toast }).then((res) => {
          setUser({ ...props.user, ...res });
          onClose();
        });
      }}
    >
      <Form.Title title={t("Thông tin cơ bản")} />
      <Field label={t("Mã nhân viên")} name="code" cols={sm ? 6 : 12} readOnly>
        <Input />
      </Field>
      <Field label={t("Email")} name="email" cols={sm ? 6 : 12} readOnly={user.role !== "ADMIN"}>
        <Input />
      </Field>

      <Field label={t("Họ và tên")} name="name" cols={sm ? 6 : 12}>
        <Input />
      </Field>
      <Field
        label={t("Vai trò")}
        name="role"
        required
        cols={sm ? 6 : 12}
        readOnly={user.role !== "ADMIN"}
      >
        <Select options={USER_ROLES_OPTION} />
      </Field>

      <Form.Title title={t("Thông tin tài khoản")} />
      <Field label={t("Chức vụ")} name="position" cols={sm ? 6 : 12}>
        <Input />
      </Field>
      <Field name="authorityId" label={t("Phân quyền")} readOnly cols={sm ? 6 : 12}>
        <Select
          optionsPromise={() =>
            AuthorityService.getAuthoritySelect().then((res) => {
              return res.map((item) => ({
                value: item._id,
                label: item.name,
              }));
            })
          }
          value={props.user.authorityId}
        />
      </Field>

      {/* <Field label="Người quản lý" name="managerId">
        <Select
          placeholder="Nhập mã hoặc tên người quản lý..."
          autocompletePromise={(props) =>
            UserService.getAllAutocompletePromise(props, {
              fragment: "id code name",
              parseOption: (i) => ({ label: `${i.code} - ${i.name}`, value: i.id }),
            })
          }
        />
      </Field> */}

      <Field
        label={t("Số điện thoại")}
        name="phone"
        validation={{ phone: true }}
        cols={sm ? 6 : 12}
      >
        <Input />
      </Field>
      <Field label={t("Ngày sinh")} name="birthday" cols={sm ? 6 : 12}>
        <DatePicker
          fullHeader
          defaultValue={new Date(1970, 0, 1)}
          yearRange={{ start: 1930, end: new Date().getFullYear() }}
        />
      </Field>
      <Field label={t("Giới tính")} name="gender" cols={sm ? 6 : 12}>
        <Select options={GENDER_OPTIONS} />
      </Field>
      <Field label={t("Địa chỉ")} name="address" cols={sm ? 6 : 12}>
        <Input />
      </Field>

      <Form.Footer
        className="pb-14 lg:pb-0"
        cancelText=""
        submitProps={{
          disabled:
            user.id == router.query["id"] ||
            !userPermission("EDIT_USER") ||
            (props.user.role === "ADMIN" && props.user.root),
        }}
      />
    </Form>
  );
}
