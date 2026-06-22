import { useTranslation } from "react-i18next";
import { MdFileDownload, MdFileDownloadOff } from "react-icons/md";
import { Button } from "../../../shared/utilities/form";
import { getAutoDownloadDefault } from "./autoDownloadUtils";

export function SceneAutoDownloadButton({
  disabled,
  noDownload,
  onToggle,
}: {
  disabled?: boolean;
  noDownload?: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const enabled = noDownload ?? getAutoDownloadDefault();

  return (
    <Button
      disabled={disabled}
      onClick={onToggle}
      className={`w-6 h-6 px-2 rounded-md shadow-sm ${
        enabled
          ? "text-green-500 bg-green-50 hover:bg-green-100"
          : "text-gray-400 bg-white hover:text-green-500 hover:bg-green-50"
      }`}
      iconClassName="text-sm"
      icon={enabled ? <MdFileDownload /> : <MdFileDownloadOff />}
      tooltip={
        enabled
          ? t("Cho phép tải sau khi tạo ảnh/video xong")
          : t("Không cho phép tải sau khi tạo ảnh/video xong")
      }
      placement="bottom"
    />
  );
}
