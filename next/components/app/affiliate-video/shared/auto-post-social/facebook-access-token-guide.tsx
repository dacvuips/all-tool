/**
 * Hướng dẫn cấu hình Facebook Fanpage — khớp giao diện Meta for Developers mới (Use cases).
 */
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { RiExternalLinkLine, RiKey2Line } from "react-icons/ri";

const URL = {
  developers: "https://developers.facebook.com/apps/",
  graphExplorer: "https://developers.facebook.com/tools/explorer/",
  videoApiDoc: "https://developers.facebook.com/docs/video-api/guides/publishing/",
  pagesVideoDoc: "https://developers.facebook.com/docs/pages-api/posts/#publish-a-video",
  pageTokenDoc: "https://developers.facebook.com/docs/pages-api/overview#access-tokens",
  loginDoc: "https://developers.facebook.com/docs/facebook-login/",
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
                "Cách nhanh nhất: tab Credential → bấm Kết nối Facebook → đăng nhập → chọn Fanpage. Phần dưới dành cho admin cấu hình App Meta trước khi dùng nút kết nối."
              )}
            </p>
          </div>

          <GuideSection title={t("Bước 1 — Tạo App trên Meta for Developers (giao diện mới)")}>
            <StepList
              items={[
                <>
                  {t("Truy cập")}{" "}
                  <ExternalLink href={URL.developers}>Meta for Developers</ExternalLink>{" "}
                  {t("→ Ứng dụng của tôi → Tạo ứng dụng (Business hoặc Other).")}
                </>,
                <>
                  {t(
                    "Vào Bảng điều khiển (Dashboard) → mục Tùy chỉnh ứng dụng và các yêu cầu / Trường hợp sử dụng (Use cases)."
                  )}
                </>,
                <>
                  {t("Thêm và hoàn tất các trường hợp sử dụng liên quan:")}
                  <ul className="pl-4 mt-1 space-y-1 list-disc">
                    <li>
                      <strong>{t("Truy cập API Video trực tiếp")}</strong>
                      {t(" — đăng video lên Fanpage (như trong ảnh Bảng điều khiển).")}
                    </li>
                    <li>
                      <strong>{t("Đăng nhập bằng Facebook")}</strong> (
                      <ExternalLink href={URL.loginDoc}>Facebook Login</ExternalLink>
                      {t(") — bắt buộc nếu dùng nút Kết nối Facebook trong app.")}
                    </li>
                    <li>
                      <strong>{t("Quản lý Trang / Pages")}</strong>
                      {t(" — liệt kê Fanpage và lấy Page Access Token.")}
                    </li>
                  </ul>
                </>,
                <>
                  {t(
                    "Lưu ý: Meta đã đổi giao diện — không còn mục Thêm sản phẩm Facebook Login / Pages API như trước. Thay vào đó chọn Trường hợp sử dụng tương ứng trong Bảng điều khiển."
                  )}
                </>,
              ]}
            />
          </GuideSection>

          <GuideSection title={t("Bước 2 — Quyền (Permissions) cần bật")}>
            <StepList
              items={[
                <>
                  {t("Trong từng trường hợp sử dụng → Permissions / Quyền, bật:")}{" "}
                  <PermCode>pages_show_list</PermCode>, <PermCode>pages_manage_posts</PermCode>,{" "}
                  <PermCode>pages_read_engagement</PermCode>,{" "}
                  <PermCode>pages_manage_engagement</PermCode>.
                </>,
                <>
                  {t(
                    "Nếu App ở chế độ Development: thêm tài khoản Facebook và Fanpage vào vai trò Tester trong"
                  )}{" "}
                  <strong>{t("Vai trò trong ứng dụng")}</strong>.
                </>,
                <>
                  {t("Khi đưa lên Production: hoàn tất")}{" "}
                  <strong>{t("Xét duyệt ứng dụng (App Review)")}</strong>{" "}
                  {t("cho các quyền trên.")}
                </>,
              ]}
            />
          </GuideSection>

          <GuideSection title={t("Bước 3 — Cấu hình OAuth (cho nút Kết nối Facebook)")}>
            <StepList
              items={[
                <>
                  {t("Trong App →")} <strong>{t("Đăng nhập bằng Facebook")}</strong>{" "}
                  {t("→ Cài đặt → Valid OAuth Redirect URIs, thêm:")}
                  <pre className="px-2 py-1.5 mt-1 text-10 font-mono text-amber-950 break-all bg-white rounded border border-amber-200">
                    {"{DOMAIN}/api/app/facebook-oauth/callback"}
                  </pre>
                  <span className="block mt-1 text-amber-800">
                    {t("Thay {DOMAIN} bằng domain server (ví dụ https://your-domain.com).")}
                  </span>
                </>,
                <>
                  {t("Đặt biến môi trường server:")}{" "}
                  <PermCode>FACEBOOK_APP_ID</PermCode>, <PermCode>FACEBOOK_APP_SECRET</PermCode>,{" "}
                  <PermCode>DOMAIN</PermCode> {t("rồi khởi động lại server.")}
                </>,
              ]}
            />
          </GuideSection>

          <GuideSection title={t("Bước 4 — Kết nối Fanpage trong app")}>
            <StepList
              items={[
                <>
                  {t("Quay lại tab Credential → bấm")} <strong>{t("Kết nối Facebook")}</strong>{" "}
                  {t("→ đăng nhập Meta → chọn Fanpage cần đăng video.")}
                </>,
                <>
                  {t("Hoặc thủ công: dùng")}{" "}
                  <ExternalLink href={URL.graphExplorer}>Graph API Explorer</ExternalLink>{" "}
                  {t("lấy Page Access Token (GET /me/accounts) rồi dán vào ô token.")}
                </>,
                <>{t("Không cần nhập Page ID — hệ thống tự lấy từ token khi đăng video.")}</>,
              ]}
            />
            <p className="pt-1 text-xs text-amber-800">
              {t("Tham khảo:")}{" "}
              <ExternalLink href={URL.videoApiDoc}>{t("Video API — Publishing")}</ExternalLink>
              {" · "}
              <ExternalLink href={URL.pagesVideoDoc}>{t("Pages API — Video")}</ExternalLink>
              {" · "}
              <ExternalLink href={URL.pageTokenDoc}>{t("Page Access Tokens")}</ExternalLink>
            </p>
          </GuideSection>
        </div>
      </div>
    </div>
  );
}
