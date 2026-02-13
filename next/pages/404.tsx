import { Player } from "@lottiefiles/react-lottie-player";
import { NextSeo } from "next-seo";
import Link from "next/link";
import router from "next/router";
import { useTranslation } from "react-i18next";
import { RiHome3Line } from "react-icons/ri";
import { Button } from "../components/shared/utilities/form";

export default function Page404() {
  const { t } = useTranslation();
  return (
    <>
      <NextSeo title={t("Không tìm thấy trang")} />
      <div className="flex-col max-w-lg px-8 py-40 mx-auto text-center text-gray-700 flex-center">
        <Link href={"/"} className="cursor-pointer">
          <Player
            autoplay
            loop
            src={`/assets/lottie/error-404.json`}
            style={{ height: "200px", width: "200px" }}
          ></Player>
        </Link>
        <h2 className="mb-8 text-xl font-semibold">{t("Không tìm thấy trang.")} </h2>
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
