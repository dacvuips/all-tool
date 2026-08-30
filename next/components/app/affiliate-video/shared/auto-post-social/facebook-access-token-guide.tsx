/**
 * Hướng dẫn lấy Page Access Token — khớp giao diện Graph API Explorer (tiếng Việt).
 */
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { RiExternalLinkLine, RiKey2Line } from "react-icons/ri";

const URL = {
  graphExplorer: "https://developers.facebook.com/tools/explorer/",
  tokenDebugger: "https://developers.facebook.com/tools/debug/accesstoken/",
  developers: "https://developers.facebook.com/apps/",
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

function PermCode({ children }: { children: ReactNode }) {
  return <code className="px-1 rounded bg-amber-100">{children}</code>;
}

function UiLabel({ children }: { children: ReactNode }) {
  return <strong className="text-amber-950">{children}</strong>;
}

export function FacebookAccessTokenGuide() {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
      <div className="flex gap-2 items-start">
        <RiKey2Line className="mt-0.5 text-base text-amber-600 shrink-0" />
        <div className="min-w-0 space-y-4">
          <p className="text-sm font-semibold text-amber-950">
            {t("Hướng dẫn lấy Page Access Token")} — Facebook Fanpage
          </p>

          <GuideSection title={t("Bước 1 — Mở Graph API Explorer")}>
            <StepList
              items={[
                <>
                  {t("Truy cập")}{" "}
                  <ExternalLink href={URL.graphExplorer}>Graph API Explorer</ExternalLink>
                </>,
                <>
                  {t("Thanh bên phải →")} <UiLabel>{t("Ứng dụng trên Meta")}</UiLabel>
                  {t(": chọn app của bạn (vd. app đăng video Fanpage).")}
                  {t(" Chưa có app →")}{" "}
                  <ExternalLink href={URL.developers}>Meta for Developers</ExternalLink>
                  {t(" → tạo app + Use case Video / Quản lý Trang.")}
                </>,
              ]}
            />
          </GuideSection>

          <GuideSection title={t("Bước 2 — Thêm quyền (tab Quyền)")}>
            <StepList
              items={[
                <>
                  {t("Thanh bên phải, chọn tab")} <UiLabel>{t("Quyền")}</UiLabel>
                  {t("(Permissions).")}
                </>,
                <>
                  {t("Bấm")} <UiLabel>{t("Thêm quyền")}</UiLabel>
                  {t("→ tìm và thêm:")}
                  <ul className="pl-4 mt-1 space-y-0.5 list-disc">
                    <li>
                      <PermCode>pages_show_list</PermCode>
                    </li>
                    <li>
                      <PermCode>pages_read_engagement</PermCode>
                    </li>
                    <li>
                      <PermCode>pages_manage_posts</PermCode>
                    </li>
                    <li>
                      <PermCode>publish_video</PermCode>
                    </li>
                    <li>
                      <PermCode>pages_manage_engagement</PermCode>
                      {t(" (tuỳ chọn — comment link)")}
                    </li>
                  </ul>
                </>,
                <>
                  {t("Bấm nút xanh")} <UiLabel>Generate Access Token</UiLabel>
                  {t("→ đăng nhập Facebook → đồng ý quyền.")}
                </>,
              ]}
            />
          </GuideSection>

          <GuideSection title={t("Bước 3 — Lấy Page Access Token đúng Fanpage")}>
            <StepList
              items={[
                <>
                  <UiLabel>{t("Người dùng hoặc Trang")}</UiLabel>
                  {t("→ chọn")} <strong>{t("tên Fanpage")}</strong>
                  {t("(không để Mã người dùng).")}
                </>,
                <>
                  {t("Copy")} <UiLabel>{t("Mã truy cập")}</UiLabel>
                  {t("→ Credential → Lưu.")}
                </>,
              ]}
            />
            <p className="mt-1.5 text-xs text-red-800">
              {t("Không dán token khi còn chọn Mã người dùng — đó là User Token, không đăng được video.")}
            </p>
          </GuideSection>

          <GuideSection title={t("Bước 4 — Token dài hạn (~60 ngày / không hết hạn Page token)")}>
            <StepList
              items={[
                <>
                  {t("Sau Generate, mở")}{" "}
                  <ExternalLink href={URL.tokenDebugger}>{t("Access Token Debugger")}</ExternalLink>
                  {t("→ dán User Token →")} <UiLabel>{t("Extend Access Token")}</UiLabel>
                  {t("(kéo dài ~60 ngày).")}
                </>,
                <>
                  {t("Dán token dài hạn vào ô")} <UiLabel>{t("Mã truy cập")}</UiLabel>
                  {t("trên Explorer →")} <UiLabel>{t("Người dùng hoặc Trang")}</UiLabel>
                  {t("→ chọn lại Fanpage → copy")} <UiLabel>{t("Mã truy cập")}</UiLabel>
                  {t("mới → Lưu.")}
                </>,
              ]}
            />
            <p className="mt-1.5 text-xs text-amber-800">
              {t("Page token lấy từ user token dài hạn thường không hết hạn — dùng lâu dài, không cần lấy lại mỗi ngày.")}
            </p>
          </GuideSection>
        </div>
      </div>
    </div>
  );
}
