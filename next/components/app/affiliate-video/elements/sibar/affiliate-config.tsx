/**
 * affiliate-config.tsx
 * Sidebar form: Tạo Nhân Vật – light theme, cream/white background
 * className only – Tailwind CSS, no inline styles, no arbitrary [] values
 * Field names aligned with AffiliateFormConfig interface.
 */
import { useTranslation } from "react-i18next";
import { BsFile } from "react-icons/bs";

import { useAuth } from "../../../../../lib/providers/auth-provider";
import { Button, Field, Textarea } from "../../../../shared/utilities/form";
import { ASPECT_RATIOS } from "../../constants";
import { useElementContext } from "../providers/element-provider";
import { ElementImagesUpload } from "./element-images-upload";

// ── Main Component ────────────────────────────────────────────────────────

export const AffiliateConfig = () => {
  const { t } = useTranslation();
  const { customer } = useAuth();
  const { patchConfig, elementFormConfig } = useElementContext();

  // Local state for instant UI feedback; synced from URL param on mount/navigation

  return (
    <div className="flex-1 bg-white">
      {/* ── Form Fields ── */}

      <div className="px-4 pb-4 space-y-3">
        <Field noError name="aspectRatio" label={t("Tỉ lệ khung hình")}>
          <div className="grid grid-cols-2 gap-2">
            {ASPECT_RATIOS.map((ar) => {
              const isPortrait = ar.value === "9:16";
              const isActive = elementFormConfig?.aspectRatio === ar.value;
              return (
                <Button
                  key={ar.value}
                  id={`aspect-ratio-${ar.value.replace(":", "-")}`}
                  onClick={() => patchConfig && patchConfig({ aspectRatio: ar.value })}
                  className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    isActive
                      ? "text-blue-600 bg-blue-50 border-blue-400"
                      : "text-gray-600 bg-white border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="text-base">
                    {isPortrait ? <BsFile /> : <BsFile style={{ transform: "rotate(90deg)" }} />}
                  </span>
                  {isPortrait ? `${ar.value} ${t("Dọc")}` : `${ar.value} ${t("Ngang")}`}
                </Button>
              );
            })}
          </div>
        </Field>

        {/* Ảnh sản phẩm */}
        <ElementImagesUpload
          artStyleImg={elementFormConfig?.artStyleImg}
          objectImg={elementFormConfig?.objectImg}
          itemImg={elementFormConfig?.itemImg}
          readOnly={!customer}
          onArtStyleImgChange={(v) => patchConfig && patchConfig({ artStyleImg: v })}
          onObjectImgChange={(v) => patchConfig && patchConfig({ objectImg: v })}
          onItemImgChange={(v) => patchConfig && patchConfig({ itemImg: v })}
        />

        <Field noError label={t("Prompt phân cảnh")}>
          <Textarea
            id="scene-prompt-list"
            className="border-gray-200 min-h-[200px]"
            maxRows={10}
            placeholder={t(
              "Mỗi dòng bắt đầu bằng số là một cảnh, ví dụ:\n1. Mô tả cảnh đầu...\n2. Mô tả cảnh hai...\n3. Mô tả cảnh ba..."
            )}
            value={elementFormConfig?.prompt}
            onChange={(v) => patchConfig && patchConfig({ prompt: v })}
          />
        </Field>
      </div>
    </div>
  );
};
