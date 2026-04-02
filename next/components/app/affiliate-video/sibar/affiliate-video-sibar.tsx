import { useTranslation } from "react-i18next";
import { TabGroup } from "../../../shared/utilities/tab";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";
import { AffiliateVideoRightPanel } from "../right-panel/affiliate-video-right-panel";
import { TextToVideoTab } from "./text-to-video-tab/text-to-video-tab";

export const AffiliateVideoSibar = () => {
  const { t } = useTranslation();
  const { modeTab, setModeTab } = useAffiliateVideoContext();
  return (
    <div>
      {/* ══ 2-column layout ══ */}
      <div className="flex flex-1 overflow-hidden">
        {/* ══ LEFT SIDEBAR ══ */}
        <div
          className="w-72 flex-shrink-0 flex flex-col border-r border-white border-opacity-8 overflow-hidden"
          style={{ background: "#09091a", borderColor: "rgba(255,255,255,0.07)" }}
        >
          {/* Mode tabs – dùng TabGroup */}

          <TabGroup
            index={(["text", "start_image", "start_end", "sync"] as ModeTab[]).indexOf(modeTab)}
            onChange={(i) =>
              setModeTab((["text", "start_image", "start_end", "sync"] as ModeTab[])[i])
            }
            className="border-b border-white border-opacity-8"
            tabClassName="py-2 text-10 font-semibold transition-all duration-150"
            titleClassName="text-10 font-semibold"
            activeClassName="text-indigo-400 bg-indigo-900 bg-opacity-20"
            inkbarClassName="absolute bottom-0 h-0.5 transition-all duration-300 ease-in-out origin-center bg-indigo-500"
            bodyClassName="flex-1 overflow-y-auto"
          >
            {/* ── Tab: Text ── */}
            <TabGroup.Tab label={`✏️ ${t("Text")}`}>
              <TextToVideoTab />
            </TabGroup.Tab>

            {/* ── Tab: Start Image ── */}
            <TabGroup.Tab label="🖼 Start">
              <div className="flex items-center justify-center h-40 text-blue-500 text-12">
                🖼 Start Image mode – coming soon
              </div>
            </TabGroup.Tab>

            {/* ── Tab: Start→End ── */}
            <TabGroup.Tab label="⏩ Start→End">
              <div className="flex items-center justify-center h-40 text-blue-500 text-12">
                ⏩ Start→End mode – coming soon
              </div>
            </TabGroup.Tab>

            {/* ── Tab: Đồng bộ ── */}
            <TabGroup.Tab label="🔄 Đồng bộ">
              <div className="flex items-center justify-center h-40 text-blue-500 text-12">
                🔄 Sync mode – coming soon
              </div>
            </TabGroup.Tab>
          </TabGroup>
        </div>

        {/* ══ RIGHT PANEL ══ */}
        <AffiliateVideoRightPanel />
      </div>
    </div>
  );
};
