import { serverSideTranslations } from "next-i18next/serverSideTranslations";

import nextI18nextConfig from "../../next-i18next.config.js";

async function getI18nProps(locale, ns, query = null) {
  return {
    ...(await serverSideTranslations(locale, ns, {
      ...nextI18nextConfig,
      // locales: ["vi", "en"],
      // defaultLocale: "vi",
      // localeDetection: false,
      // returnEmptyString: false,
      // debug: true,
      // serializeConfig: false,
      // parseMissingKeyHandler: (key, defaultValue) => {
      //   console.log("parseMissingKeyHandler", key, defaultValue);
      // },
    } as any)),
  };
}
export function getServerSideTranslationsProps(ns: string[] = ["common"]) {
  return async function ({ locale, query }) {
    const initProps = await getI18nProps(locale, ns, query);
    return {
      props: initProps,
    };
  };
}

export async function getTranslationProps(locale: string, ns: string[] = ["common"]) {
  return await getI18nProps(locale, ns);
}
