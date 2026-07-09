import { useState } from "react";
import { useTranslation } from "react-i18next";

import { RiLock2Line } from "react-icons/ri";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { SubscriptionPlanEnum } from "../../../../../lib/repo";
import { TrendingTypeEnum } from "../../../../../lib/repo/list/trending.repo";
import { NotFound } from "../../../../shared/utilities/misc";
import { TabGroup } from "../../../../shared/utilities/tab/tab-group";
import { AppCategoryList } from "./app-category-list";
import { AppPromptRank } from "./app-prompt-rank";

export const AppVideoRightPanel = () => {
  const { t } = useTranslation();
  const [tabIndex, setTabIndex] = useState(0);
  const { customer } = useAuth();
  const permissionView =
    customer?.googlePackage?.subscription !== SubscriptionPlanEnum.FREE &&
    customer?.googlePackage?.subscription !== SubscriptionPlanEnum.TRIAL &&
    customer?.googlePackage;

  return (
    <div className="flex overflow-hidden flex-col flex-1">
      <TabGroup
        index={tabIndex}
        onChange={setTabIndex}
        name="affiliate-app-right"
        flex={false}
        tabClassName="px-4 py-3"
        titleClassName="text-sm font-semibold whitespace-nowrap"
        bodyClassName="flex-1 overflow-y-auto v-scrollbar"
        className="bg-white"
      >
        {" "}
        <TabGroup.Tab label={t("ChatBot App")}>
          {permissionView ? (
            <AppCategoryList key={TrendingTypeEnum.CHATBOT} type={TrendingTypeEnum.CHATBOT} />
          ) : (
            <NotFound
              icon={<RiLock2Line size={30} className="text-gray-500" />}
              text={t(
                "Bạn không có quyền xem danh sách ChatBot, Chức năng này chỉ dành cho tài khoản có gói đăng ký cao cấp hơn."
              )}
            />
          )}
        </TabGroup.Tab>
        <TabGroup.Tab label={t("Flow App")}>
          <AppCategoryList key={TrendingTypeEnum.FLOW_APP} type={TrendingTypeEnum.FLOW_APP} />
        </TabGroup.Tab>
        <TabGroup.Tab label={t("AI Studio App")}>
          <AppCategoryList
            key={TrendingTypeEnum.AI_STUDIO_APP}
            type={TrendingTypeEnum.AI_STUDIO_APP}
          />
        </TabGroup.Tab>
        <TabGroup.Tab label={t("Bảng xếp hạng")}>
          <AppPromptRank />
        </TabGroup.Tab>
      </TabGroup>
    </div>
  );
};
