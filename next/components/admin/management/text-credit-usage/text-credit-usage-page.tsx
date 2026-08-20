import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MicroxVoiceAccount,
  TextCreditUsage,
  TextCreditUsageService,
} from "../../../../lib/repo/text-credit-usage/text-credit-usage.repo";
import { Card } from "../../../shared/utilities/misc";
import { DataTable } from "../../../shared/utilities/table/data-table";

const TOOL_LABEL: Record<string, string> = {
  tts: "TTS",
  conversion: "Chuyển giọng",
  clone: "Clone",
  stt: "Chép lời",
  cleanup: "Lọc tạp âm",
};

export function TextCreditUsagePage() {
  const { t } = useTranslation();
  const [account, setAccount] = useState<MicroxVoiceAccount | null>(null);

  useEffect(() => {
    TextCreditUsageService.getMicroxVoiceAccount()
      .then(setAccount)
      .catch(() => setAccount(null));
  }, []);

  const microxCredits =
    account?.credits == null || Number.isNaN(Number(account.credits))
      ? "—"
      : Number(account.credits).toLocaleString("vi-VN");

  return (
    <Card>
      <div className="flex flex-wrap gap-3 items-center mb-4 text-sm">
        <div className="px-3 py-2 rounded-lg border border-rose-200 bg-rose-50">
          <span className="text-gray-600">{t("Credit text MicroX")}: </span>
          <strong className="text-rose-700">{microxCredits}</strong>
          {account?.email ? (
            <span className="ml-2 text-xs text-gray-500">{account.email}</span>
          ) : null}
        </div>
      </div>

      <DataTable<TextCreditUsage> crudService={TextCreditUsageService} order={{ createdAt: -1 }}>
        <DataTable.Header>
          <DataTable.Title />
          <DataTable.Buttons>
            <DataTable.Button outline isRefreshButton refreshAfterTask />
          </DataTable.Buttons>
        </DataTable.Header>

        <DataTable.Divider />

        <DataTable.Toolbar>
          <DataTable.Search style={{ width: "300px" }} />
        </DataTable.Toolbar>

        <DataTable.Table className="mt-4" disableDbClick={true}>
          <DataTable.Column
            className="w-40"
            label={t("Thời gian")}
            render={(item: TextCreditUsage) => (
              <DataTable.CellDate value={item.createdAt} format="HH:mm dd/MM/yyyy" />
            )}
          />
          <DataTable.Column
            label={t("Khách hàng")}
            render={(item: TextCreditUsage) => (
              <DataTable.CellText value={item.customerCode || item.customerId} />
            )}
          />
          <DataTable.Column
            label={t("Tool")}
            render={(item: TextCreditUsage) => (
              <DataTable.CellText value={t(TOOL_LABEL[item.tool || ""] || item.tool || "—")} />
            )}
          />
          <DataTable.Column
            label={t("Text credit")}
            render={(item: TextCreditUsage) => <DataTable.CellNumber value={item.amount} />}
          />
          <DataTable.Column
            label={t("Credit MicroX job")}
            render={(item: TextCreditUsage) => <DataTable.CellNumber value={item.microxAmount} />}
          />
          <DataTable.Column
            label={t("Sau khi trừ")}
            render={(item: TextCreditUsage) => (
              <DataTable.CellText
                value={`${item.textCreditCountAfter ?? "—"} / ${
                  item.textCreditLimit === -1 ? "∞" : item.textCreditLimit ?? "—"
                }`}
              />
            )}
          />
          <DataTable.Column
            label={t("Job")}
            render={(item: TextCreditUsage) => (
              <DataTable.CellText className="max-w-xs truncate" value={item.jobId} />
            )}
          />
        </DataTable.Table>
        <DataTable.Pagination />
      </DataTable>
    </Card>
  );
}
