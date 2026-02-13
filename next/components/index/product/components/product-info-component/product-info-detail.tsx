import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useScreen } from "../../../../../lib/hooks/useScreen";
import { useSettingPublic } from "../../../../../lib/hooks/useSettingPublic";
import { useAlert } from "../../../../../lib/providers/alert-provider";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useGlobalContext } from "../../../../../lib/providers/global-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";

import { useChatContext } from "../../../../shared/chat/chat-provider";
import { useProductDetailContext } from "../../provider/product-detail-provider";

import { useChatWithShop } from "../../../../../lib/hooks/useChatWithShop";

interface ProductInfoDetailProps {}
export const ProductInfoDetail = ({}: ProductInfoDetailProps) => {
  const { t } = useTranslation();

  const [qty, setQty] = useState(1);
  const [duration, setDuration] = useState(2);
  const [selectServiceId, setSelectServiceId] = useState<string>();

  return (
    <>
      {/* {services.length > 0 && (
        <>
          <ProductInfoPrice selectServiceId={selectServiceId} services={services} />
          <ProductServices
            selectServiceId={selectServiceId}
            setSelectServiceId={setSelectServiceId}
            services={services}
          />
        </>
      )} */}

      {/* <div className="flex flex-row items-end mt-2">
        <BuyButton serviceId={selectServiceId} services={services} />
      </div> */}
    </>
  );
};
export interface ConfirmOrder {
  serviceId: string;
}
interface BuyButtonProps {
  serviceId: string;
}

export function BuyButton({ serviceId }: BuyButtonProps) {
  const { t } = useTranslation();
  const alert = useAlert();
  const toast = useToast();
  const screenLg = useScreen("lg");
  const router = useRouter();
  const { customer } = useAuth();
  const isMandatoryBankUpdate = useSettingPublic("pa-c-bank");
  const { setOpenCustomerLoginDialog } = useGlobalContext();
  const { product } = useProductDetailContext();
  const [openSlideVerify, setOpenSlideVerify] = useState(null);
  const [openAddProductDialog, setOpenAddProductDialog] = useState<boolean>(false);
  const [openCreateBankCustomerDialog, setOpenCreateBankCustomerDialog] = useState<boolean>(false);
  const [phoneNumber, setPhoneNumber] = useState(null);
  const [confirmOrder, setConfirmOrder] = useState<ConfirmOrder>();
  const { setOpenThread } = useChatContext();
  const { handleChatCustomerToShop } = useChatWithShop();

  const getCount = useMemo(() => {
    const count = localStorage.getItem("PN-count");
    return count;
  }, [router.query.productCode]);
  const count = () => {
    const count = +getCount + 1;

    !customer && localStorage.setItem("PN-count", JSON.stringify(count));
  };

  useEffect(() => {
    setPhoneNumber(null);
  }, [router.query.productCode]);

  // const CreateThread = async () => {
  //   await ThreadService.createThreadCustomer(productDetail.shop.id, productDetail.id)
  //     .then((res) => {
  //       toast.success("Tạo chat thành công");
  //     })
  //     .catch((err) => {
  //       toast.error(`Tạo chat thất bại, ${err}`);
  //     });
  //   console.log(productDetail);
  // };

  const handleConfirmOrder = ({ serviceId }: ConfirmOrder) => {
    if (customer) {
      if (!customer?.bankVerifiedId && !!isMandatoryBankUpdate) {
        setOpenCreateBankCustomerDialog(true);
      } else {
        if (!serviceId) {
          toast.error(t("Vui lòng chọn dịch vụ muốn đặt"));
          return;
        }
        setConfirmOrder({ serviceId });
      }
    } else {
      setOpenCustomerLoginDialog(true);
    }
  };

  return (
    <></>
    // <>
    //   <div className={`flex flex-row items-end justify-start  mb-2  ${!screenLg ? "w-full" : ""}`}>
    //     {/* Hiện số điện thoại hoặc order */}
    //     {customer?._id != productDetail?.shop?.ownerId &&
    //       (productDetail.type == AffiliateProductTypeEnum.SELL ? (
    //         <Button
    //           text={`Mua`}
    //           icon={<HiOutlineShoppingCart />}
    //           success
    //           disabled={!!customer && !serviceId}
    //           className={`mr-2 ${!screenLg ? "flex-1" : "w-48"} `}
    //           onClick={() => handleConfirmOrder({ serviceId })}
    //         />
    //       ) : (
    //         <div>
    //           <Button
    //             text={t(`Đề xuất bán ngay`)}
    //             danger
    //             icon={<HiPlus />}
    //             className={`mr-4   whitespace-nowrap  ${!screenLg ? "flex-1" : ""}`}
    //             onClick={async () => {
    //               if (customer) {
    //                 if (!customer?.bankVerifiedId && !!isMandatoryBankUpdate) {
    //                   setOpenCreateBankCustomerDialog(true);
    //                 } else {
    //                   setOpenAddProductDialog(true);
    //                 }
    //               } else {
    //                 setOpenCustomerLoginDialog(true);
    //               }
    //             }}
    //           />
    //         </div>
    //       ))}

    //     {customer?._id != productDetail?.shop?.ownerId && (
    //       <>
    //         <Button
    //           primary
    //           text={t("Chat")}
    //           icon={<FaRegCommentDots />}
    //           onClick={async () => {
    //             handleChatCustomerToShop({ productId: productDetail.id });
    //           }}
    //         />
    //       </>
    //     )}
    //   </div>
    //   <AddProductShopProductDialog
    //     isOpen={openAddProductDialog}
    //     shopProductId={productDetail.id}
    //     onClose={() => setOpenAddProductDialog(false)}
    //   />
    //   <CreateBankCustomerDialog
    //     isOpen={openCreateBankCustomerDialog}
    //     onClose={() => setOpenCreateBankCustomerDialog(false)}
    //   />
    //   <ConfirmServiceDialog
    //     isOpen={!!confirmOrder}
    //     onClose={() => setConfirmOrder(undefined)}
    //     confirmOrder={confirmOrder}
    //     services={services}
    //   />
    // </>
  );
}
