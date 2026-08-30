/**
 * affiliate-config.tsx
 * Sidebar form: Tạo Nhân Vật – light theme, cream/white background
 * className only – Tailwind CSS, no inline styles, no arbitrary [] values
 * Field names aligned with AffiliateFormConfig interface.
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { BsFile } from "react-icons/bs";
import { RiListOrdered, RiMagicFill } from "react-icons/ri";

import { useQueryParams } from "../../../../../lib/hooks/useQueryParams";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { Button, Field, Label, Radio, Textarea } from "../../../../shared/utilities/form";
import { TabGroup } from "../../../../shared/utilities/tab/tab-group";
import { ASPECT_RATIOS, ELEMENT_SCRIPT_TAB_QUERY_KEY, ElementScriptTabEnum } from "../../constants";
import { AffiliateSidebarIntro } from "../../shared/affiliate-sidebar-intro";
import { getElementSidebarIntroSteps } from "../../shared/affiliate-sidebar-intro-steps";
import { ArtStylePickerDialog } from "../../shared/art-style-picker-dialog";
import { formatSocialPostHeaderTemplateForEnabledPlatforms, useAutoPostSocialPreferences } from "../../shared/auto-post-social";
import { ActionImageEnum, ServiceImageEnum } from "../constants";
import { useElementContext } from "../providers/element-provider";
import { getSequentialArtStyleImgTabCount } from "../utils/elementFormImageUtils";
import { ElementImagesUpload, ElementVideoUpload } from "./element-images-upload";

// ── Main Component ────────────────────────────────────────────────────────

export const AffiliateConfig = ({
  introOpen = false,
  onIntroDismiss,
}: {
  introOpen?: boolean;
  onIntroDismiss?: () => void;
}) => {
  const { t } = useTranslation();
  const { customer } = useAuth();
  const { patchConfig, elementFormConfig, scriptTab } = useElementContext();
  const [queryParams] = useQueryParams({
    [ELEMENT_SCRIPT_TAB_QUERY_KEY]: "",
  });
  const { settings: autoPostSettings, hydrated: autoPostHydrated } = useAutoPostSocialPreferences();
  const introSteps = useMemo(() => getElementSidebarIntroSteps(t), [t]);

  const tabParam = queryParams[ELEMENT_SCRIPT_TAB_QUERY_KEY] as string | undefined;
  /** Đồng bộ với elementForm / right-panel — URL có thể thiếu elementScriptTab sau shallow route */
  const activeScriptTab: ElementScriptTabEnum =
    tabParam && Object.values(ElementScriptTabEnum).includes(tabParam as ElementScriptTabEnum)
      ? (tabParam as ElementScriptTabEnum)
      : scriptTab ?? ElementScriptTabEnum.batch;

  const isImagesToVideo = activeScriptTab === ElementScriptTabEnum.imagesToVideo;
  const isVideoToVideo = activeScriptTab === ElementScriptTabEnum.videoToVideo;
  const isElementBatchMode = activeScriptTab === ElementScriptTabEnum.batch;
  const autoPostEnabled =
    isElementBatchMode && autoPostHydrated && autoPostSettings.enabled;

  const autoPostHeaderTemplate = formatSocialPostHeaderTemplateForEnabledPlatforms({
    youtube: autoPostSettings.platforms.youtube?.enabled,
    facebook: autoPostSettings.platforms.facebook?.enabled,
    tiktok: autoPostSettings.platforms.tiktok?.enabled,
  });

  const actionImageType = elementFormConfig?.actionImageType ?? ActionImageEnum.auto;
  const isSequentialImageMode =
    actionImageType === ActionImageEnum.sequential && (isElementBatchMode || isImagesToVideo);

  const sequentialTabCount = getSequentialArtStyleImgTabCount({
    isElementBatchMode,
    serviceImageType: elementFormConfig?.serviceImageType,
  });

  const sequentialImages = elementFormConfig?.artStyleImgSequential ?? [];

  const patchSequentialTabImages = (tabIndex: number, images: typeof sequentialImages[number]) => {
    const next = Array.from({ length: sequentialTabCount }, (_, i) =>
      i === tabIndex ? images : sequentialImages[i]
    );
    patchConfig?.({ artStyleImgSequential: next });
  };

  const handleServiceImageTypeChange = (val: ServiceImageEnum) => {
    if (!patchConfig) return;
    const patch: Record<string, unknown> = { serviceImageType: val };
    if (actionImageType === ActionImageEnum.sequential) {
      const newTabCount = getSequentialArtStyleImgTabCount({
        isElementBatchMode: false,
        serviceImageType: val,
      });
      const current = elementFormConfig?.artStyleImgSequential ?? [];
      patch.artStyleImgSequential = Array.from({ length: newTabCount }, (_, i) => current[i]);
    }
    patchConfig(patch as Parameters<NonNullable<typeof patchConfig>>[0]);
  };

  const handleActionImageTypeChange = (val: ActionImageEnum) => {
    if (val === actionImageType) return;
    // Chỉ đổi chế độ — giữ nguyên artStyleImg (auto) và artStyleImgSequential (tuần tự).
    patchConfig?.({ actionImageType: val });
  };

  return (
    <>
      <AffiliateSidebarIntro
        isOpen={introOpen}
        steps={introSteps}
        onDismiss={onIntroDismiss ?? (() => {})}
      />
      <div className="flex-1 bg-white">
        {/* ── Form Fields ── */}

        <div className="px-4 pb-4 space-y-3">
          <Field className="mt-3" noError>
            <div
              id="element-image-mode-section"
              className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-xl"
            >
              {(
                [
                  {
                    value: ActionImageEnum.auto,
                    label: t("Nạp ảnh tự động"),
                    Icon: RiMagicFill,
                  },
                  {
                    value: ActionImageEnum.sequential,
                    label: t("Nạp ảnh tuần tự"),
                    Icon: RiListOrdered,
                  },
                ] as const
              ).map(({ value, label, Icon }) => {
                const isActive = actionImageType === value;
                return (
                  <div
                    key={value}
                    onClick={() => handleActionImageTypeChange(value)}
                    className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 ${
                      isActive
                        ? "text-gray-800 bg-white shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Icon
                      className={isActive ? "text-pink-500 shrink-0" : "text-gray-400 shrink-0"}
                    />
                    {label}
                  </div>
                );
              })}
            </div>
          </Field>

          <div id="aspect-ratio-section">
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
                        {isPortrait ? (
                          <BsFile />
                        ) : (
                          <BsFile style={{ transform: "rotate(90deg)" }} />
                        )}
                      </span>
                      {isPortrait ? `${ar.value} ${t("Dọc")}` : `${ar.value} ${t("Ngang")}`}
                    </Button>
                  );
                })}
              </div>
            </Field>
          </div>
          <div>
            <ArtStylePickerDialog
              name="artStyle"
              value={elementFormConfig?.artStyle}
              onChange={(v) => patchConfig && patchConfig({ artStyle: v })}
              onCodeChange={(code) => patchConfig && patchConfig({ artStyleId: code })}
            />
          </div>

          <div id="scene-prompt-section">
            <Field noError label={t("Prompt phân cảnh")}>
              <Textarea
                id="scene-prompt-list"
                className="border-gray-200 min-h-[200px]"
                maxRows={10}
                placeholder={
                  autoPostEnabled
                    ? `${t("Mỗi nhóm bài đăng MXH bắt đầu bằng dòng")}:\n${autoPostHeaderTemplate}\n${t("prompt1")}\n${t("prompt2")}\n${autoPostHeaderTemplate}\n${t("prompt3")}`
                    : `${t("Mỗi dòng xuống hàng (Enter) là một phân cảnh")}:\n${t("Mô tả cảnh đầu")}...\n${t("Mô tả cảnh hai")}...\n${t("Mô tả cảnh ba")}...`
                }
                value={elementFormConfig?.prompt}
                onChange={(v) => patchConfig && patchConfig({ prompt: v })}
              />
            </Field>
          </div>
          {/* Option cho Images to Video*/}
          {isImagesToVideo && (
            <Field label={t("Chế độ nạp ảnh")}>
              <Radio
                defaultValue={ServiceImageEnum.imageOnly}
                selectFirst
                cols={12}
                value={elementFormConfig.serviceImageType}
                onChange={(val) => handleServiceImageTypeChange(val)}
                options={[
                  { label: t("Chỉ có ảnh bắt đầu -> Video"), value: ServiceImageEnum.imageOnly },
                  {
                    label: t("Ảnh bắt đầu và kết thúc -> Video"),
                    value: ServiceImageEnum.startEnd,
                  },
                  { label: t("2 ảnh kết hợp -> Video"), value: ServiceImageEnum.startAddEnd },
                ]}
              />
            </Field>
          )}
          {isVideoToVideo && (
            <ElementVideoUpload
              videoRef={elementFormConfig?.videoRef}
              readOnly={!customer}
              onVideoRefChange={(v) => patchConfig && patchConfig({ videoRef: v })}
            />
          )}

          {/* Ảnh thành phần / ảnh tham chiếu */}
          <div id="element-images-upload">
            {isSequentialImageMode ? (
              <div>
                <Label text={t("Ảnh Tham chiêu (Tùy chọn)")} />
                <TabGroup
                  name="element-sequential-art-images"
                  flex
                  tabClassName="px-2 py-2"
                  titleClassName="text-xs font-semibold whitespace-nowrap"
                  bodyClassName="pt-3"
                  className="-mx-4"
                >
                  {Array.from({ length: sequentialTabCount }, (_, i) => (
                    <TabGroup.Tab key={i} label={t("Vị trí {{n}}", { n: i + 1 })}>
                      <ElementImagesUpload
                        artStyleImg={sequentialImages[i]}
                        readOnly={!customer}
                        onArtStyleImgChange={(v) => patchSequentialTabImages(i, v)}
                      />
                    </TabGroup.Tab>
                  ))}
                </TabGroup>
              </div>
            ) : (
              <ElementImagesUpload
                label={t("Ảnh Tham chiêu (Tùy chọn)")}
                artStyleImg={elementFormConfig?.artStyleImg}
                readOnly={!customer}
                onArtStyleImgChange={(v) => patchConfig && patchConfig({ artStyleImg: v })}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
};
