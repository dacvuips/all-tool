import { useTranslation } from "react-i18next";
import { RiDatabase2Line } from "react-icons/ri";

/** Tab Cào dữ liệu — khung sẵn để gắn flow scrape Shopee / affiliate. */
export function ScrapeDataPanel() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <div className="flex justify-center items-center w-10 h-10 rounded-xl bg-teal-50 text-teal-600 border border-teal-200">
          <RiDatabase2Line className="text-xl" />
        </div>
        <div>
          <h3 className="m-0 text-sm font-bold text-gray-800">{t("Cào dữ liệu")}</h3>
          <p className="m-0 mt-0.5 text-xs text-gray-500">
            {t("Thu thập sản phẩm / shop từ Shopee Affiliate để đưa vào Quản Lý Luồng")}
          </p>
        </div>
      </div>

      <div className="flex flex-col justify-center items-center px-6 py-16 bg-white rounded-xl border border-dashed border-gray-300">
        <RiDatabase2Line className="mb-3 text-4xl text-gray-300" />
        <p className="m-0 text-sm font-medium text-gray-600">{t("Chức năng đang được chuẩn bị")}</p>
        <p className="m-0 mt-1 max-w-md text-center text-xs text-gray-400">
          {t(
            "Tab này sẽ hỗ trợ cào danh sách sản phẩm, link affiliate và xuất sang phiên làm việc."
          )}
        </p>
      </div>
    </div>
  );
}
