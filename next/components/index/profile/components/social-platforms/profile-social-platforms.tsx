import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FaTiktok } from "react-icons/fa";
import {
  RiFacebookCircleFill,
  RiSettings3Line,
  RiYoutubeFill,
} from "react-icons/ri";
import { AutoPostSocialSettingsDialog } from "../../../../app/affiliate-video/shared/auto-post-social/auto-post-social-settings-dialog";
import { useAutoPostSocialSettings } from "../../../../app/affiliate-video/shared/auto-post-social/use-auto-post-social-settings";
import { isSocialPlatformCredentialReady } from "../../../../app/affiliate-video/shared/auto-post-social/social-post-video-utils";
import { SOCIAL_PLATFORMS, type SocialPlatform } from "../../../../app/affiliate-video/shared/auto-post-social/types";
import { Button } from "../../../../shared/utilities/form";

const PLATFORM_ICONS: Record<SocialPlatform, JSX.Element> = {
  youtube: <RiYoutubeFill className="text-xl text-red-500" />,
  facebook: <RiFacebookCircleFill className="text-xl text-blue-500" />,
  tiktok: <FaTiktok className="text-xl text-gray-800" />,
};

export function ProfileSocialPlatforms() {
  const { t } = useTranslation();
  const {
    settings,
    credentials,
    patchPlatform,
    saveCredential,
    removeCredential,
    reloadCredentials,
    hydrated,
  } = useAutoPostSocialSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [initialPlatform, setInitialPlatform] = useState<SocialPlatform>("youtube");

  const openSettings = (platform: SocialPlatform) => {
    setInitialPlatform(platform);
    setSettingsOpen(true);
  };

  return (
    <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="flex flex-wrap gap-3 justify-between items-start mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">{t("Cấu hình đăng MXH")}</h2>
          <p className="mt-1 text-sm text-gray-500">
            {t("Kết nối YouTube, Facebook và TikTok để đăng video từ tab Video hoặc tự động đăng hàng loạt.")}
          </p>
        </div>
        <Button
          text={t("Mở cài đặt")}
          icon={<RiSettings3Line />}
          className="px-4 h-9 text-sm text-white bg-indigo-600 rounded-lg"
          onClick={() => openSettings("youtube")}
        />
      </div>

      {!hydrated ? (
        <p className="text-sm text-gray-400">{t("Đang tải…")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SOCIAL_PLATFORMS.map((p) => {
            const cred = credentials[p.id];
            const ready = isSocialPlatformCredentialReady(cred);
            return (
              <div
                key={p.id}
                className="flex flex-col gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50"
              >
                <div className="flex gap-2 items-center">
                  {PLATFORM_ICONS[p.id]}
                  <span className="text-sm font-bold text-gray-800">{t(p.label)}</span>
                  <span
                    className={`ml-auto text-10 font-semibold px-2 py-0.5 rounded-full ${
                      ready
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {ready ? t("Đã cấu hình") : t("Chưa cấu hình")}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {ready
                    ? t("Credential đã kích hoạt — có thể đăng video lên nền tảng này.")
                    : t("Chưa có credential hoặc chưa kích hoạt.")}
                </p>
                <Button
                  text={t("Cấu hình")}
                  className="mt-auto w-full h-8 text-xs font-semibold text-indigo-700 bg-white rounded-lg border border-indigo-200"
                  onClick={() => openSettings(p.id)}
                />
              </div>
            );
          })}
        </div>
      )}

      <AutoPostSocialSettingsDialog
        isOpen={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          void reloadCredentials();
        }}
        settings={settings}
        credentials={credentials}
        patchPlatform={patchPlatform}
        saveCredential={saveCredential}
        removeCredential={removeCredential}
        reloadCredentials={reloadCredentials}
        hidePromptGuide
        initialPlatform={initialPlatform}
      />
    </div>
  );
}
