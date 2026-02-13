import { NextSeo } from "next-seo";
import Link from "next/link";
import router from "next/router";
import { useTranslation } from "react-i18next";
import { RiHome3Line } from "react-icons/ri";
import { Button } from "../components/shared/utilities/form";
import { getServerSideTranslationsProps } from "../lib/functions/locale";

export default function ShopNotFound() {
  const { t } = useTranslation();
  const refresh = () => {
    location.href = location.origin;
  };

  return (
    <>
      <NextSeo title={t("Không tìm thấy cửa hàng")} />
      <div className="flex-col max-w-lg px-8 py-40 mx-auto text-center text-gray-700 flex-center">
        <Link replace href={"/"} className="cursor-pointer">
          <img className="w-48 h-48" src={"/assets/img/shop-not-found.png"} />
        </Link>
        <h2 className="mb-8 text-xl font-semibold">{t("Không tìm thấy cửa hàng.")}</h2>
        <Button
          primary
          text={t("Trở về trang chủ")}
          className="mb-10"
          icon={<RiHome3Line />}
          onClick={() => {
            router.replace("/");
          }}
        ></Button>
      </div>
    </>
  );
}
export const getServerSideProps = getServerSideTranslationsProps();
