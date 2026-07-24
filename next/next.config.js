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
  // Không set Cross-Origin-Embedder-Policy: @ffmpeg/core single-thread không cần
  // SharedArrayBuffer; COEP same-origin chặn Worker/chunk → ChunkLoadError khi nối video.
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin-allow-popups",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
];

/** Config Default Nextjs Setting */
const nextConfig = {
  swcMinify: true,
  reactStrictMode: false,
  // @ffmpeg/* là ESM — cần transpile khi Next bundle
  transpilePackages: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  publicRuntimeConfig: {
    version: process.env.npm_package_version,
    firebaseView: config.get("firebase.webConfig"),
    seo: {
      title: "Viet Theo Veo 3 - Free Tool Generate Video AI - Image AI ",
      siteName: "Viet Theo Veo 3 - Free Tool Generate Video AI - Image AI ",
      description:
        "Affiliate Video Generator - Free Tool Generate Video AI - Image AI - Film Maker AI",
      logo: "/assets/img/logo-full-1.png",
      keywords: "Affiliate Video Generator, Free Tool Generate Video AI, Image AI, Film Maker AI",
      url: "https://viettheo.site",
      image: "/assets/img/logo-full-1.png",
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
