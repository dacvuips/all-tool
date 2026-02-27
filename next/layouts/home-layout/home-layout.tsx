import { useState } from "react";
import { CheckoutProvider } from "../../components/index/checkout/provider/checkout-provider";
import { HomeProvider } from "../../components/index/home/provider/home-provider";
import { ChatProvider } from "../../components/shared/chat/chat-provider";
import { ChatWidget } from "../../components/shared/chat/chat-widget";
import { ErrorCatcher } from "../../components/shared/utilities/misc";
import { useScreen } from "../../lib/hooks/useScreen";
import { useAuth } from "../../lib/providers/auth-provider";
import { GlobalProvider } from "../../lib/providers/global-provider";
import { DefaultHead } from "../default-head";
import { DefaultHeader } from "../default-header";
import { BackToTop } from "./components/back-to-top";
import { Footer } from "./components/footer";
import { PopupNotifyDialog } from "./components/popup-notify-dialog";
import { SelectCategoryGlobalDialog } from "./components/select-category-global-dialog";
import { Sidebar } from "./components/sidebar";
import { UpdatePhoneNumberDialog } from "./components/update-phone-number-dialog";
import { HomeLayoutProvider } from "./provider/home-layout-provider";

interface LayoutProps extends ReactProps {
  name: string;
}
export function HomeLayout({ ...props }: LayoutProps) {
  const [getToggleSidebar, setGetToggleSidebar] = useState<string>();
  const xs = useScreen("xs");
  const { customer } = useAuth();

  return (
    <>
      <HomeLayoutProvider>
        <DefaultHead shopCode="" shopLogo="" />
        <GlobalProvider>
          <div className="pt-14 w-full min-h-screen">
            <Sidebar setGetToggleSidebar={setGetToggleSidebar} />
            <SelectCategoryGlobalDialog />
            <UpdatePhoneNumberDialog />
            {customer && (
              <ChatProvider senderRole="CUSTOMER">
                <ChatWidget senderRole="CUSTOMER" senderId={customer?._id} />
              </ChatProvider>
            )}
            <div
              className={`flex flex-col flex-1 pl-0 grow ${
                getToggleSidebar == "true" && "2xl:pl-56 xl:pl-56"
              }  lg:pl-12 md:pl-12 sm:pl-12 xs:pl-12`}
              // className={`flex flex-col flex-1 pl-0 grow`}
            >
              <div className={`${!xs ? "p-1" : "p-4"}`}>
                <ErrorCatcher>
                  <HomeLayoutContent {...props} />
                </ErrorCatcher>
              </div>
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
