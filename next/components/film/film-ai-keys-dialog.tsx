import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiLoader4Line } from "react-icons/ri";
import { useToast } from "../../lib/providers/toast-provider";
import { Dialog } from "../shared/utilities/dialog/dialog";
import {
  EMPTY_FILM_AI_KEYS_STATUS,
  FILM_DEFAULT_GATEWAY_MODEL,
  fetchFilmAiKeysStatus,
  saveFilmAiKeysToServer,
  syncFilmLegacyGatewayAfterServerSave,
  type FilmAiKeysStatus,
} from "./film-ai-keys";

const fieldBtnClass =
  "inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (status: FilmAiKeysStatus) => void;
};

function SavedBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2 h-5 text-10 font-semibold text-green-800 bg-green-100 rounded-full">
      {label}
    </span>
  );
}

export default function FilmAiKeysDialog({ isOpen, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const toast = useToast();

  const [status, setStatus] = useState<FilmAiKeysStatus>(EMPTY_FILM_AI_KEYS_STATUS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [gatewayEndpoint, setGatewayEndpoint] = useState("");
  const [gatewayApiKey, setGatewayApiKey] = useState("");
  const [gatewayModel, setGatewayModel] = useState("");
  const [openaiKeyVisible, setOpenaiKeyVisible] = useState(false);
  const [geminiKeyVisible, setGeminiKeyVisible] = useState(false);
  const [gatewayKeyVisible, setGatewayKeyVisible] = useState(false);
  const [checkingOpenaiKey, setCheckingOpenaiKey] = useState(false);
  const [checkingGeminiKey, setCheckingGeminiKey] = useState(false);

  const resetDrafts = (next?: FilmAiKeysStatus) => {
    const s = next || status;
    setOpenaiKey("");
    setGeminiKey("");
    setGatewayApiKey("");
    setGatewayEndpoint(s.hasGateway ? s.gatewayEndpoint : "");
    setGatewayModel(s.hasGateway ? s.gatewayModel : "");
    setOpenaiKeyVisible(false);
    setGeminiKeyVisible(false);
    setGatewayKeyVisible(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    fetchFilmAiKeysStatus()
      .then((next) => {
        if (cancelled) return;
        setStatus(next);
        resetDrafts(next);
      })
      .catch((err: any) => {
        if (cancelled) return;
        toast.error(err?.message || t("Không tải được trạng thái API Key"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSave = async () => {
    const ep = gatewayEndpoint.trim();
    const gwKey = gatewayApiKey.trim();
    const gwModel = gatewayModel.trim();
    const oai = openaiKey.trim();
    const gem = geminiKey.trim();
    const hadGatewayMeta =
      status.hasGateway || Boolean(status.gatewayEndpoint) || Boolean(status.gatewayModel);
    const wantsClearGateway = !ep && !gwKey && !gwModel && hadGatewayMeta;
    const gwChanged =
      wantsClearGateway ||
      Boolean(gwKey) ||
      ep !== (status.gatewayEndpoint || "") ||
      gwModel !== (status.gatewayModel || "");
    const gwReady =
      wantsClearGateway ||
      (status.hasGateway
        ? Boolean((ep || status.gatewayEndpoint) && (gwKey || status.hasGateway))
        : Boolean(ep && gwKey && gwModel));
    if (gwChanged && !wantsClearGateway && !gwReady) {
      toast.warn(
        t("Gateway cần đủ Endpoint, API Key và Model (hoặc để trống cả ba để xóa Gateway).")
      );
      return;
    }
    if (!oai && !gem && !gwChanged) {
      toast.warn(t("Nhập key mới để lưu. Key đã lưu trên server không hiện lại."));
      return;
    }
    setSaving(true);
    try {
      const next = await saveFilmAiKeysToServer({
        openaiKey: oai || undefined,
        geminiKey: gem || undefined,
        clearGateway: wantsClearGateway,
        gatewayEndpoint: wantsClearGateway ? undefined : gwChanged ? ep || undefined : undefined,
        gatewayApiKey: wantsClearGateway ? undefined : gwChanged ? gwKey || undefined : undefined,
        gatewayModel: wantsClearGateway ? undefined : gwChanged ? gwModel || undefined : undefined,
      });
      syncFilmLegacyGatewayAfterServerSave(gwChanged);
      setStatus(next);
      resetDrafts(next);
      toast.success(
        wantsClearGateway ? t("Đã xóa Gateway.") : t("Đã lưu API Keys trên server.")
      );
      onSaved?.(next);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || t("Lưu API Key thất bại"));
    } finally {
      setSaving(false);
    }
  };

  const handleCheckOpenaiKey = async () => {
    const key = openaiKey.trim();
    if (!key) {
      toast.warn(t("Nhập OpenAI Key mới để kiểm tra (key đã lưu không hiện lại)."));
      return;
    }
    setCheckingOpenaiKey(true);
    try {
      const resp = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: { Authorization: `Bearer ${key}` },
      });
      if (resp.ok) {
        toast.success(t("✅ OpenAI Key hợp lệ!"));
        return;
      }
      const body = await resp.text().catch(() => "");
      toast.error(
        t("❌ OpenAI Key không hợp lệ ({{status}}): {{detail}}", {
          status: resp.status,
          detail: body.slice(0, 160) || resp.statusText,
        })
      );
    } catch (err: any) {
      if (/^sk-/i.test(key)) {
        toast.warn(t("Không kiểm tra trực tiếp từ trình duyệt (CORS). Key dạng sk-… có thể lưu."));
      } else {
        toast.error(err?.message || t("Không kiểm tra được OpenAI Key"));
      }
    } finally {
      setCheckingOpenaiKey(false);
    }
  };

  const handleCheckGeminiKey = async () => {
    const key = geminiKey.trim();
    if (!key) {
      toast.warn(t("Nhập Gemini Key mới để kiểm tra (key đã lưu không hiện lại)."));
      return;
    }
    setCheckingGeminiKey(true);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
        key
      )}&pageSize=1`;
      const resp = await fetch(url, { method: "GET" });
      if (resp.ok) {
        toast.success(t("✅ Gemini Key hợp lệ!"));
        return;
      }
      const body = await resp.text().catch(() => "");
      toast.error(
        t("❌ Gemini Key không hợp lệ ({{status}}): {{detail}}", {
          status: resp.status,
          detail: body.slice(0, 160) || resp.statusText,
        })
      );
    } catch (err: any) {
      if (/^(AIza|AQ\.)/i.test(key)) {
        toast.warn(t("Không kiểm tra trực tiếp từ trình duyệt. Key dạng Gemini có thể lưu."));
      } else {
        toast.error(err?.message || t("Không kiểm tra được Gemini Key"));
      }
    } finally {
      setCheckingGeminiKey(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={() => {
        resetDrafts();
        onClose();
      }}
      title={t("API Keys")}
      width="480px"
      maxWidth="95vw"
    >
      <Dialog.Body>
        <div className="pt-1 space-y-4">
          <p className="m-0 text-xs text-gray-500">
            {t(
              "Key lưu trên server (bảng credentials, mã hóa). Hệ thống không hiện lại key đã lưu. Chỉ nhập khi thêm mới hoặc thay thế. Ưu tiên Gateway → OpenAI → Gemini."
            )}
          </p>

          {loading ? (
            <div className="flex justify-center items-center py-8 text-gray-500">
              <RiLoader4Line className="mr-2 animate-spin" />
              {t("Đang tải trạng thái…")}
            </div>
          ) : (
            <>
          <div className="px-3 py-3 space-y-3 rounded-xl border border-teal-200 bg-teal-50/40">
            <div className="flex gap-2 items-center">
              <span className="block text-sm font-semibold text-gray-800">
                {t("Gateway (Endpoint + API Key)")}
              </span>
              {status.hasGateway ? <SavedBadge label={t("Đã lưu trên server")} /> : null}
            </div>
            <span className="mt-0.5 block text-xs text-gray-500">
              {t(
                "VD endpoint: https://flow2.viettheo.site — API key dạng f2api_… Gọi /api/v1/chatgpt/chat."
              )}
            </span>
            <div>
              <label
                className="m-0 mb-1.5 block text-xs font-semibold text-gray-700"
                htmlFor="film-gateway-endpoint"
              >
                {t("Endpoint")}
              </label>
              <input
                id="film-gateway-endpoint"
                type="url"
                value={gatewayEndpoint}
                onChange={(e) => setGatewayEndpoint(e.target.value)}
                placeholder="https://flow2.viettheo.site"
                autoComplete="off"
                spellCheck={false}
                className="px-3 w-full h-10 text-sm text-gray-800 bg-white rounded-lg border border-gray-300 outline-none focus:border-teal-400"
              />
            </div>
            <div>
              <label
                className="m-0 mb-1.5 block text-xs font-semibold text-gray-700"
                htmlFor="film-gateway-api-key"
              >
                {t("API Key")}
              </label>
              <div className="flex gap-1.5 items-center">
                <input
                  id="film-gateway-api-key"
                  type={gatewayKeyVisible ? "text" : "password"}
                  value={gatewayApiKey}
                  onChange={(e) => setGatewayApiKey(e.target.value)}
                  placeholder={
                    status.hasGateway
                      ? (t("Đã lưu — nhập key mới để thay") as string)
                      : "f2api_..."
                  }
                  autoComplete="off"
                  spellCheck={false}
                  className="flex-1 px-3 min-w-0 h-10 text-sm text-gray-800 bg-white rounded-lg border border-gray-300 outline-none focus:border-teal-400"
                />
                <button
                  type="button"
                  onClick={() => setGatewayKeyVisible((v) => !v)}
                  className={fieldBtnClass}
                >
                  {gatewayKeyVisible ? t("Ẩn") : t("Hiện")}
                </button>
              </div>
            </div>
            <div>
              <label
                className="m-0 mb-1.5 block text-xs font-semibold text-gray-700"
                htmlFor="film-gateway-model"
              >
                {t("Model")}
              </label>
              <input
                id="film-gateway-model"
                type="text"
                value={gatewayModel}
                onChange={(e) => setGatewayModel(e.target.value)}
                placeholder={FILM_DEFAULT_GATEWAY_MODEL}
                autoComplete="off"
                spellCheck={false}
                className="px-3 w-full h-10 text-sm text-gray-800 bg-white rounded-lg border border-gray-300 outline-none focus:border-teal-400"
              />
            </div>
          </div>

          <div>
            <div className="flex gap-2 items-center mb-1.5">
              <label
                className="m-0 text-sm font-semibold text-gray-800"
                htmlFor="film-openai-key"
              >
                {t("OpenAI Key")}
              </label>
              {status.hasOpenaiKey ? <SavedBadge label={t("Đã lưu trên server")} /> : null}
            </div>
            <div className="flex gap-1.5 items-center">
              <input
                id="film-openai-key"
                type={openaiKeyVisible ? "text" : "password"}
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder={
                  status.hasOpenaiKey
                    ? (t("Đã lưu — nhập key mới để thay") as string)
                    : "sk-..."
                }
                autoComplete="off"
                spellCheck={false}
                className="flex-1 px-3 min-w-0 h-10 text-sm text-gray-800 bg-white rounded-lg border border-gray-300 outline-none focus:border-teal-400"
              />
              <button
                type="button"
                onClick={() => setOpenaiKeyVisible((v) => !v)}
                className={fieldBtnClass}
              >
                {openaiKeyVisible ? t("Ẩn") : t("Hiện")}
              </button>
              <button
                type="button"
                disabled={checkingOpenaiKey}
                onClick={() => void handleCheckOpenaiKey()}
                className={`text-teal-700 ${fieldBtnClass}`}
              >
                {checkingOpenaiKey ? <RiLoader4Line className="animate-spin" /> : t("Check")}
              </button>
            </div>
          </div>

          <div>
            <div className="flex gap-2 items-center mb-1.5">
              <label
                className="m-0 text-sm font-semibold text-gray-800"
                htmlFor="film-gemini-key"
              >
                {t("Gemini Key")}
              </label>
              {status.hasGeminiKey ? <SavedBadge label={t("Đã lưu trên server")} /> : null}
            </div>
            <div className="flex gap-1.5 items-center">
              <input
                id="film-gemini-key"
                type={geminiKeyVisible ? "text" : "password"}
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder={
                  status.hasGeminiKey
                    ? (t("Đã lưu — nhập key mới để thay") as string)
                    : "AIza… / AQ…"
                }
                autoComplete="off"
                spellCheck={false}
                className="flex-1 px-3 min-w-0 h-10 text-sm text-gray-800 bg-white rounded-lg border border-gray-300 outline-none focus:border-teal-400"
              />
              <button
                type="button"
                onClick={() => setGeminiKeyVisible((v) => !v)}
                className={fieldBtnClass}
              >
                {geminiKeyVisible ? t("Ẩn") : t("Hiện")}
              </button>
              <button
                type="button"
                disabled={checkingGeminiKey}
                onClick={() => void handleCheckGeminiKey()}
                className={`text-teal-700 ${fieldBtnClass}`}
              >
                {checkingGeminiKey ? <RiLoader4Line className="animate-spin" /> : t("Check")}
              </button>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={() => {
                resetDrafts();
                onClose();
              }}
              className="inline-flex justify-center items-center px-4 h-9 text-sm font-semibold text-gray-700 bg-white rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              {t("Hủy")}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="inline-flex justify-center items-center px-4 h-9 text-sm font-semibold text-white rounded-lg bg-success hover:bg-success-dark disabled:opacity-50"
            >
              {saving ? <RiLoader4Line className="animate-spin" /> : t("Lưu")}
            </button>
          </div>
            </>
          )}
        </div>
      </Dialog.Body>
    </Dialog>
  );
}
