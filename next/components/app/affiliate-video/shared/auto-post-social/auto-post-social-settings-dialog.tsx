/**
 * Modal cài đặt tự động đăng MXH — 3 tab Youtube / Facebook / Tiktok.
 * Mỗi nền tảng: Credential | Hướng dẫn Prompt | Hướng dẫn lấy AccessToken.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaTiktok } from "react-icons/fa";
import {
  RiFacebookCircleFill,
  RiInformationLine,
  RiKey2Line,
  RiSettings3Line,
  RiYoutubeFill,
} from "react-icons/ri";
import { Dialog } from "../../../../shared/utilities/dialog/dialog";
import { Switch } from "../../../../shared/utilities/form/switch";
import { CredentialConnectField } from "./credential-connect-field";
import {
  formatSocialPostPromptSample,
  getSocialPostFieldMeta,
  getSocialPostHeaderFieldKeys,
  getSocialPostPromptGuideIntro,
} from "./grouped-list/types";
import {
  AutoPostSocialSettings,
  PlatformAutoPostConfig,
  SOCIAL_PLATFORMS,
  SocialCredentialState,
  SocialPlatform,
} from "./types";
import { YoutubeAccessTokenGuide } from "./youtube-access-token-guide";
import { FacebookAccessTokenGuide } from "./facebook-access-token-guide";

const PLATFORM_ICONS: Record<SocialPlatform, JSX.Element> = {
  youtube: <RiYoutubeFill className="text-base text-red-500" />,
  facebook: <RiFacebookCircleFill className="text-base text-blue-500" />,
  tiktok: <FaTiktok className="text-base text-gray-800" />,
};

type ContentTab = "credential" | "prompt" | "access-token";

const CONTENT_TABS: { id: ContentTab; labelKey: string; icon: JSX.Element }[] = [
  { id: "credential", labelKey: "Credential", icon: <RiKey2Line className="text-sm" /> },
  {
    id: "access-token",
    labelKey: "Hướng dẫn lấy AccessToken",
    icon: <RiKey2Line className="text-sm" />,
  },
  {
    id: "prompt",
    labelKey: "Hướng dẫn Prompt phân cảnh",
    icon: <RiInformationLine className="text-sm" />,
  },
];

function PromptGuidePanel({ platform }: { platform: SocialPlatform }) {
  const { t } = useTranslation();
  const promptSample = formatSocialPostPromptSample(platform);
  const fieldKeys = getSocialPostHeaderFieldKeys(platform);
  const platformLabel = SOCIAL_PLATFORMS.find((p) => p.id === platform)?.label || platform;

  return (
    <div className="px-4 py-3 bg-indigo-50 rounded-xl border border-indigo-100">
      <div className="flex gap-2 items-start">
        <RiInformationLine className="mt-0.5 text-base text-indigo-500 shrink-0" />
        <div className="space-y-2 min-w-0">
          <p className="text-sm font-semibold text-indigo-900">
            {t("Hướng dẫn Prompt phân cảnh")} — {t(platformLabel)}
          </p>
          <p className="text-xs leading-relaxed text-indigo-800">
            {t(getSocialPostPromptGuideIntro(platform))}
          </p>
          <p className="text-xs leading-relaxed text-indigo-800">
            {t("Mỗi nhóm bài đăng cần bắt đầu bằng một dòng dạng")}:
          </p>
          <pre className="px-2.5 py-2 text-xs font-semibold text-indigo-900 whitespace-pre-wrap break-words bg-white rounded-lg border border-indigo-200">
            {promptSample}
          </pre>
          <p className="text-xs text-indigo-700">
            {t(
              "Dòng đầu (trong **) là metadata đăng MXH. Các dòng tiếp theo là prompt từng phân cảnh thuộc cùng một bài đăng."
            )}
          </p>
          {platform === "facebook" ? (
            <p className="text-xs text-indigo-700">
              {t(
                "Nếu bật cả YouTube, có thể thêm |Trẻ em|Danh mục ở cuối dòng — Facebook sẽ bỏ qua 2 field đó."
              )}
            </p>
          ) : null}
          <p className="text-xs text-indigo-700">
            {t("Các field trên dòng metadata (gửi API đăng {{platform}})", {
              platform: platformLabel,
            })}
            :
          </p>
          <ul className="space-y-1.5">
            {fieldKeys.map((key) => {
              const meta = getSocialPostFieldMeta(platform, key);
              return (
                <li key={key} className="text-xs leading-relaxed text-indigo-800">
                  <span className="font-bold text-indigo-900">&quot;{t(meta.label)}&quot;</span>:{" "}
                  {t(meta.hint)}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function AccessTokenGuidePanel({ platform }: { platform: SocialPlatform }) {
  const { t } = useTranslation();

  if (platform === "youtube") {
    return <YoutubeAccessTokenGuide />;
  }

  if (platform === "facebook") {
    return <FacebookAccessTokenGuide />;
  }

  const steps: Record<"tiktok", string[]> = {
    tiktok: [
      t("Đăng ký app trên TikTok for Developers và bật Content Posting API."),
      t("Hoàn tất OAuth để lấy access_token cho tài khoản TikTok."),
      t("Dán access_token vào tab Credential."),
      t("Kiểm tra quyền upload video trước khi chạy tự động đăng."),
    ],
  };

  return (
    <div className="px-4 py-3 bg-amber-50 rounded-xl border border-amber-100">
      <div className="flex gap-2 items-start">
        <RiKey2Line className="mt-0.5 text-base text-amber-600 shrink-0" />
        <div className="space-y-2 min-w-0">
          <p className="text-sm font-semibold text-amber-900">
            {t("Hướng dẫn lấy AccessToken")} —{" "}
            {t(SOCIAL_PLATFORMS.find((p) => p.id === platform)!.label)}
          </p>
          <ol className="pl-4 space-y-2 list-decimal">
            {steps[platform].map((step, i) => (
              <li key={i} className="text-xs leading-relaxed text-amber-900">
                {step}
              </li>
            ))}
          </ol>
          <p className="pt-1 text-xs text-amber-800">
            {t("Sau khi có token, quay lại tab Credential để lưu và kích hoạt đăng tự động.")}
          </p>
        </div>
      </div>
    </div>
  );
}

interface AutoPostSocialSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AutoPostSocialSettings;
  credentials: Record<SocialPlatform, SocialCredentialState>;
  patchPlatform: (platform: SocialPlatform, patch: Partial<PlatformAutoPostConfig>) => void;
  saveCredential: (input: {
    platform: SocialPlatform;
    value: string;
    id?: string | null;
  }) => Promise<unknown>;
  removeCredential: (platform: SocialPlatform) => Promise<void>;
  reloadCredentials?: () => void | Promise<void>;
}

export function AutoPostSocialSettingsDialog({
  isOpen,
  onClose,
  settings,
  credentials,
  patchPlatform,
  saveCredential,
  removeCredential,
  reloadCredentials,
}: AutoPostSocialSettingsDialogProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SocialPlatform>("youtube");
  const [contentTab, setContentTab] = useState<ContentTab>("credential");

  const meta = SOCIAL_PLATFORMS.find((p) => p.id === activeTab)!;
  const platformCfg = settings.platforms[activeTab];
  const credential = credentials[activeTab];

  useEffect(() => {
    setContentTab("credential");
  }, [activeTab]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      width={600}
      slideFromBottom="none"
      dialogClass="relative overflow-hidden rounded-2xl bg-white shadow-lg max-h-[85vh] flex flex-col"
      bodyClass="relative px-5 pb-5 bg-white overflow-y-auto flex-1 min-h-0 v-scrollbar"
      hasCloseIcon
      title={t("Cài đặt đăng MXH")}
      icon={<RiSettings3Line className="text-lg text-indigo-500" />}
    >
      <Dialog.Body>
        <div className="pt-1">
          {/* Tab nền tảng */}
          <div className="flex sticky top-0 z-10 gap-1 p-1 mb-3 bg-gray-50 rounded-xl border border-gray-100">
            {SOCIAL_PLATFORMS.map((p) => {
              const isActive = p.id === activeTab;
              const cfg = settings.platforms[p.id];
              const cred = credentials[p.id];
              const hasCred = !!cred?.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActiveTab(p.id)}
                  className={`flex-1 text-xs font-medium py-2 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                    isActive
                      ? "bg-white shadow-sm text-gray-800 border-gray-200"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 border-transparent bg-transparent"
                  }`}
                >
                  {PLATFORM_ICONS[p.id]}
                  <span>{t(p.label)}</span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      cfg.enabled && hasCred && cred.active
                        ? "bg-green-500"
                        : hasCred
                        ? "bg-amber-400"
                        : "bg-gray-300"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Tab nội dung */}
          <div className="flex overflow-x-auto gap-1 p-1 mb-4 bg-white rounded-xl border border-gray-100">
            {CONTENT_TABS.map((tab) => {
              const isActive = contentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setContentTab(tab.id)}
                  className={`shrink-0 text-10 font-medium py-1.5 px-2.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer border whitespace-nowrap ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-transparent"
                  }`}
                >
                  {tab.icon}
                  <span>{t(tab.labelKey)}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-4">
            {contentTab === "credential" ? (
              <>
                <CredentialConnectField
                  platform={activeTab}
                  credential={credential}
                  onSave={saveCredential}
                  onDelete={removeCredential}
                  onOAuthConnected={reloadCredentials}
                />

                <div className="px-4 py-3 bg-white rounded-xl border border-gray-200">
                  <div className="flex gap-3 justify-between items-center">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800">
                        {t("Bật đăng lên")} {t(meta.label)}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {t("Khi tắt, nền tảng này sẽ bị bỏ qua khi tự động đăng.")}
                      </p>
                    </div>
                    <Switch
                      size="sm"
                      dependent
                      value={platformCfg.enabled}
                      onChange={(v) => patchPlatform(activeTab, { enabled: !!v })}
                      className="flex-shrink-0"
                    />
                  </div>
                </div>

                <div className="px-4 py-3 bg-white rounded-xl border border-gray-200">
                  <div className="flex gap-3 justify-between items-center">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{t("Đăng ngay")}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {platformCfg.postImmediately
                          ? t("Bật: xong phần này thì đăng ngay phần đó lên MXH.")
                          : t("Tắt: chờ xong hoàn toàn rồi mới chạy đăng hàng loạt.")}
                      </p>
                    </div>
                    <Switch
                      size="sm"
                      dependent
                      value={platformCfg.postImmediately}
                      onChange={(v) => patchPlatform(activeTab, { postImmediately: !!v })}
                      className="flex-shrink-0"
                    />
                  </div>
                </div>
              </>
            ) : null}
            {contentTab === "access-token" ? <AccessTokenGuidePanel platform={activeTab} /> : null}
            {contentTab === "prompt" ? <PromptGuidePanel platform={activeTab} /> : null}
          </div>
        </div>
      </Dialog.Body>
    </Dialog>
  );
}
