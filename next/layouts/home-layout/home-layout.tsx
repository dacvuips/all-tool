import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { CheckoutProvider } from "../../components/index/checkout/provider/checkout-provider";
import { HomeProvider } from "../../components/index/home/provider/home-provider";
import { ErrorCatcher } from "../../components/shared/utilities/misc";
import { useScreen } from "../../lib/hooks/useScreen";
import { useAuth } from "../../lib/providers/auth-provider";
import { GlobalProvider } from "../../lib/providers/global-provider";
import { DefaultHead } from "../default-head";
import { DefaultHeader } from "../default-header";
import { BackToTop } from "./components/back-to-top";
import { Footer } from "./components/footer";
import { GroupsWidget } from "./components/groups-widget";
import { PopupNotifyDialog } from "./components/popup-notify-dialog";
import { SelectCategoryGlobalDialog } from "./components/select-category-global-dialog";
import { UpdatePhoneNumberDialog } from "./components/update-phone-number-dialog";
import { HomeLayoutProvider } from "./provider/home-layout-provider";

interface LayoutProps extends ReactProps {
  name: string;
}
export function HomeLayout({ ...props }: LayoutProps) {
  const [getToggleSidebar, setGetToggleSidebar] = useState<string>();
  const xs = useScreen("xs");
  const { customer } = useAuth();
  const router = useRouter();
  const isHomePage = !["/profile", "/checkout", "/post"].some((path) =>
    router.pathname.startsWith(path)
  );

  // Lưu referral code từ query param ?ref=... vào localStorage
  useEffect(() => {
    if (router.isReady) {
      const ref = router.query.ref as string;
      if (ref) {
        localStorage.setItem("ref", ref);
      }
    }
  }, [router.isReady, router.query.ref]);

  return (
    <>
      <HomeLayoutProvider>
        <DefaultHead shopCode="" shopLogo="" />
        <GlobalProvider>
          <div className="pt-14 w-full min-h-screen">
            {/* {isHomePage && <Sidebar setGetToggleSidebar={setGetToggleSidebar} />} */}
            <SelectCategoryGlobalDialog />
            <UpdatePhoneNumberDialog />
            {/* {customer && (
              <ChatProvider senderRole="CUSTOMER">
                <ChatWidget senderRole="CUSTOMER" senderId={customer?._id} />
              </ChatProvider>
            )} */}
            <GroupsWidget />
            <div className={`flex flex-col flex-1 grow`}>
              <ErrorCatcher>
                <HomeLayoutContent {...props} />
              </ErrorCatcher>

              <Footer />
            </div>
          </div>{" "}
        </GlobalProvider>
      </HomeLayoutProvider>
    </>
  );
}

export function HomeLayoutContent({ children, ...props }: LayoutProps) {
  return (
    <>
      <div className="flex relative flex-col bg-gray-100">
        <div className="mx-auto w-full">
          <div
            className={`flex flex-col w-full text-accent`}
            style={{
              minHeight: "calc(100vh - 350px)",
            }}
          >
            <HomeProvider>
              <CheckoutProvider>
                <DefaultHeader {...props} shopCode="" />
              </CheckoutProvider>
              <PopupNotifyDialog />
            </HomeProvider>
            {children}
          </div>
          {/* <Footer /> */}
        </div>
      </div>

      {/* {screenLg && <FloatingAffiliateButton />} */}
      <BackToTop />
    </>
  );
}
