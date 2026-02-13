import { NextSeo } from "next-seo";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineExclamation } from "react-icons/hi";
import { ErrorCatcher, NotFound, Spinner } from "../../components/shared/utilities/misc";
import { useScreen } from "../../lib/hooks/useScreen";
import { useAuth } from "../../lib/providers/auth-provider";
import { UserRoleEnum } from "../../lib/repo/types";
import { DefaultHead } from "../default-head";
import { Header } from "./components/header";
import { SubMenu } from "./components/sidebar";
import { AdminLayoutProvider } from "./providers/admin-layout-provider";

const Sidebar = dynamic<any>(() => import("./components/sidebar"));

interface PropsType extends ReactProps {
  scope?: string;
}
export function AdminLayout({ ...props }: PropsType) {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, redirectToAdminLogin, logout } = useAuth();
  const [subMenu, setSubMenu] = useState<SubMenu>();
  const screenXl = useScreen("xl");

  useEffect(() => {
    if (user && user?.role != UserRoleEnum.ADMIN && user?.role != UserRoleEnum.STAFF) {
      logout();
      router.replace("/admin");
    }
    if (!user) {
      redirectToAdminLogin();
    }
  }, [user]);

  return (
    <>
      <AdminLayoutProvider>
        <DefaultHead />
        {!user ? (
          <div className="min-h-screen w-h-screen">
            <Spinner />
          </div>
        ) : (
          <>
            <NextSeo title="Admin" />
            <Header />
            <div className="relative flex w-full min-h-screen pt-14">
              <Sidebar onChange={setSubMenu} />
              <div className={`${screenXl ? "pl-60" : "pl-24"} flex flex-col flex-1 `}>
                <div className={`${screenXl ? "p-6 " : " p-3"}`}>
                  {subMenu ? (
                    <>
                      <NextSeo title={subMenu.title} />
                      {!subMenu.scope || user.scopes.includes(subMenu.scope) ? (
                        <>
                          <ErrorCatcher>{props.children}</ErrorCatcher>
                        </>
                      ) : (
                        <NotFound
                          icon={<HiOutlineExclamation />}
                          text={t("Không đủ quyền truy cập")}
                        />
                      )}
                    </>
                  ) : (
                    <>
                      <Spinner />
                    </>
                  )}
                  {/* {!props.scope || (props.scope && user.scopes.includes(props.scope)) ? (
                    <ErrorCatcher>{props.children}</ErrorCatcher>
                  ) : (
                    <Card>
                      <NotFound icon={<HiOutlineExclamation />} text="Không đủ quyền truy cập" />
                    </Card>
                  )} */}
                </div>
              </div>
            </div>
          </>
        )}
      </AdminLayoutProvider>
    </>
  );
}
