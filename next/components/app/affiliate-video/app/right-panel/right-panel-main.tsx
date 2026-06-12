import { useState } from "react";
import { useTranslation } from "react-i18next";

import { TrendingTypeEnum } from "../../../../../lib/repo/list/trending.repo";
import { TabGroup } from "../../../../shared/utilities/tab/tab-group";
import { AppCategoryList } from "./app-category-list";
import { AppPromptRank } from "./app-prompt-rank";

export const AppVideoRightPanel = () => {
  const { t } = useTranslation();
  const [tabIndex, setTabIndex] = useState(0);

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
        <TabGroup.Tab label={t("Flow App")}>
          <AppCategoryList key={TrendingTypeEnum.FLOW_APP} type={TrendingTypeEnum.FLOW_APP} />
        </TabGroup.Tab>
        <TabGroup.Tab label={t("AI Studio App")}>
          <AppCategoryList
            key={TrendingTypeEnum.AI_STUDIO_APP}
            type={TrendingTypeEnum.AI_STUDIO_APP}
          />
        </TabGroup.Tab>
        <TabGroup.Tab label={t("ChatBot App")}>
          <AppCategoryList key={TrendingTypeEnum.CHATBOT} type={TrendingTypeEnum.CHATBOT} />
        </TabGroup.Tab>
        <TabGroup.Tab label={t("Bảng xếp hạng")}>
          <AppPromptRank />
        </TabGroup.Tab>
      </TabGroup>
    </div>
  );
};
