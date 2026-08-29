/**
 * Hướng dẫn lấy Client ID, Client secret, Access token, Refresh token cho YouTube OAuth.
 */
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { RiExternalLinkLine, RiKey2Line } from "react-icons/ri";

const URL = {
  cloudConsole: "https://console.cloud.google.com/",
  youtubeApiLibrary: "https://console.cloud.google.com/apis/library/youtube.googleapis.com",
  credentials: "https://console.cloud.google.com/apis/credentials",
  oauthConsent: "https://console.cloud.google.com/apis/credentials/consent",
  oauthPlayground: "https://developers.google.com/oauthplayground/",
  youtubeUploadScope: "https://www.googleapis.com/auth/youtube.upload",
  youtubeForceSslScope: "https://www.googleapis.com/auth/youtube.force-ssl",
  googleOAuthDoc: "https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps",
} as const;

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-0.5 font-semibold text-indigo-700 underline underline-offset-2 hover:text-indigo-900"
    >
      {children}
      <RiExternalLinkLine className="text-xs shrink-0" aria-hidden />
    </a>
  );
}

function GuideSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-bold text-amber-950">{title}</h4>
      <div className="space-y-1.5 text-xs leading-relaxed text-amber-900">{children}</div>
    </section>
  );
}

function StepList({ items }: { items: ReactNode[] }) {
  return (
    <ol className="pl-4 space-y-1.5 list-decimal">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ol>
  );
}

export function YoutubeAccessTokenGuide() {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
      <div className="flex gap-2 items-start">
        <RiKey2Line className="mt-0.5 text-base text-amber-600 shrink-0" />
        <div className="min-w-0 space-y-4">
          <div>
            <p className="text-sm font-semibold text-amber-950">
              {t("Hướng dẫn lấy AccessToken")} — Youtube
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-800">
              {t(
                "Cần 4 thông tin: Client ID, Client secret, Access token, Refresh token. Dán vào tab Credential để hệ thống tự làm mới token khi hết hạn."
              )}
            </p>
          </div>

          <GuideSection title={t("Bước 1 — Tạo project & bật YouTube Data API v3")}>
            <StepList
              items={[
                <>
                  {t("Đăng nhập")}{" "}
                  <ExternalLink href={URL.cloudConsole}>Google Cloud Console</ExternalLink>.
                </>,
                <>
                  {t("Tạo project mới (hoặc chọn project có sẵn) → menu")}{" "}
                  <strong>APIs & Services → Library</strong>.
                </>,
                <>
                  {t("Tìm và bật")}{" "}
                  <ExternalLink href={URL.youtubeApiLibrary}>YouTube Data API v3</ExternalLink>{" "}
                  {t("(nút Enable).")}
                </>,
              ]}
            />
          </GuideSection>

          <GuideSection title={t("Bước 2 — Cấu hình OAuth consent screen")}>
            <StepList
              items={[
                <>
                  {t("Vào")}{" "}
                  <ExternalLink href={URL.oauthConsent}>OAuth consent screen</ExternalLink>{" "}
                  {t("(APIs & Services → OAuth consent screen).")}
                </>,
                <>
                  {t("Chọn User Type")} <strong>External</strong>{" "}
                  {t("(hoặc Internal nếu dùng Google Workspace cùng tổ chức).")}
                </>,
                <>
                  {t("Điền App name, email hỗ trợ → Save. Ở mục Scopes thêm scope upload:")}{" "}
                  <code className="px-1 py-0.5 text-10 bg-white rounded border border-amber-200 break-all">
                    {URL.youtubeUploadScope}
                  </code>
                </>,
                <>
                  {t("Nếu app ở chế độ Testing: thêm email Google/YouTube của bạn vào")}{" "}
                  <strong>Test users</strong> {t("để được phép đăng nhập OAuth.")}
                </>,
              ]}
            />
          </GuideSection>

          <GuideSection title={t("Bước 3 — Lấy Client ID & Client secret")}>
            <StepList
              items={[
                <>
                  {t("Vào")}{" "}
                  <ExternalLink href={URL.credentials}>Credentials</ExternalLink>{" "}
                  {t("→ Create Credentials → OAuth client ID.")}
                </>,
                <>
                  {t("Application type chọn")} <strong>Desktop app</strong>{" "}
                  {t("(đơn giản nhất) hoặc Web application nếu bạn có redirect URI riêng.")}
                </>,
                <>
                  {t("Đặt tên (vd: All-tool YouTube Upload) → Create.")}
                </>,
                <>
                  {t("Copy")} <strong>Client ID</strong> {t("và")}{" "}
                  <strong>Client secret</strong>{" "}
                  {t("(giữ bí mật, không chia sẻ công khai).")}
                </>,
              ]}
            />
          </GuideSection>

          <GuideSection
            title={t("Bước 4 — Lấy Access token & Refresh token (OAuth 2.0 Playground)")}
          >
            <p className="text-xs text-amber-800">
              {t("Cách nhanh nhất dùng Playground của Google — không cần viết code:")}
            </p>
            <StepList
              items={[
                <>
                  {t("Mở")}{" "}
                  <ExternalLink href={URL.oauthPlayground}>OAuth 2.0 Playground</ExternalLink>.
                </>,
                <>
                  {t("Góc phải biểu tượng bánh răng ⚙ → tick")}{" "}
                  <strong>Use your own OAuth credentials</strong>{" "}
                  {t("→ dán Client ID và Client secret vừa tạo → Close.")}
                </>,
                <>
                  {t("Bước 1 — Select & authorize APIs: tìm")}{" "}
                  <strong>YouTube Data API v3</strong> {t("và chọn scope:")}{" "}
                  <code className="px-1 py-0.5 text-10 bg-white rounded border border-amber-200 break-all">
                    {URL.youtubeUploadScope}
                  </code>
                  {t(" (có thể thêm")}{" "}
                  <code className="px-1 py-0.5 text-10 bg-white rounded border border-amber-200 break-all">
                    {URL.youtubeForceSslScope}
                  </code>
                  {t(").")}
                </>,
                <>
                  {t("Nhấn")} <strong>Authorize APIs</strong>{" "}
                  {t("→ đăng nhập tài khoản Google/YouTube cần đăng video → Allow.")}
                </>,
                <>
                  {t("Bước 2 — Exchange authorization code for tokens → nhấn")}{" "}
                  <strong>Exchange authorization code for tokens</strong>.
                </>,
                <>
                  {t("Copy")} <strong>Access token</strong> {t("và")}{" "}
                  <strong>Refresh token</strong>{" "}
                  {t("(refresh_token chỉ hiện lần đầu khi cấp quyền; nếu không thấy, đăng xuất Google và Authorize lại với prompt consent).")}
                </>,
              ]}
            />
            <p className="text-xs text-amber-800">
              {t("Tham khảo thêm")}:{" "}
              <ExternalLink href={URL.googleOAuthDoc}>
                {t("Google — OAuth cho ứng dụng web")}
              </ExternalLink>
              .
            </p>
          </GuideSection>

          <GuideSection title={t("Bước 5 — Lưu vào tab Credential")}>
            <StepList
              items={[
                <>
                  {t("Quay lại tab")} <strong>Credential</strong> {t("trong dialog này.")}
                </>,
                <>
                  {t("Nhấn")} <strong>{t("Nhập Credential")}</strong>{" "}
                  {t("hoặc Sửa nếu đã có.")}
                </>,
                <>
                  {t("Dán lần lượt: Access token (bắt buộc), Refresh token, Client ID, Client secret.")}
                </>,
                <>
                  {t("Lưu → trạng thái")} <strong>{t("Đã kết nối")}</strong>{" "}
                  {t("→ bật")} <strong>{t("Bật đăng lên Youtube")}</strong>{" "}
                  {t("để dùng pipeline tự động đăng.")}
                </>,
              ]}
            />
          </GuideSection>

          <div className="px-3 py-2 text-xs leading-relaxed text-amber-900 bg-white rounded-lg border border-amber-200">
            <strong>{t("Lưu ý")}:</strong>{" "}
            {t(
              "Access token hết hạn sau ~1 giờ. Có Refresh token + Client ID/secret thì hệ thống tự refresh. Không có refresh_token thì phải lấy access_token mới thủ công."
            )}
          </div>

          <div className="px-3 py-2 text-xs leading-relaxed text-amber-900 bg-white rounded-lg border border-amber-200">
            <strong>{t("Link trên video")}:</strong>{" "}
            {t(
              "Cột Link trong metadata sẽ được gắn vào mô tả và đăng thêm comment trên video sau khi upload. Cần scope youtube.force-ssl. YouTube không cho phép gắn card/end screen qua API chính thức — phải thêm thủ công trong YouTube Studio nếu cần."
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
