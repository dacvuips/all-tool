import { useTranslation } from "react-i18next";
import { IoHourglassOutline } from "react-icons/io5";
import { NotFound } from "./not-found";

export function WIP() {
  const { t } = useTranslation();
  return <NotFound icon={<IoHourglassOutline />} text={t("Tính năng đang được hoàn thiện.")} />;
}
