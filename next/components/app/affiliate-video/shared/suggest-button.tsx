/**
 * suggest-button.tsx
 * Nút gợi ý AI – tái sử dụng cho single, trending (phải nằm trong <Form>)
 */
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { RiLoader4Fill, RiMagicFill } from "react-icons/ri";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { Button } from "../../../shared/utilities/form";
import {
  SuggestConfigParams,
  SuggestConfigResult,
  useAffiliateVideoApi,
} from "../hook/useAffiliateVideoApi";

export type SuggestButtonProps = {
  suggestParams?: SuggestConfigParams;
  onSuggestResult?: (result: SuggestConfigResult) => void;
  onLoadingChange?: (loading: boolean) => void;
  className?: string;
};

export const SuggestButton = ({
  suggestParams,
  onSuggestResult,
  onLoadingChange,
  className = "h-7 px-2",
}: SuggestButtonProps) => {
  const { t } = useTranslation();
  const { suggestConfig } = useAffiliateVideoApi();
  const formContext = useFormContext();
  const [isLoading, setIsLoading] = useState(false);
  const { customer } = useAuth();

  const handleSuggestConfig = async () => {
    if (isLoading) return;
    setIsLoading(true);
    onLoadingChange?.(true);
    try {
      const result = await suggestConfig(suggestParams ?? {});
      if (result) {
        formContext?.setValue("objectToPersonify", result.objectToPersonify);
        formContext?.setValue("tipContent", result.tipContent);
        onSuggestResult?.(result);
      }
    } catch {
      // Lỗi đã được xử lý bằng toast trong suggestConfig
    } finally {
      setIsLoading(false);
      onLoadingChange?.(false);
    }
  };

  return (
    <Button
      outline
      info
      onClick={handleSuggestConfig}
      disabled={isLoading || !customer}
      className="px-1 h-6"
      icon={
        isLoading ? (
          <RiLoader4Fill className="text-xs animate-spin" />
        ) : (
          <RiMagicFill className="text-xs" />
        )
      }
      text={isLoading ? t("Ai đang gợi ý...") : t("AI Gợi Ý")}
    />
  );
};
