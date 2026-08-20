import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { WolfSlideOutWidget } from "../../components/app/affiliate-video/wolf-slide-out/wolf-slide-out";
import { CheckoutProvider } from "../../components/index/checkout/provider/checkout-provider";
import { HomeProvider } from "../../components/index/home/provider/home-provider";
import { MediaGenerationSuccessTicker } from "../../components/shared/media-generation-success-ticker";
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
import { TermsOfServiceDialog } from "./components/terms-of-service-dialog";
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
  /** Film workspace tự cuộn cột phải — ẩn footer + khóa scroll trang */
  const isFilmWorkspace = router.pathname === "/film/[id]";
  const isFilmPage = router.pathname.startsWith("/film");

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
          <div
            className={`pt-14 w-full ${
              isFilmWorkspace ? "h-screen overflow-hidden" : "min-h-screen"
            }`}
          >
            <SelectCategoryGlobalDialog />
            <UpdatePhoneNumberDialog />
            <TermsOfServiceDialog />
            {/* {customer && (
              <ChatProvider senderRole="CUSTOMER">
                <ChatWidget senderRole="CUSTOMER" senderId={customer?._id} />
              </ChatProvider>
            )} */}
            <GroupsWidget />
            {isFilmPage && <WolfSlideOutWidget />}
            <div
              className={`flex flex-col flex-1 grow ${
                isFilmWorkspace ? "h-full min-h-0 overflow-hidden" : ""
              }`}
            >
              <ErrorCatcher>
                <HomeLayoutContent {...props} filmWorkspace={isFilmWorkspace} />
              </ErrorCatcher>

              {!isFilmWorkspace && <Footer />}
            </div>
          </div>{" "}
        </GlobalProvider>
      </HomeLayoutProvider>
    </>
  );
}

export function HomeLayoutContent({
  children,
  filmWorkspace = false,
  ...props
}: LayoutProps & { filmWorkspace?: boolean }) {
  const router = useRouter();
  const isToolPage = router.pathname.startsWith("/app/");

  return (
    <>
      <div
        className={`flex relative flex-col bg-gray-100 ${
          filmWorkspace ? "h-full min-h-0 overflow-hidden" : ""
        }`}
      >
        <div className={`mx-auto w-full ${filmWorkspace ? "h-full min-h-0 overflow-hidden" : ""}`}>
          <div
            className={`flex flex-col w-full text-accent ${
              filmWorkspace ? "h-full min-h-0 overflow-hidden" : ""
            }`}
            style={
              filmWorkspace
                ? undefined
                : {
                    minHeight: "calc(100vh - 350px)",
                  }
            }
          >
            <HomeProvider>
              <CheckoutProvider>
                <DefaultHeader {...props} shopCode="" />
              </CheckoutProvider>
              <PopupNotifyDialog />
            </HomeProvider>
            {isToolPage && <MediaGenerationSuccessTicker />}
            {children}
          </div>
        </div>
      </div>

      {!filmWorkspace && <BackToTop />}
    </>
  );
}
