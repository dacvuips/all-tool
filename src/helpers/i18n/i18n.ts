import I18n from "i18next";

import logger from "../logger";

const i18n = I18n.createInstance(
  {
    fallbackLng: "vi",
    ns: ["common", "server"],
    defaultNS: "server",
    fallbackNS: "common",
    initImmediate: true,
    load: "all",
    debug: false,
    backend: {
      hi: 1,
    },
    returnEmptyString: false,
  },
  (err, t) => {
    if (err) {
      logger.error("init i18n error", err);
    }
    i18n.reloadResources(["vi", "en", "ja", "ko"], null, () => {});
  }
);

// i18n.use(backend);

export default i18n;
