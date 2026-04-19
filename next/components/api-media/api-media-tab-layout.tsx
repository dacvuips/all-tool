import { useRouter } from "next/router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiArrowLeft, HiShieldCheck } from "react-icons/hi";
import { useScreen } from "../../lib/hooks/useScreen";
import { TabGroup } from "../shared/utilities/tab/tab-group";
import ApiMediaPage from "./api-media-page";
import ApiMediaPricingPage from "./api-media-pricing-page";

interface ApiMediaTabLayoutProps {
  defaultTab?: number;
}

export default function ApiMediaTabLayout({ defaultTab = 0 }: ApiMediaTabLayoutProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const sm = useScreen("sm");
  const [activeTab, setActiveTab] = useState(defaultTab);

  const TAB_URLS = ["/api-generate-media", "/api-generate-media/pricing"];

  const handleTabChange = (index: number) => {
    setActiveTab(index);
    window.history.replaceState(null, "", TAB_URLS[index]);
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      {/* Shared Header */}
      <div className="sticky top-14 z-40 bg-white shadow-sm">
        <div className="flex items-center gap-4 max-w-screen-xl mx-auto px-6 py-3">
          <div
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-700 no-underline transition-colors hover:text-primary cursor-pointer"
          >
            <HiArrowLeft className="text-base" />
            {sm && <span>{t("Quay lại")}</span>}
          </div>
          <div className="w-px h-5 bg-gray-300" />
          <div className="flex items-center gap-2">
            <HiShieldCheck className="text-xl" style={{ color: "#7c3aed" }} />
            <h1 className="text-base font-bold text-gray-800 m-0">
              {t("API Media")}
            </h1>
          </div>
        </div>

        {/* Accent bar */}
        <div
          className="h-[3px]"
          style={{ background: "linear-gradient(to right, #8b5cf6, #7c3aed, #6366f1)" }}
        />
      </div>

      {/* Tab Navigation */}
      <TabGroup
        index={activeTab}
        name="api-media-tabs"
        bodyClassName=""
        tabClassName="py-3 px-4"
        titleClassName="text-sm font-semibold whitespace-nowrap"
        onChange={handleTabChange}
      >
        <TabGroup.Tab label={t("Quản lý API Key")}>
          <ApiMediaPage hideHeader onNavigateToPricing={() => handleTabChange(1)} />
        </TabGroup.Tab>
        <TabGroup.Tab label={t("Bảng giá")}>
          <ApiMediaPricingPage hideHeader />
        </TabGroup.Tab>
      </TabGroup>
    </div>
  );
}
