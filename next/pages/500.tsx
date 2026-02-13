import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";

export default function Page500() {
  const { t } = useTranslation();
  const refresh = () => {
    sessionStorage.clear();
    localStorage.clear();
    location.href = location.origin;
  };

  return (
    <>
      <NextSeo title={t("Có lỗi xảy ra")} />
      <div className="flex-col max-w-lg px-8 py-40 mx-auto text-center text-gray-700 flex-center">
        <img className="w-20 mb-6" src="/assets/img/warning.svg" />
        <h2 className="mb-2 text-xl font-semibold">
          {t("Trang web đang gặp vấn đề về kỹ thuật.")}
        </h2>
        <h2 className="mb-8 text-xl font-semibold">{t("Xin quý khách thông cảm.")}</h2>
        <button className="h-12 shadow-md btn-info is-large" onClick={refresh}>
          {t("Kiểm tra và chỉnh sửa lỗi")}
        </button>
      </div>
    </>
  );
}
