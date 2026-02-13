import { useTranslation } from "react-i18next";
import { RiToggleFill, RiToggleLine } from "react-icons/ri";
import { DataTable } from "../utilities/table/data-table";

export function ActiveCellButton({ item, service, disabled = false }) {
  const { t } = useTranslation();
  return (
    <>
      {item.actived ? (
        <DataTable.CellButton
          value={item}
          disabled={disabled}
          textPrimary
          icon={<RiToggleFill />}
          tooltip={t("Ngưng hoạt động")}
          onClick={async () => {
            await service.update({ id: item.id, data: { actived: false } });
          }}
          refreshAfterTask
        />
      ) : (
        <DataTable.CellButton
          value={item}
          disabled={disabled}
          icon={<RiToggleLine />}
          tooltip={t("Kích hoạt")}
          onClick={async () => {
            await service.update({
              id: item.id,
              data: { actived: true },
            });
          }}
          refreshAfterTask
        />
      )}
    </>
  );
}
