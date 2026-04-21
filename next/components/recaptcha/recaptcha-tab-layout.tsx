import { useRouter } from "next/router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiArrowLeft, HiShieldCheck } from "react-icons/hi";
import { useScreen } from "../../lib/hooks/useScreen";
import { TabGroup } from "../shared/utilities/tab/tab-group";
import RecaptchaPage from "./recaptcha-page";
import RecaptchaPricingPage from "./recaptcha-pricing-page";

interface RecaptchaTabLayoutProps {
  defaultTab?: number;
}

export default function RecaptchaTabLayout({ defaultTab = 0 }: RecaptchaTabLayoutProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const sm = useScreen("sm");
  const [activeTab, setActiveTab] = useState(defaultTab);

  const TAB_URLS = ["/recaptcha", "/recaptcha/pricing"];

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
            <HiShieldCheck className="text-xl text-green-500" />
            <h1 className="text-base font-bold text-gray-800 m-0">
              {t("reCAPTCHA API")}
            </h1>
          </div>
        </div>

        {/* Green accent bar */}
        <div className="h-[3px] bg-gradient-to-r from-green-500 via-green-600 to-green-300" />
      </div>

      {/* Tab Navigation */}
      <TabGroup
        index={activeTab}
        name="recaptcha-tabs"
        bodyClassName=""
        tabClassName="py-3 px-4"
        titleClassName="text-sm font-semibold whitespace-nowrap"
        onChange={handleTabChange}
      >
        <TabGroup.Tab label={t("Quản lý API Key")}>
          <RecaptchaPage hideHeader onNavigateToPricing={() => handleTabChange(1)} />
        </TabGroup.Tab>
        <TabGroup.Tab label={t("Bảng giá")}>
          <RecaptchaPricingPage hideHeader />
        </TabGroup.Tab>
      </TabGroup>
    </div>
  );
}
