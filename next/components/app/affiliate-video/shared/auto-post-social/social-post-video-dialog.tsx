/**
 * Modal đăng video đơn lẻ lên MXH — 3 tab Youtube / Facebook / Tiktok.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaTiktok } from "react-icons/fa";
import {
  RiAlertLine,
  RiCheckLine,
  RiFacebookCircleFill,
  RiLoader4Line,
  RiShareForwardLine,
  RiYoutubeFill,
} from "react-icons/ri";
import { facebookPostRepository } from "../../../../../lib/repo/facebook/facebook-post.repo";
import { youtubePostRepository } from "../../../../../lib/repo/youtube/youtube-post.repo";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { Button } from "../../../../shared/utilities/form";
import { Dialog } from "../../../../shared/utilities/dialog/dialog";
import type { GeneratedVideoLike } from "../generatedMediaUtils";
import { AutoPostSocialSettingsDialog } from "./auto-post-social-settings-dialog";
import {
  toPostFacebookPageVideoMeta,
  toPostYoutubeVideoMeta,
  type SocialPostPlatformFields,
} from "./grouped-list/types";
import {
  createDefaultSocialPostFormFields,
  SocialPostPlatformPostForm,
} from "./social-post-platform-post-form";
import {
  generatedVideoToRawBase64,
  isSocialPlatformCredentialReady,
} from "./social-post-video-utils";
import { SOCIAL_PLATFORMS, type SocialPlatform } from "./types";
import { useAutoPostSocialSettings } from "./use-auto-post-social-settings";

const PLATFORM_ICONS: Record<SocialPlatform, JSX.Element> = {
  youtube: <RiYoutubeFill className="text-base text-red-500" />,
  facebook: <RiFacebookCircleFill className="text-base text-blue-500" />,
  tiktok: <FaTiktok className="text-base text-gray-800" />,
};

export function SocialPostVideoDialog({
  isOpen,
  onClose,
  video,
  defaultTitle,
}: {
  isOpen: boolean;
  onClose: () => void;
  video: GeneratedVideoLike;
  defaultTitle?: string;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const {
    settings,
    credentials,
    patchPlatform,
    saveCredential,
    removeCredential,
    reloadCredentials,
  } = useAutoPostSocialSettings();

  const [activeTab, setActiveTab] = useState<SocialPlatform>("youtube");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastResultUrl, setLastResultUrl] = useState<string | null>(null);
  const [formByPlatform, setFormByPlatform] = useState<
    Record<SocialPlatform, SocialPostPlatformFields>
  >({
    youtube: createDefaultSocialPostFormFields("youtube", defaultTitle),
    facebook: createDefaultSocialPostFormFields("facebook", defaultTitle),
    tiktok: createDefaultSocialPostFormFields("tiktok", defaultTitle),
  });

  useEffect(() => {
    if (!isOpen) return;
    setLastResultUrl(null);
    setFormByPlatform({
      youtube: createDefaultSocialPostFormFields("youtube", defaultTitle),
      facebook: createDefaultSocialPostFormFields("facebook", defaultTitle),
      tiktok: createDefaultSocialPostFormFields("tiktok", defaultTitle),
    });
  }, [isOpen, defaultTitle]);

  const credential = credentials[activeTab];
  const configured = isSocialPlatformCredentialReady(credential);
  const platformMeta = SOCIAL_PLATFORMS.find((p) => p.id === activeTab)!;
  const fields = formByPlatform[activeTab];
  const titleMissing = !fields.title.trim();

  const canSubmit = useMemo(() => {
    if (!configured || uploading || titleMissing) return false;
    if (activeTab === "tiktok") return false;
    return true;
  }, [activeTab, configured, uploading, titleMissing]);

  const patchFields = useCallback((platform: SocialPlatform, next: SocialPostPlatformFields) => {
    setFormByPlatform((prev) => ({ ...prev, [platform]: next }));
  }, []);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setUploading(true);
    setLastResultUrl(null);
    try {
      const videoBase64 = await generatedVideoToRawBase64(video);
      const affiliateLink = fields.link.trim() || undefined;

      if (activeTab === "youtube") {
        const meta = toPostYoutubeVideoMeta(fields);
        const result = await youtubePostRepository.postYoutubeVideo({
          videoBase64,
          ...meta,
          affiliateLink,
        });
        setLastResultUrl(result.url);
        toast.success(t("Đã đăng video lên YouTube"));
        if (result.linkCommentWarning) {
          toast.warn(result.linkCommentWarning);
        }
      } else if (activeTab === "facebook") {
        const meta = toPostFacebookPageVideoMeta(fields);
        const result = await facebookPostRepository.postFacebookPageVideo({
          videoBase64,
          ...meta,
          affiliateLink,
        });
        setLastResultUrl(result.url);
        if (!result.published) {
          toast.warn(
            t(
              "Video đã upload nhưng chưa công khai trên Fanpage (private). Đổi «Riêng tư» sang public rồi đăng lại, hoặc publish thủ công trong Meta Business Suite."
            )
          );
        } else {
          toast.success(t("Đã đăng video lên Facebook"));
        }
        if (result.linkCommentWarning) {
          toast.warn(result.linkCommentWarning);
        }
      }
    } catch (err) {
      console.error("[SocialPostVideoDialog]", err);
      toast.error(err instanceof Error ? err.message : t("Không thể đăng video"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={onClose}
        width={560}
        slideFromBottom="none"
        dialogClass="relative overflow-hidden rounded-2xl bg-white shadow-lg max-h-[85vh] flex flex-col"
        bodyClass="relative px-5 pb-5 bg-white overflow-y-auto flex-1 min-h-0 v-scrollbar"
        hasCloseIcon
        title={t("Đăng video lên MXH")}
        icon={<RiShareForwardLine className="text-lg text-indigo-500" />}
      >
        <Dialog.Body>
          <div className="pt-1 space-y-4">
            <div className="flex gap-1 p-1 bg-gray-50 rounded-xl border border-gray-100">
              {SOCIAL_PLATFORMS.map((p) => {
                const isActive = p.id === activeTab;
                const cred = credentials[p.id];
                const ready = isSocialPlatformCredentialReady(cred);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(p.id);
                      setLastResultUrl(null);
                    }}
                    className={`flex-1 text-xs font-medium py-2 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                      isActive
                        ? "bg-white shadow-sm text-gray-800 border-gray-200"
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 border-transparent bg-transparent"
                    }`}
                  >
                    {PLATFORM_ICONS[p.id]}
                    <span>{t(p.label)}</span>
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        ready ? "bg-green-500" : "bg-gray-300"
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {!configured ? (
              <div className="px-3 py-2.5 rounded-lg border border-red-200 bg-red-50">
                <p className="flex gap-1.5 items-start text-xs font-semibold text-red-700">
                  <RiAlertLine className="mt-0.5 text-sm shrink-0" />
                  <span>
                    {t("Chưa cấu hình credential cho {{platform}}.", {
                      platform: t(platformMeta.label),
                    })}{" "}
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(true)}
                      className="font-bold underline cursor-pointer text-red-800 hover:text-red-900"
                    >
                      {t("Nhấp vào đây để cấu hình")}
                    </button>
                  </span>
                </p>
              </div>
            ) : null}

            {activeTab === "tiktok" && configured ? (
              <div className="px-3 py-2.5 rounded-lg border border-amber-200 bg-amber-50">
                <p className="text-xs font-semibold text-amber-800">
                  {t("TikTok: API đăng video chưa được hỗ trợ. Vui lòng dùng YouTube hoặc Facebook.")}
                </p>
              </div>
            ) : null}

            <SocialPostPlatformPostForm
              platform={activeTab}
              fields={fields}
              onChange={(next) => patchFields(activeTab, next)}
              disabled={!configured || uploading || activeTab === "tiktok"}
            />

            {lastResultUrl ? (
              <div className="flex gap-2 items-center px-3 py-2 text-xs font-medium text-green-800 bg-green-50 rounded-lg border border-green-200">
                <RiCheckLine className="text-sm shrink-0" />
                <a
                  href={lastResultUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate underline hover:text-green-900"
                >
                  {lastResultUrl}
                </a>
              </div>
            ) : null}

            <div className="flex gap-2 justify-end pt-1">
              <Button
                text={t("Đóng")}
                className="px-4 h-9 text-sm bg-gray-100 text-gray-700 rounded-lg"
                onClick={onClose}
              />
              <Button
                text={uploading ? t("Đang đăng…") : t("Đăng video")}
                className="px-4 h-9 text-sm text-white bg-indigo-600 rounded-lg disabled:opacity-50"
                disabled={!canSubmit}
                isLoading={uploading}
                onClick={() => void handleSubmit()}
              />
            </div>
          </div>
        </Dialog.Body>
      </Dialog>

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
        initialPlatform={activeTab}
      />
    </>
  );
}
