import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "../../../components/shared/utilities/dialog/dialog";
import { Button, Checkbox } from "../../../components/shared/utilities/form";
import { TERMS_OF_SERVICE_SETTING_KEY } from "../../../lib/constants/terms-of-service.sample";
import { sanitizeCkEditorContent } from "../../../lib/helpers/ck-editor-content";
import { useSettingPublic } from "../../../lib/hooks/useSettingPublic";
import { useAuth } from "../../../lib/providers/auth-provider";
import { useToast } from "../../../lib/providers/toast-provider";
import { CustomerService } from "../../../lib/repo/customer/customer.repo";

const SCROLL_BOTTOM_THRESHOLD = 32;

export function TermsOfServiceDialog() {
  const { t } = useTranslation();
  const toast = useToast();
  const { customer, setCustomer } = useAuth();
  const termsSetting = useSettingPublic(TERMS_OF_SERVICE_SETTING_KEY);
  const contentRef = useRef<HTMLDivElement>(null);
  const [hasRead, setHasRead] = useState(false);
  const [hasReachedBottom, setHasReachedBottom] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isOpen = !!(customer && !customer.acceptedTermsOfService && termsSetting?.value);

  const checkReachedBottom = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (
      el.scrollHeight <= el.clientHeight + SCROLL_BOTTOM_THRESHOLD ||
      distanceToBottom <= SCROLL_BOTTOM_THRESHOLD
    ) {
      setHasReachedBottom(true);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setHasRead(false);
    setHasReachedBottom(false);
    const frame = requestAnimationFrame(checkReachedBottom);
    return () => cancelAnimationFrame(frame);
  }, [isOpen, termsSetting?.value, checkReachedBottom]);

  const handleAccept = async () => {
    if (!hasReachedBottom || !hasRead || submitting) return;
    setSubmitting(true);
    try {
      await CustomerService.customerAcceptTermsOfService();
      setCustomer({ ...customer, acceptedTermsOfService: true });
    } catch (error) {
      toast.error(error?.message || t("Không thể xác nhận điều khoản"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog
      isOpen
      hasCloseIcon={false}
      width={720}
      maxWidth="94vw"
      slideFromBottom="none"
      title={"Điều khoản sử dụng dịch vụ"}
      wrapperClass="fixed w-full h-screen top-0 left-0 z-100 flex flex-col items-center overflow-hidden px-3 pt-20 pb-3 no-scrollbar"
      extraDialogClass="overflow-hidden flex flex-col w-full flex-1 min-h-0 my-0"
      extraDialogStyle={{ margin: 0, maxHeight: "calc(100dvh - 3.5rem - 12px)" }}
      extraBodyClass="rounded-none rounded-b-none flex flex-col flex-1 min-h-0 overflow-hidden  pb-3"
      extraFooterClass="rounded-b-2xl flex-shrink-0"
      onOverlayClick={() => {}}
    >
      <Dialog.Body>
        <div
          ref={contentRef}
          className="flex-1 pr-2 min-h-0 ck-content v-scrollbar"
          onScroll={checkReachedBottom}
          dangerouslySetInnerHTML={{
            __html: sanitizeCkEditorContent(termsSetting.value),
          }}
        />
        <div className="flex-shrink-0 pt-3 mt-3 border-t border-gray-200">
          <Checkbox
            readOnly={!hasReachedBottom}
            value={hasRead}
            onChange={(val) => {
              if (!hasReachedBottom) return;
              setHasRead(!!val);
            }}
            placeholder={t("Tôi đã đọc và đồng ý với điều khoản sử dụng dịch vụ")}
          />
          {!hasReachedBottom && (
            <div className="mt-1 text-xs text-gray-500">
              {t("Vui lòng cuộn xuống cuối nội dung để xác nhận đã đọc")}
            </div>
          )}
        </div>
      </Dialog.Body>
      <Dialog.Footer>
        <div
          className="flex justify-end w-full"
          style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
        >
          <Button
            primary
            className="w-full sm:w-auto"
            text={t("Đồng ý")}
            disabled={!hasRead}
            isLoading={submitting}
            onClick={handleAccept}
          />
        </div>
      </Dialog.Footer>
    </Dialog>
  );
}
