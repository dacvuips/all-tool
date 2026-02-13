import { useRouter } from "next/router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { RiFilter3Line } from "react-icons/ri";

export const ProductFilter = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const query = router.query;

  const badgeCount = useMemo(() => {
    return Object.entries(query).reduce((acc, [key, _]) => {
      if (query[key] !== "") {
        return acc + 1;
      }

      return acc;
    }, 0);
  }, [query]);

  return (
    <div
      data-tooltip={t("Trạng thái lọc")}
      data-placement="bottom"
      className="relative flex items-center h-8 pr-2 border-r text-24"
    >
      {badgeCount ? (
        <div className="absolute flex items-center justify-center w-4 h-4 text-white rounded-full right-1 text-12 bg-primary -top-1">
          {badgeCount}
        </div>
      ) : (
        ""
      )}
      <RiFilter3Line />
    </div>
  );
};
