// const i18nextHttpBackend = require('i18next-http-backend/cjs')

module.exports = {
  // lấy dữ liều từ server
  backend: {
    // loadPath: "http://localhost:5555/api/translate/locales/{{lng}}/{{ns}}",
    // loadPath: '/locales/{{lng}}/{{ns}}.json',
  },
  i18n: {
    locales: ["vi", "en", "ja", "ko"],
    defaultLocale: "vi",
  },
  ns: ["common"],
  reloadOnPrerender: true,
  partialBundledLanguages: true,
  // use:[i18nextHttpBackend],  
  localeDetection: false,
  returnEmptyString: false,
  debug: false,
  serializeConfig: false,
  serialize: false,
  keySeparator: false,
  nsSeparator: false,
  pluralSeparator: false,
  contextSeparator: false,
  nsMode: "default",
  
};