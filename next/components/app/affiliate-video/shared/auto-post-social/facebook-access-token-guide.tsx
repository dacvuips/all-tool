/**
 * Hướng dẫn lấy Page Access Token + Page ID cho Facebook Fanpage.
 */
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { RiExternalLinkLine, RiKey2Line } from "react-icons/ri";

const URL = {
  developers: "https://developers.facebook.com/",
  graphExplorer: "https://developers.facebook.com/tools/explorer/",
  permissionsDoc:
    "https://developers.facebook.com/docs/pages-api/posts/#publish-a-video",
  pageTokenDoc:
    "https://developers.facebook.com/docs/pages-api/overview#access-tokens",
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

function GuideSection({ title, children }: { title: string; children: ReactNode }) {
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

export function FacebookAccessTokenGuide() {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
      <div className="flex gap-2 items-start">
        <RiKey2Line className="mt-0.5 text-base text-amber-600 shrink-0" />
        <div className="min-w-0 space-y-4">
          <div>
            <p className="text-sm font-semibold text-amber-950">
              {t("Hướng dẫn lấy AccessToken")} — Facebook Fanpage
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-800">
              {t(
                "Cần Page Access Token (long-lived) và Page ID của Fanpage. Dán vào tab Credential để đăng video tự động."
              )}
            </p>
          </div>

          <GuideSection title={t("Bước 1 — Tạo App trên Meta for Developers")}>
            <StepList
              items={[
                <>
                  {t("Truy cập")}{" "}
                  <ExternalLink href={URL.developers}>Meta for Developers</ExternalLink>{" "}
                  {t("→ Tạo App (loại Business hoặc Other).")}
                </>,
                <>
                  {t("Thêm sản phẩm")} <strong>Facebook Login</strong> {t("và")}{" "}
                  <strong>Pages API</strong>.
                </>,
                <>
                  {t("Trong App → App Review / Permissions, bật các quyền:")}{" "}
                  <code className="px-1 rounded bg-amber-100">pages_manage_posts</code>,{" "}
                  <code className="px-1 rounded bg-amber-100">pages_read_engagement</code>,{" "}
                  <code className="px-1 rounded bg-amber-100">pages_show_list</code>.
                </>,
              ]}
            />
          </GuideSection>

          <GuideSection title={t("Bước 2 — Lấy User Access Token")}>
            <StepList
              items={[
                <>
                  {t("Mở")}{" "}
                  <ExternalLink href={URL.graphExplorer}>Graph API Explorer</ExternalLink>,{" "}
                  {t("chọn App vừa tạo.")}
                </>,
                <>
                  {t("Nhấn")} <strong>Generate Access Token</strong>{" "}
                  {t("và cấp quyền quản lý Fanpage.")}
                </>,
                <>
                  {t("Đổi sang long-lived token (60 ngày) qua endpoint")}{" "}
                  <code className="px-1 rounded bg-amber-100">oauth/access_token</code>{" "}
                  {t("nếu cần.")}
                </>,
              ]}
            />
          </GuideSection>

          <GuideSection title={t("Bước 3 — Lấy Page Access Token & Page ID")}>
            <StepList
              items={[
                <>
                  {t("Gọi API:")}{" "}
                  <code className="px-1 rounded bg-amber-100 break-all">
                    GET /me/accounts?access_token=USER_TOKEN
                  </code>
                </>,
                <>
                  {t("Trong kết quả, tìm Fanpage cần đăng → copy")}{" "}
                  <strong>access_token</strong> {t("(Page token) và")} <strong>id</strong>{" "}
                  {t("(Page ID).")}
                </>,
                <>
                  {t("Xem thêm:")}{" "}
                  <ExternalLink href={URL.pageTokenDoc}>
                    {t("Page Access Tokens")}
                  </ExternalLink>
                  .
                </>,
              ]}
            />
          </GuideSection>

          <GuideSection title={t("Bước 4 — Lưu Credential")}>
            <StepList
              items={[
                <>
                  {t("Quay lại tab Credential → nhập")} <strong>Page Access Token</strong>{" "}
                  {t("và")} <strong>Page ID</strong>.
                </>,
                <>
                  {t("Hệ thống lưu dạng JSON:")}{" "}
                  <code className="px-1 rounded bg-amber-100 break-all">
                    {`{ "access_token": "...", "page_id": "..." }`}
                  </code>
                </>,
                <>
                  {t("Bật đăng Facebook trong cài đặt, sau đó chạy auto-post như YouTube.")}
                </>,
              ]}
            />
            <p className="pt-1 text-xs text-amber-800">
              {t("Tham khảo đăng video Fanpage:")}{" "}
              <ExternalLink href={URL.permissionsDoc}>Pages API — Video</ExternalLink>
            </p>
          </GuideSection>
        </div>
      </div>
    </div>
  );
}
