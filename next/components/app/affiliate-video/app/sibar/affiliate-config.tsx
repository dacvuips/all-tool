/**
 * affiliate-config.tsx (app)
 * Sidebar hiển thị prompt và link của App đã chọn qua "Dùng ngay".
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RiAppStoreLine,
  RiCheckLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiLinkM,
} from "react-icons/ri";

import { useToast } from "../../../../../lib/providers/toast-provider";
import { Button } from "../../../../shared/utilities/form";
import { useAffiliateVideoContext } from "../../chatbot/providers/affiliate-video-provider";
import { parseAppPromptContent } from "../parse_app_prompt";

function CopyButton({ text, label }: { text: string; label?: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(t("Đã sao chép"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("Không thể sao chép"));
    }
  }, [text, toast, t]);

  return (
    <Button
      outline
      className="h-8 px-2 text-xs rounded-lg"
      text={copied ? t("Đã sao chép") : label || t("Sao chép")}
      icon={copied ? <RiCheckLine className="text-sm" /> : <RiFileCopyLine className="text-sm" />}
      onClick={handleCopy}
    />
  );
}

export const AffiliateConfig = () => {
  const { t } = useTranslation();
  const { videoConfig, pendingPrompt, setPendingPrompt } = useAffiliateVideoContext();

  const selectedName = videoConfig?.promptName;
  const selectedId = videoConfig?.promptId;
  const promptContent = videoConfig?.tipContent || "";

  useEffect(() => {
    if (pendingPrompt && setPendingPrompt) {
      setPendingPrompt(null);
    }
  }, [pendingPrompt, setPendingPrompt]);

  const { prompts, links } = useMemo(() => parseAppPromptContent(promptContent), [promptContent]);
  const fullPromptText = prompts.join("\n");

  if (!selectedId) {
    return (
      <div className="flex flex-col flex-1 justify-center items-center px-6 py-10 text-center bg-white">
        <div className="flex justify-center items-center mb-3 w-14 h-14 bg-emerald-50 rounded-full">
          <RiAppStoreLine className="text-2xl text-emerald-500" />
        </div>
        <p className="m-0 text-sm font-semibold text-gray-700">{t("Chưa chọn App")}</p>
        <p className="mt-2 m-0 text-xs leading-relaxed text-gray-400">
          {t('Nhấn "Dùng ngay" trên App bên phải để xem prompt và link')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white">
      <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4 v-scrollbar">
        <div className="p-3 bg-green-50 rounded-xl border border-green-100">
          <div className="text-[10px] font-semibold tracking-wide text-green-600 uppercase">
            {t("App đang dùng")}
          </div>
          <div className="mt-1 text-sm font-bold text-gray-800 line-clamp-2">{selectedName}</div>
        </div>

        {fullPromptText && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <div className="flex gap-1.5 items-center text-xs font-semibold text-gray-700">
                <RiAppStoreLine className="text-green-500" />
                {t("Prompt")}
              </div>
              <CopyButton text={fullPromptText} />
            </div>
            <div className="p-3 text-xs leading-relaxed text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-xl border border-gray-100">
              {fullPromptText}
            </div>
          </div>
        )}

        {links.length > 0 && (
          <div>
            <div className="flex gap-1.5 items-center mb-2 text-xs font-semibold text-gray-700">
              <RiLinkM className="text-blue-500" />
              {t("Link App")}
            </div>
            <div className="space-y-2">
              {links.map((link) => (
                <div key={link} className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs text-blue-600 break-all hover:underline"
                  >
                    {link}
                  </a>
                  <div className="flex gap-2 mt-2">
                    <Button
                      primary
                      className="flex-1 h-8 whitespace-nowrap text-xs rounded-lg"
                      text={t("Mở link")}
                      icon={<RiExternalLinkLine className="text-sm" />}
                      onClick={() => window.open(link, "_blank", "noopener,noreferrer")}
                    />
                    <CopyButton text={link} label={t("Sao chép link")} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!fullPromptText && links.length === 0 && (
          <div className="p-4 text-xs text-center text-gray-400 bg-gray-50 rounded-xl border border-gray-100">
            {t("App này chưa có prompt hoặc link")}
          </div>
        )}
      </div>
    </div>
  );
};
