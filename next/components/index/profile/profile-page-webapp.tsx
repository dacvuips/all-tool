import { useRouter } from "next/router";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAlert } from "../../../lib/providers/alert-provider";
import { useAuth } from "../../../lib/providers/auth-provider";
import { useToast } from "../../../lib/providers/toast-provider";
import { Spinner } from "../../shared/utilities/misc";
import { ProfileMenu } from "./profile-menu";
import { ProfileMenuList } from "./profile-page";

export const ProfilePageWebapp = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const alert = useAlert();
  const toast = useToast();
  const { customer, logoutCustomer } = useAuth();
  const PROFILE_MENUS = ProfileMenuList();

  useEffect(() => {
    if (customer === null) {
      router.replace("/");
      toast.info(t("Vui lòng đăng nhập để truy cập"));
    }
  }, [customer]);

  const selectedMenu = useMemo(
    () => PROFILE_MENUS.find((x) => router.pathname.includes(x.href)),
    [router.pathname]
  );

  if (!customer) return <Spinner />;

  return (
    <div className="flex-1">
      <ProfileMenu selectedMenu={selectedMenu} />
    </div>
  );
};
