const config = require("config");

/** Config Analyzer */
const withBundleAnalyzer = require("@next/bundle-analyzer");
const { i18n } = require("next-i18next");
const bundleAnalyzer = withBundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Cross-Origin-Embedder-Policy",
    value: "same-origin",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin-allow-popups",
  },
];

/** Config Default Nextjs Setting */
const nextConfig = {
  swcMinify: true,
  reactStrictMode: false,
  publicRuntimeConfig: {
    version: process.env.npm_package_version,
    firebaseView: config.get("firebase.webConfig"),
    seo: {
      title: "StoreMMO - Leading MMO Trading Solution",
      siteName: "StoreMMO - Leading MMO Trading Solution",
    },
    upload: {
      uploadImageApiLink: config.get("upload.uploadImageApiLink"),
    },
  },
  async redirects() {
    return [
      {
        source: "/admin",
        destination: "/admin/management/users",
        permanent: true,
      },
      {
        source: "/",
        destination: "/app/affiliate-video",
        permanent: true,
      },
    ];
  },
  async headers() {
    // console.log('process.env.NODE_ENV', process.env.NODE_ENV)
    // console.log('custom headers');
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  i18n: {
    locales: ["vi", "en", "ja", "ko"],
    defaultLocale: "vi",
  },
  poweredByHeader: false,
  compiler: {
    removeConsole: process.env.NODE_ENV == "production" ? true : false,
  },
};

module.exports = (_phase, { defaultConfig }) => {
  const plugins = [bundleAnalyzer];
  return plugins.reduce((acc, plugin) => plugin(acc), { ...nextConfig });
};
