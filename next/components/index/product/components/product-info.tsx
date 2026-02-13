import copy from "copy-to-clipboard";
import { useRouter } from "next/router";
import QRCode from "qrcode.react";
import { useEffect, useState } from "react";
import { BiLink } from "react-icons/bi";
import { FaRegCopy, FaShareAlt } from "react-icons/fa";
import { RiShareForwardLine } from "react-icons/ri";
import { useScreen } from "../../../../lib/hooks/useScreen";

import { useTranslation } from "react-i18next";
import { useToast } from "../../../../lib/providers/toast-provider";

import { random } from "lodash";
import { Product } from "../../../../lib/repo";
import { FbIcon, IconViber, QRIcon, TgIcon } from "../../../../public/assets/svg/svg";
import { PostGroupDialog } from "../../../shared/common/post-group-dialog";
import { Dialog } from "../../../shared/utilities/dialog/dialog";
import { Button } from "../../../shared/utilities/form";
import { HomeProvider } from "../../home/provider/home-provider";
import { useProductDetailContext } from "../provider/product-detail-provider";
import { ProductActions } from "./product-actions";
import { ProductClassifications } from "./product-classifications";
import { ProductDescription } from "./product-description";
import { ProductPrice } from "./product-price";
import { ProductQuantity } from "./product-quantity";
import { ProductSpecifications } from "./product-specifications";

type Props = {};

export function ProductInfo({}: Props) {
  const randomReviewCount = random(1, 10000);
  return (
    <div className="relative flex flex-col">
      <ButtonShare />
      <ProductTitle />
      {/* <ProductRating averageRate={5} reviewCount={randomReviewCount} soldCount={0} /> */}
      <ProductPrice />
      <ProductClassifications />
      <ProductQuantity />
      <ProductActions />
      <ProductDescription />
      <HomeProvider>
        <ProductSpecifications />
      </HomeProvider>
    </div>
  );
}

const ProductTitle = () => {
  const { t } = useTranslation();
  const { product } = useProductDetailContext();

  return (
    <div className="mb-4">
      <h1 className="text-xl font-bold leading-7 text-gray-900 lg:text-2xl">
        {product?.name || t("Tên sản phẩm")}
      </h1>
    </div>
  );
};

const ButtonShare = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const router = useRouter();
  const [openDialogShareLink, setOpenDialogShareLink] = useState(false);
  const [linkShare, setLinkShare] = useState("");
  const [openPost, setOpenPost] = useState<boolean>(false);

  const { product } = useProductDetailContext();
  function copyToClipboard(text) {
    copy(text);
    toast.success(t("Đã sao chép"));
  }

  const getProductUrl = (product: Product) => {
    const origin =
      typeof window !== "undefined" && window.location.origin ? window.location.origin : "";
    const path = `${origin}${router.asPath}`;
    const url = new URL(path);
    url.searchParams.set("utm_source", "StoreMMO");
    url.searchParams.set("utm_medium", "");
    url.searchParams.set("utm_campaign", "product");
    url.searchParams.set("utm_content", product.des);

    setLinkShare(url.toString());
    return url.toString();
  };

  useEffect(() => {
    getProductUrl(product);
  }, []);

  return (
    <div className="absolute flex flex-row items-center gap-1 px-1.5 py-1 mb-2 bg-white border rounded-full -top-4 right-2 hover:bg-gray-50 ">
      <span className="text-gray-400 cursor-pointer hover:text-primary">
        <BiLink
          className="outline-none text-24"
          data-placement="top"
          data-tooltip={t("Copy Link")}
          onClick={() => {
            copyToClipboard(getProductUrl(product));
          }}
        />
      </span>
      <span
        className="text-gray-400 cursor-pointer hover:text-primary"
        onClick={() => {
          setOpenDialogShareLink(true);
        }}
      >
        <RiShareForwardLine
          className="outline-none text-24"
          data-placement="top"
          data-tooltip={t("Chia sẻ")}
        />
      </span>
      <Dialog
        width="600px"
        isOpen={openDialogShareLink}
        onClose={() => {
          setOpenDialogShareLink(false);
        }}
      >
        <Dialog.Body>
          <Share link={linkShare} />
        </Dialog.Body>
      </Dialog>

      {openPost && <PostGroupDialog isOpen={openPost} onClose={() => setOpenPost(false)} />}
    </div>
  );
};

export function Share({ link, ...props }: { link: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  function copyToClipboard(text) {
    copy(text);
    toast.success(t("Đã sao chép"));
  }

  const [showQRcode, setShowQRcode] = useState(false);
  const [showShareType, setShowShareType] = useState(false);
  const screenSm = useScreen("sm");
  return (
    <div className="px-4 py-4">
      <span className="font-medium">{`${t("Link giới thiệu")}:`}</span>
      <div className="flex w-full mt-1 mb-4 border-b rounded-md min-h-12">
        <span className="flex-1 my-auto text-sm font-light whitespace-nowrap text-ellipsis-2 sm:text-base">
          {link}
        </span>
        {/* {showShareType ? ( */}
        {/* <Button
          icon={<AiOutlineClose />}
          className="w-10 h-12 pl-2 pr-0 ml-auto mr-0"
          iconClassName="text-28"
          onClick={() => setShowShareType(false)}
        /> */}
        {/* ) : ( */}
        <Button
          icon={<FaShareAlt />}
          className="w-10 h-12 pl-2 pr-0 ml-auto mr-0"
          iconClassName="text-28"
          onClick={() => setShowShareType(true)}
        />
        {/* )} */}
      </div>
      {/* {showShareType == true && ( */}
      <div className="flex rounded-md border-group animate-scale-up">
        <Button
          icon={<FaRegCopy />}
          outline
          className="flex-1"
          iconClassName="text-28"
          tooltip={t("Sao chép")}
          onClick={() => copyToClipboard(link)}
        />
        <Button
          href={{ pathname: "https://www.facebook.com/sharer/sharer.php", query: { u: link } }}
          className="flex-1 text-white hover:text-white"
          icon={<FbIcon />}
          iconPosition="end"
          style={{ backgroundColor: "#4267b2" }}
          iconClassName="w-6 h-6 "
          tooltip={t("Chia sẻ lên facebook")}
        />
        <Button
          href={{ pathname: "https://telegram.me/share/url", query: { url: link } }}
          className="flex-1 text-white hover:text-white"
          icon={<TgIcon />}
          iconPosition="end"
          style={{ backgroundColor: "#37AFE2" }}
          iconClassName="w-6 h-6 "
          tooltip={t("Chia sẻ lên telegram")}
        />
        <Button
          href={{ pathname: "viber://forward", query: { text: link } }}
          className="flex-1 text-white hover:text-white"
          icon={<IconViber />}
          iconPosition="end"
          style={{ backgroundColor: "#59267c" }}
          iconClassName="w-6 h-6 "
          tooltip={t("Chia sẻ lên viber")}
        />
        <Button
          icon={<QRIcon />}
          outline
          className="flex-1"
          iconPosition="end"
          tooltip={t("Xem mã QR")}
          iconClassName="w-6 h-6"
          onClick={() => setShowQRcode(!showQRcode)}
        />
      </div>
      {/* )} */}
      <Dialog isOpen={showQRcode} onClose={() => setShowQRcode(false)} slideFromBottom="none">
        <div className="flex flex-col items-center w-full p-3">
          <QRCode value={link} size={screenSm ? 300 : 230} />
        </div>
      </Dialog>
    </div>
  );
}
