import { AffiliateConfig } from "./affiliate-config";
import { AffiliateSubmit } from "./affiliate-submit";

export const TextToVideoTab = () => {
  return (
    <div>
      {/* ══ 2-column layout ══ */}
      <div className="flex flex-1 overflow-hidden">
        {/* ══ LEFT SIDEBAR ══ */}
        <div
          className="w-72 flex-shrink-0 flex flex-col border-r border-white border-opacity-8 overflow-hidden"
          style={{ background: "#09091a", borderColor: "rgba(255,255,255,0.07)" }}
        >
          <div className="flex flex-col overflow-hidden">
            {/* ── Top action bar ── */}
            <AffiliateConfig />

            {/* ── Bottom action bar ── */}
            <AffiliateSubmit />
          </div>
        </div>
      </div>
    </div>
  );
};
