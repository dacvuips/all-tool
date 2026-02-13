import { useRouter } from "next/router";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Spinner } from "../../components/shared/utilities/misc";
import { useOptionsTranslation } from "../hooks/useOptionsTranslate";
import { GraphService } from "../repo/graph.repo";
import { Locale } from "../repo/types";

export const LocaleContext = createContext<
  Partial<{
    currentLocale: Locale;
    changeLocale: (locale: Locale) => any;
    dateFNSLocale: any;
  }>
>({});

export function LocaleProvider(props) {
  const [currentLocale, setCurrentLocale] = useState<Locale>();
  const [hasLoaded, setHasLoaded] = useState(false);
  const LOCALE_STORAGE = "LOCALE";
  const router = useRouter();
  const { LOCALES } = useOptionsTranslation();

  useEffect(() => {
    const localeStorage = localStorage.getItem(LOCALE_STORAGE);
    const userLocale = Intl.DateTimeFormat().resolvedOptions().locale.split("-")[0].toLowerCase();

    if (localeStorage) {
      setCurrentLocale(LOCALES.find((x) => x.value == localeStorage)?.value || LOCALES[0].value);
    } else if (userLocale && LOCALES.find((x) => x.value == userLocale)) {
      setCurrentLocale(userLocale as Locale);
    } else {
      setCurrentLocale(LOCALES[0].value);
    }
  }, []);

  useEffect(() => {
    if (currentLocale) {
      if (router.locale !== currentLocale) {
        GraphService.clearStore().then(() => {
          localStorage.setItem(LOCALE_STORAGE, currentLocale);
          router.replace(router.asPath, null, { locale: currentLocale }).then(() => {
            setHasLoaded(true);
          });
        });
      } else {
        setHasLoaded(true);
      }
    }
  }, [currentLocale]);

  const changeLocale = (locale: Locale) => {
    if (LOCALES.find((x) => x.value == locale)) {
      setCurrentLocale(locale);
      router.reload();
    }
  };

  const dateFNSLocale = useMemo(() => {
    if (currentLocale) {
      switch (currentLocale) {
        case "vi": {
          return require("date-fns/locale/vi");
        }
        case "en": {
          return require("date-fns/locale/en-GB");
        }
      }
    } else {
      return null;
    }
  }, [currentLocale]);

  return (
    <LocaleContext.Provider value={{ dateFNSLocale, currentLocale, changeLocale }}>
      {hasLoaded ? props.children : <Spinner />}
    </LocaleContext.Provider>
  );
}

export const useLocale = () => useContext(LocaleContext);
