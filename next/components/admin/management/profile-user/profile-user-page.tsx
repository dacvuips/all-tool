import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineLockClosed } from "react-icons/hi";
import {
  HiArrowRightOnRectangle,
  HiOutlineCalendarDays,
  HiOutlineEnvelope,
  HiOutlineHome,
  HiOutlinePhone,
  HiOutlineUser,
} from "react-icons/hi2";
import { formatDate } from "../../../../lib/helpers/parser";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { useToast } from "../../../../lib/providers/toast-provider";

import { RiCheckboxCircleLine, RiCloseCircleLine } from "react-icons/ri";
import { useOptionsTranslation } from "../../../../lib/hooks/useOptionsTranslate";
import { SlideCaptchaVerifyDialog } from "../../../shared/common/slide-captcha_verify";
import { Button, Field, Form, Input, Label } from "../../../shared/utilities/form";
import { Card, Img } from "../../../shared/utilities/misc";
import { StatusLabel } from "../../../shared/utilities/misc/status-label";
import { ProfileUserAuthorityDetail } from "./components/profile-user-authority-detail";
export function ProfileUserPage() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [openChangePasswordDialog, setOpenChangePasswordDialog] = useState(false);
  const [game, setGame] = useState([]);

  const { USER_STATUS_OPTIONS } = useOptionsTranslation();

  const INFOS = useMemo(() => {
    return [
      {
        title: t("Email"),
        icon: <HiOutlineEnvelope />,
        color: "red",
        value: user.email || "--",
      },
      {
        title: t("Số điện thoại"),
        icon: <HiOutlinePhone />,
        color: "green",
        value: user.phone || "--",
      },
      {
        title: t("Ngày sinh"),
        icon: <HiOutlineCalendarDays />,
        color: "blue",
        value: formatDate(user.birthday, "date") || "--",
      },
      {
        title: t("Giới tính"),
        icon: <HiOutlineUser />,
        color: "yellow",
        value: user.gender || "--",
      },
      {
        title: t("Địa chỉ"),
        icon: <HiOutlineHome />,
        color: "purple",
        value: user.address || "--",
      },
    ];
  }, [user]);

  return (
    <Card>
      <div className="grid grid-cols-12 gap-5 min-w-5xl">
        <div className="col-span-4">
          <div className={`flex flex-col gap-3 justify-center p-4 text-center rounded-lg min-w-xs`}>
            <div>
              <Img
                className={`relative w-48 h-48 mx-auto bg-gray-100 border-4  rounded-full ${
                  user.status == "ACTIVE" ? "border-success" : "border-red-600"
                }`}
                src={user.avatar || "/assets/default/avatar.png"}
              ></Img>
            </div>
            <span className="text-2xl font-bold uppercase">{user.name}</span>
            <span className="flex flex-row justify-center">
              {t("Chức vụ") + ": " + (user.position || "--")} {" | "}{" "}
              {t("Mã") + ": " + (user.code || "--")}
            </span>
            <StatusLabel
              extraClassName="rounded-full max-w-28 mx-auto"
              options={USER_STATUS_OPTIONS}
              value={user.status}
            />
            <div className="flex flex-row gap-3 justify-center">
              <div
                onClick={() => setOpenChangePasswordDialog(true)}
                className="flex flex-row gap-2 items-center px-2 rounded-full border cursor-pointer border-bluegray-700 bg-bluegray-50"
              >
                <i className="text-bluegray-700">
                  <HiOutlineLockClosed />
                </i>
                <span className="text-bluegray-700">{t("Đổi mật khẩu")}</span>
              </div>
              <div
                onClick={() => logout()}
                className="flex flex-row gap-2 items-center px-2 bg-red-50 rounded-full border border-red-700 cursor-pointer"
              >
                <i className="text-red-700">
                  <HiArrowRightOnRectangle />
                </i>
                <span className="text-red-700">{t("Đăng xuất")}</span>
              </div>
            </div>
          </div>

          <div>
            <div>
              <Label className="mb-3" text={t("Thông tin")} />
              <div>
                {INFOS.map((info, index) => (
                  <div key={index} className="flex gap-3 mb-4 w-full">
                    <div
                      className={`flex items-center justify-center p-5 text-center rounded-xl w-11 h-11 bg-${info.color}-50`}
                    >
                      <i className={`text-xl text-${info.color}-600`}>{info.icon}</i>
                    </div>
                    <div>
                      <div className="flex flex-col">
                        <span className="text-gray-500">{t(info.title)}</span>
                        <div>{info.value}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Label className="mb-3" text={t("Phân quyền game")} />
              <div className="grid grid-cols-2 gap-2">
                {game?.map((game, index) => (
                  <div
                    data-tooltip={game.name}
                    data-placement="top"
                    key={index}
                    className={`relative col-span-1 w-full rounded-md border`}
                  >
                    <div className="absolute top-1 left-1">
                      {game.active ? (
                        <Button
                          tooltip={t("Game đang được kích hoạt")}
                          iconClassName="text-20"
                          icon={<RiCheckboxCircleLine />}
                          textSuccess
                          className="px-0 h-5"
                        />
                      ) : (
                        <Button
                          tooltip={t("Game ngừng kích hoạt")}
                          iconClassName="text-20"
                          icon={<RiCloseCircleLine />}
                          textDanger
                          className="px-0 h-5"
                        />
                      )}
                    </div>
                    <img src={game.logoUrl} className="p-2 mx-auto w-28 h-14"></img>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="col-span-8">
          <ProfileUserAuthorityDetail />
        </div>
      </div>
      <ChangePasswordDialog
        isOpen={openChangePasswordDialog}
        onClose={() => setOpenChangePasswordDialog(false)}
      />
    </Card>
  );
}

export function ChangePasswordDialog({ ...props }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { user, userExchangePassword } = useAuth();

  const [openSlideVerify, setOpenSlideVerify] = useState(null);
  const changePassword = async ({ userId, oldPassword, password }) => {
    if (userId && oldPassword && password) {
      setOpenSlideVerify({ userId, oldPassword: oldPassword, password: password });
    }
  };
  return (
    <>
      <Form
        width={500}
        title={t("Thay đổi mật khẩu")}
        dialog
        onSubmit={async (data) => {
          await changePassword({
            userId: user.id,
            oldPassword: data.oldPassword,
            password: data.password,
          });
        }}
        {...props}
      >
        <Field required name="oldPassword" label={t("Mật khẩu cũ")} validation={{ min: 6 }}>
          <Input type="password" placeholder={t("Nhập mật khẩu cũ của bạn")} />
        </Field>
        <Field
          required
          name="password"
          label={t("Mật khẩu mới")}
          validation={{
            newPassword: (value, values) => {
              if (value === values["oldPassword"])
                return t("Mật khẩu mới không được trùng với mật khẩu cũ");
              return "";
            },
            min: 6,
          }}
        >
          <Input type="password" placeholder={t("Nhập mật khẩu mới của bạn")} />
        </Field>
        <Field
          required
          name="retypePassword"
          label={t("Nhập lại mật khẩu mới")}
          validation={{
            checkPassword: (value, values) => {
              if (value != values["password"]) return t("Mật khẩu nhập lại không khớp");
              return "";
            },
            min: 6,
          }}
        >
          <Input type="password" placeholder={t("Nhập lại mật khẩu mới")} />
        </Field>
        <Form.Footer />
        <SlideCaptchaVerifyDialog
          openSlideVerify={openSlideVerify}
          setOpenSlideVerify={setOpenSlideVerify}
          onSuccess={async () => {
            await userExchangePassword(
              openSlideVerify.userId,
              openSlideVerify.oldPassword,
              openSlideVerify.password
            )
              .then((res) => {
                props.onClose();
                toast.success(t("Thay đổi mật khẩu thành công."));
                setOpenSlideVerify(undefined);
              })
              .catch((err) => {
                toast.error(
                  t("Thay đổi mật khẩu thất bại. Mật khẩu cũ không đúng hoặc hệ thống bận")
                ) + err.message;
                setOpenSlideVerify(undefined);
              });
          }}
          onFail={() => toast.error(t("Xác thực bảo mật thất bại"))}
        />
      </Form>
    </>
  );
}
