import { useRouter } from "next/router";
import { useEffect, useState } from "react";
// import { ChatProvider } from "../../components/shared/chat/chat-provider";
// import { ChatWidget } from "../../components/shared/shop-layout/chat-widget";
// import { ErrorCatcher, Spinner } from "../../components/shared/utilities/misc";
// import { SetCustomerToken } from "../../lib/graphql/auth.link";
// import { pageview } from "../../lib/helpers/ga";
// import { useScreen } from "../../lib/hooks/useScreen";
// import { CartProvider } from "../../lib/providers/cart-provider";
// import { GlobalProvider } from "../../lib/providers/global-provider";
// import { LocationProvider } from "../../lib/providers/location-provider";
// import { ShopProvider, useShopContext } from "../../lib/providers/shop-provider";
// import { DefaultHead } from "../default-head";
// import { DefaultHeader } from "../default-header";
// import { BackToTop } from "../home-layout/components/back-to-top";
// import { Footer } from "../home-layout/components/footer";
// import { Footer } from "./components/footer";
import { Header } from "./components/header";
import { DefaulLayoutProvider } from "./provider/default-layout-provider";

export function DefaultLayout({ ...props }) {
  const router = useRouter();
  const [shopCode, setShopCode] = useState<string>();

  useEffect(() => {
    let code = router.query.code as string;

    if (code) {
      sessionStorage.setItem("shopCode", code);
      // if (router.query["x-token"]) {
      //   SetCustomerToken(router.query["x-token"] as string, code);
      // }

      if (router.query["colCode"]) {
        sessionStorage.setItem(code + "colCode", router.query["colCode"] as string);
      }
      if (router.query["psid"]) {
        sessionStorage.setItem(code + "psid", router.query["psid"] as string);
      }
      if (router.query["followerId"]) {
        sessionStorage.setItem(code + "followerId", router.query["followerId"] as string);
      }
      setShopCode(code);
    }
    return () => setShopCode("");
  }, [router.query.code]);

  //google analytics
  // useEffect(() => {
  //   const handleRouteChange = (url) => {
  //     pageview(url);
  //   };
  //   router.events.on("routeChangeComplete", handleRouteChange);
  //   return () => {
  //     router.events.off("routeChangeComplete", handleRouteChange);
  //   };
  // }, [router.events]);

  // if (!shopCode) return <Spinner />;
  return (
    <>
      <DefaulLayoutProvider>
        {/* <LocationProvider>
          <GlobalProvider>
            <ShopProvider code={shopCode}>
              <DefaultLayoutContent {...props}>{props.children}</DefaultLayoutContent>
            </ShopProvider>
          </GlobalProvider>
        </LocationProvider> */}
      </DefaulLayoutProvider>
    </>
  );
}

function DefaultLayoutContent({ ...props }) {
  // const { shop, shopCode, customer } = useShopContext();
  // const screenLg = useScreen("lg");

  // if (!shop) return <Spinner />;
  return (
    <></>
    // <>
    //   <DefaultHead shopCode={shopCode} shopLogo={shop.shopLogo} />
    //   <CartProvider>
    //     <ChatProvider senderRole="CUSTOMER" threadId={customer?.thread?.id} senderId={customer?.id}>
    //       <div className="relative flex flex-col bg-gray-200">
    //         {!screenLg ? (
    //           <div className="w-full max-w-lg min-h-screen mx-auto bg-gray-100 shadow-lg flex-cols">
    //             <Header {...props} />
    //             <ErrorCatcher>{props.children}</ErrorCatcher>
    //           </div>
    //         ) : (
    //           <div className="w-full mx-auto shadow-lg">
    //             <div className={`w-full bg-gray-100 text-gray-700 min-h-screen flex-cols`}>
    //               <DefaultHeader shopCode={shopCode} />
    //               <ErrorCatcher>{props.children}</ErrorCatcher>
    //             </div>
    //             {/* <Footer /> */}
    //             {customer && (
    //               <ChatWidget
    //                 threadId={customer?.thread?.id}
    //                 senderId={customer?.id}
    //                 senderRole="CUSTOMER"
    //                 receiverRole="MEMBER"
    //               />
    //             )}
    //             <BackToTop />
    //           </div>
    //         )}
    //       </div>
    //     </ChatProvider>
    //   </CartProvider>
    // </>
  );
}
