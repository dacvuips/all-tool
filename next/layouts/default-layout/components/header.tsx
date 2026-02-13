import Link from "next/link";
import { useRouter } from "next/router";
import { useRef, useState } from "react";
import {
  RiArrowLeftSLine,
  RiMenu3Line,
  RiNotificationLine,
  RiSearch2Line,
  RiShoppingCart2Line,
} from "react-icons/ri";
// import { GlobalCustomerLoginDialog } from "../../../components/shared/auth/global-customer-login-dialog";
import { Button } from "../../../components/shared/utilities/form";
import { Img } from "../../../components/shared/utilities/misc";
import { Popover } from "../../../components/shared/utilities/popover/popover";
import { useAuth } from "../../../lib/providers/auth-provider";
// import { useCart } from "../../../lib/providers/cart-provider";
// import { CUSTOMER_LOGIN_PATHNAME, useShopContext } from "../../../lib/providers/shop-provider";
// import { DefaultMenu } from "../../default-menu";
// import { Notify } from "../../home-layout/components/notify";

export interface HeaderPropsType extends ReactProps {
  name?: string;
  href?: string;
}
export function Header({ name, ...props }: HeaderPropsType) {
  const router = useRouter();
  // const { shop, shopCode, customer, notificationCount } = useShopContext();
  // const { setShowDialogCart, cartProducts } = useCart();
  // const { globalCustomer } = useAuth();
  const [openMenu, setOpenMenu] = useState(false);
  const [openGlobalCustomerLoginDialog, setOpenGlobalCustomerLoginDialog] = useState(false);
  const isMainPage = !name;
  const refNotification = useRef();

  return (
    <></>
    // <>
    //   <header className={`sticky top-0 w-full z-100`}>
    //     <div
    //       className={`flex items-center w-full h-14 mx-auto text-white shadow-sm ${
    //         isMainPage ? "bg-primary" : "bg-white"
    //       } `}
    //     >
    //       <Button
    //         icon={<RiArrowLeftSLine />}
    //         hoverWhite={isMainPage}
    //         textAccent={!isMainPage}
    //         className={`px-1 h-full text-2xl ${isMainPage ? "text-gray-100" : ""}`}
    //         href={name ? `/${shopCode}` : "/"}
    //       />
    //       {isMainPage ? (
    //         <>
    //           <Link href={`/${shopCode}`}>
    //             <a className="flex items-center overflow-hidden">
    //               {shop && (
    //                 <>
    //                   <Img
    //                     src={shop.shopLogo}
    //                     className="bg-white border rounded-full shadow-sm w-7 xs:w-9"
    //                   />
    //                 </>
    //               )}
    //               <div className="flex-1 px-2 text-sm font-medium text-ellipsis">
    //                 {shop?.shopName}
    //               </div>
    //             </a>
    //           </Link>
    //         </>
    //       ) : (
    //         <div className="text-base font-bold text-accent">{name}</div>
    //       )}
    //       <div className="flex items-center ml-auto">
    //         {globalCustomer ? (
    //           <>
    //             {isMainPage && (
    //               <Button
    //                 className="px-1.5 text-white"
    //                 href={`/${shopCode}/search`}
    //                 icon={<RiSearch2Line />}
    //                 iconClassName="text-xl"
    //                 hoverWhite
    //               />
    //             )}
    //             <div className="relative">
    //               <Button
    //                 hoverWhite={isMainPage}
    //                 className={`px-2 ${isMainPage ? "text-white" : "text-gray-500 font-bold"}`}
    //                 icon={<RiNotificationLine />}
    //                 iconClassName="text-xl"
    //                 innerRef={refNotification}
    //               />
    //               {notificationCount > 0 && (
    //                 <div
    //                   className={`absolute px-1 text-xs bg-white rounded-full font-bold top-0.5 right-0.5 ${
    //                     isMainPage ? "bg-white text-primary" : "bg-yellow-400 text-white"
    //                   }`}
    //                 >
    //                   {notificationCount}
    //                 </div>
    //               )}

    //               <Popover reference={refNotification} trigger="click" placement="bottom-end">
    //                 <Notify />
    //                 {/* <NotificationDesktop /> */}
    //               </Popover>
    //             </div>
    //           </>
    //         ) : globalCustomer === null ? (
    //           <>
    //             <Button
    //               text="Đăng nhập"
    //               className="h-8 px-2 text-xs font-medium text-white border-white"
    //               hoverWhite
    //               outline
    //               onClick={() => setOpenGlobalCustomerLoginDialog(true)}
    //             />
    //           </>
    //         ) : (
    //           <></>
    //         )}
    //         <div className="relative">
    //           <Button
    //             hoverWhite={isMainPage}
    //             className={`px-2 ${isMainPage ? "text-white" : "text-gray-500 font-bold"}`}
    //             onClick={() => {
    //               if (shop.config.orderConfig.skipCart) {
    //                 if (customer) {
    //                   router.push(`${shopCode}/payment`);
    //                 } else {
    //                   sessionStorage.setItem(CUSTOMER_LOGIN_PATHNAME, `${shopCode}/payment`);
    //                   setOpenGlobalCustomerLoginDialog(true);
    //                 }
    //               } else {
    //                 setShowDialogCart(true);
    //               }
    //             }}
    //             icon={<RiShoppingCart2Line />}
    //             iconClassName="text-xl"
    //           />
    //           {cartProducts?.length > 0 && (
    //             <div
    //               className={`absolute px-1 text-xs bg-white rounded-full font-bold top-0.5 right-0.5 ${
    //                 isMainPage ? "bg-white text-primary" : "bg-yellow-400 text-white"
    //               }`}
    //             >
    //               {cartProducts.length}
    //             </div>
    //           )}
    //         </div>
    //         <Button
    //           hoverWhite={isMainPage}
    //           className={`px-2 pr-3 ${isMainPage ? "text-white" : "text-gray-500 font-bold"}`}
    //           onClick={() => setOpenMenu(true)}
    //           icon={<RiMenu3Line />}
    //           iconClassName="text-xl"
    //         />
    //       </div>
    //     </div>
    //     <DefaultMenu isOpen={openMenu} onClose={() => setOpenMenu(false)} />
    //     <GlobalCustomerLoginDialog
    //       isOpen={openGlobalCustomerLoginDialog}
    //       onClose={() => {
    //         setOpenGlobalCustomerLoginDialog(false);
    //       }}
    //     />
    //   </header>
    // </>
  );
}
