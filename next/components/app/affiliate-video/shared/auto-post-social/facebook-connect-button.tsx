/**
 * Nút Kết nối Facebook + chọn Fanpage sau OAuth.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RiCheckLine,
  RiCloseLine,
  RiFacebookCircleFill,
  RiLoader4Line,
} from "react-icons/ri";
import { Button } from "../../../../shared/utilities/form";
import { Dialog } from "../../../../shared/utilities/dialog/dialog";
import {
  connectFacebookPage,
  FACEBOOK_OAUTH_MESSAGE_TYPE,
  fetchFacebookOAuthPages,
  isFacebookOAuthMessage,
  startFacebookOAuth,
  type FacebookOAuthPage,
} from "../../../../../lib/repo/facebook/facebook-oauth.repo";
import { useToast } from "../../../../../lib/providers/toast-provider";

export function FacebookConnectButton({
  disabled,
  onConnected,
}: {
  disabled?: boolean;
  onConnected?: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [connecting, setConnecting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pages, setPages] = useState<FacebookOAuthPage[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [savingPageId, setSavingPageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<number | null>(null);

  const cleanupPopup = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    popupRef.current = null;
  }, []);

  useEffect(() => {
    return () => cleanupPopup();
  }, [cleanupPopup]);

  const openPagePicker = useCallback(
    async (connectSessionId: string) => {
      setSessionId(connectSessionId);
      setPickerOpen(true);
      setLoadingPages(true);
      setError(null);
      try {
        const list = await fetchFacebookOAuthPages(connectSessionId);
        setPages(list);
        if (list.length === 0) {
          setError(t("Không tìm thấy Fanpage nào"));
        }
      } catch (err: any) {
        setError(err?.message || t("Không thể tải danh sách Fanpage"));
      } finally {
        setLoadingPages(false);
      }
    },
    [t]
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!isFacebookOAuthMessage(event.data)) return;
      if (event.data.type !== FACEBOOK_OAUTH_MESSAGE_TYPE) return;

      cleanupPopup();
      setConnecting(false);

      if (event.data.status === "success" && event.data.connectSessionId) {
        void openPagePicker(event.data.connectSessionId);
        return;
      }

      setError(event.data.message || t("Kết nối Facebook thất bại"));
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [cleanupPopup, openPagePicker, t]);

  const handleConnect = async () => {
    if (connecting || disabled) return;
    setConnecting(true);
    setError(null);
    try {
      const { authUrl } = await startFacebookOAuth();
      const popup = window.open(
        authUrl,
        "facebook-oauth",
        "width=560,height=720,menubar=no,toolbar=no,location=yes,status=no"
      );
      if (!popup) {
        throw new Error(t("Trình duyệt chặn popup — hãy cho phép popup và thử lại"));
      }
      popupRef.current = popup;
      pollRef.current = window.setInterval(() => {
        if (popup.closed) {
          cleanupPopup();
          setConnecting(false);
        }
      }, 500);
    } catch (err: any) {
      setConnecting(false);
      setError(err?.message || t("Không thể bắt đầu kết nối Facebook"));
    }
  };

  const handleSelectPage = async (page: FacebookOAuthPage) => {
    if (!sessionId || savingPageId) return;
    setSavingPageId(page.id);
    setError(null);
    try {
      await connectFacebookPage(sessionId, page.id);
      setPickerOpen(false);
      setSessionId(null);
      setPages([]);
      toast.success(t("Đã kết nối Fanpage «{{name}}»", { name: page.name }));
      await onConnected?.();
    } catch (err: any) {
      setError(err?.message || t("Không thể lưu Fanpage"));
    } finally {
      setSavingPageId(null);
    }
  };

  return (
    <>
      <div className="space-y-2">
        <Button
          outline
          className="w-full"
          icon={<RiFacebookCircleFill className="text-blue-600" />}
          text={connecting ? t("Đang kết nối…") : t("Kết nối Facebook")}
          isLoading={connecting}
          disabled={disabled || connecting}
          onClick={() => void handleConnect()}
        />
        {error && !pickerOpen ? (
          <p className="text-xs text-red-600 leading-relaxed">{error}</p>
        ) : null}
              <p className="text-xs leading-relaxed text-gray-500">
                {t(
                  "Đăng nhập Facebook, chọn Fanpage — hệ thống tự lưu Page Access Token. Không cần Graph API Explorer."
                )}
              </p>
      </div>

      <Dialog
        isOpen={pickerOpen}
        onClose={() => {
          if (savingPageId) return;
          setPickerOpen(false);
        }}
        width={480}
        slideFromBottom="none"
        title={t("Chọn Fanpage")}
        icon={<RiFacebookCircleFill className="text-lg text-blue-600" />}
        hasCloseIcon
      >
        <Dialog.Body>
          <div className="px-1 pb-2 space-y-3">
            <p className="text-sm text-gray-600">
              {t("Chọn Fanpage để đăng video tự động:")}
            </p>

            {loadingPages ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
                <RiLoader4Line className="animate-spin" />
                {t("Đang tải Fanpage…")}
              </div>
            ) : null}

            {!loadingPages && pages.length > 0 ? (
              <div className="space-y-2 max-h-[360px] overflow-y-auto v-scrollbar">
                {pages.map((page) => {
                  const saving = savingPageId === page.id;
                  return (
                    <button
                      key={page.id}
                      type="button"
                      disabled={!!savingPageId}
                      onClick={() => void handleSelectPage(page)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50 transition-colors text-left disabled:opacity-60"
                    >
                      {page.pictureUrl ? (
                        <img
                          src={page.pictureUrl}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <span className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-600 shrink-0">
                          <RiFacebookCircleFill />
                        </span>
                      )}
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-gray-800 truncate">
                          {page.name}
                        </span>
                        <span className="block text-xs text-gray-400 truncate">ID: {page.id}</span>
                      </span>
                      {saving ? (
                        <RiLoader4Line className="animate-spin text-blue-600 shrink-0" />
                      ) : (
                        <RiCheckLine className="text-blue-600 shrink-0 opacity-0 group-hover:opacity-100" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {!loadingPages && pages.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">
                {error || t("Không có Fanpage nào")}
              </p>
            ) : null}

            {error && pickerOpen ? (
              <p className="text-xs text-red-600">{error}</p>
            ) : null}
          </div>
        </Dialog.Body>
      </Dialog>
    </>
  );
}
