import { appWithTranslation } from "next-i18next";
import { DefaultSeo, NextSeo } from "next-seo";
import config from "next/config";
import { Fragment } from "react";
import { AlertProvider } from "../lib/providers/alert-provider";
import { AuthProvider } from "../lib/providers/auth-provider";
import { CartProvider } from "../lib/providers/cart-provider";
import { LocaleProvider } from "../lib/providers/locale-provider";
import { ToastProvider } from "../lib/providers/toast-provider";
import { TooltipProvider } from "../lib/providers/tooltip-provider";
import nextI18nextConfig from "../next-i18next.config";
import "../style/style.scss";

function App({ Component, pageProps }) {
  const Layout = Component.Layout ? Component.Layout : Fragment;
  const layoutProps = Component.LayoutProps ? Component.LayoutProps : {};
  const {
    publicRuntimeConfig: {
      seo: { title, siteName, logo },
    },
  } = config();
  return (
    <>
      <DefaultSeo
        titleTemplate="%s"
        defaultTitle={title}
        openGraph={{
          type: "website",
          locale: "vi_VN",
          site_name: siteName,
          images: logo ? [{ url: logo }] : undefined,
        }}
      />
      {pageProps.seo && <NextSeo {...pageProps.seo} />}
      <LocaleProvider>
        <TooltipProvider>
          <ToastProvider>
            <AlertProvider>
              <AuthProvider>
                <CartProvider>
                    <Layout {...layoutProps}>
                      <Component {...pageProps} />
                    </Layout>
                </CartProvider>
              </AuthProvider>
            </AlertProvider>
          </ToastProvider>
        </TooltipProvider>
      </LocaleProvider>
    </>
  );
}
export default appWithTranslation(App, nextI18nextConfig);
