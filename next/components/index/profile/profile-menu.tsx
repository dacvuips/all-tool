import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../lib/providers/auth-provider";
import { Button } from "../../shared/utilities/form/button";
import { Img } from "../../shared/utilities/misc";
import { ProfileMenuList } from "./profile-page";

type Props = {};

export function ProfileMenu({ selectedMenu, ...props }) {
  const { t } = useTranslation();
  const { customer, logoutCustomer } = useAuth();
  const router = useRouter();
  const PROFILE_MENUS = ProfileMenuList();

  return (
    <div className="w-1/5 h-full bg-white rounded-md">
      {customer && (
        <div className="flex flex-row items-center p-5 border-b">
          <Img
            src={customer?.avatarUrl ? customer?.avatarUrl : "/assets/default/avatar.png"}
            className="object-cover w-16 rounded-full"
          />
          <div className="ml-4 w-full overflow-ellipsis">
            <div className="">{t("Tài khoản của")}</div>
            <div className="font-semibold leading-6 capitalize whitespace-nowrap text-ellipsis text-accent text-18">
              {customer.name ? customer.name : customer.phoneNumber}
            </div>
            {customer.status == "ACTIVE" ? (
              <div className="flex flex-row items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div className="ml-2 text-green-500">{t("Đang hoạt động")}</div>
              </div>
            ) : (
              <div className="flex flex-row items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <div className="ml-2 text-red-500">{t("Bị khóa")}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {PROFILE_MENUS.map((item, index) => {
        const selected = item.href == selectedMenu?.href;

        return (
          <Link href={item.href} key={index}>
            <div
              className={`${
                selected ? "bg-primary-light" : "flex flex-row items-center py-4"
              } hover:bg-gray-50`}
            >
              <span className="pl-7 mr-4 text-primary text-24"> {item.icon}</span>
              <span className="font-semibold text-accent">{item.label}</span>
            </div>
          </Link>
        );
      })}
      <Button
        text={t("Đăng xuất")}
        className="mt-5 font-semibold text-primary"
        onClick={() => {
          logoutCustomer();
          router.replace("/");
        }}
      />
    </div>
  );
}
