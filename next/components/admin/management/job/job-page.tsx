import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiCloseCircleLine, RiRefreshLine, RiRestartLine, RiShareBoxFill } from "react-icons/ri";
import {
  MediaGenerationJob,
  MediaGenerationJobService,
  MediaGenerationJobStatus,
} from "../../../../lib/repo/media-generation-job/media-generation-job.repo";
import { useToast } from "../../../../lib/providers/toast-provider";
import { Field, Select } from "../../../shared/utilities/form";
import { Card } from "../../../shared/utilities/misc";
import { DataTable } from "../../../shared/utilities/table/data-table";

const AUTO_REFRESH_MS = 10_000;
const RUNNING_STATUSES = new Set<MediaGenerationJobStatus>(["QUEUED", "PROCESSING"]);

const STATUS_OPTIONS = [
  { value: "QUEUED", label: "QUEUED", color: "slate" },
  { value: "PROCESSING", label: "PROCESSING", color: "info" },
  { value: "SUCCEEDED", label: "SUCCEEDED", color: "success" },
  { value: "FAILED", label: "FAILED", color: "danger" },
  { value: "CANCELLED", label: "CANCELLED", color: "warning" },
];

function getProgressBarColor(status: MediaGenerationJobStatus) {
  if (status === "SUCCEEDED") return "bg-green-500";
  if (status === "FAILED" || status === "CANCELLED") return "bg-red-500";
  return "bg-primary";
}

export function JobPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<MediaGenerationJobStatus>(null);
  const [wakingQueue, setWakingQueue] = useState(false);

  const filter = useMemo(
    () => ({
      ...(statusFilter ? { status: statusFilter } : {}),
    }),
    [statusFilter]
  );

  const onWakeQueue = async () => {
    setWakingQueue(true);
    try {
      const result = await MediaGenerationJobService.wakeQueue();
      const parts = [
        result.consumerRestarted ? t("đã restart consumer") : null,
        result.orphanedRequeued > 0
          ? t("re-enqueue {{count}} job QUEUED", { count: result.orphanedRequeued })
          : null,
        result.staleRequeued > 0
          ? t("khôi phục {{count}} job PROCESSING", { count: result.staleRequeued })
          : null,
      ].filter(Boolean);
      toast.success(
        parts.length > 0
          ? `${t("Đã đánh thức queue")}: ${parts.join(", ")}`
          : t("Đã đánh thức queue — không có job cần khôi phục")
      );
    } catch (error: any) {
      toast.error(error?.message || t("Đánh thức queue thất bại"));
    } finally {
      setWakingQueue(false);
    }
  };

  return (
    <Card>
      <DataTable<MediaGenerationJob>
        crudService={MediaGenerationJobService}
        order={{ createdAt: -1 }}
        filter={filter}
        limit={20}
        autoRefresh={AUTO_REFRESH_MS}
      >
        <DataTable.Header>
          <DataTable.Title />
          <DataTable.Buttons>
            <DataTable.Button
              outline
              text={t("Đánh thức queue")}
              icon={<RiRestartLine />}
              disabled={wakingQueue}
              onClick={onWakeQueue}
            />
            <DataTable.Button outline isRefreshButton refreshAfterTask />
          </DataTable.Buttons>
        </DataTable.Header>

        <DataTable.Divider />

        <DataTable.Toolbar>
          <DataTable.Search style={{ width: "280px" }} placeholder={t("Tìm theo jobId, customerId...")} />
          <DataTable.Filter>
            <Field noError>
              <Select
                className="w-48"
                value={statusFilter}
                onChange={setStatusFilter}
                clearable
                placeholder={t("Lọc trạng thái")}
                options={STATUS_OPTIONS}
              />
            </Field>
          </DataTable.Filter>
        </DataTable.Toolbar>

        <DataTable.Table className="mt-4" disableDbClick>
          <DataTable.Column
            className="min-w-[12rem]"
            label={t("Job")}
            render={(item: MediaGenerationJob) => (
              <div className="flex flex-col gap-0.5">
                <DataTable.CellText className="font-mono text-xs" value={item.id} />
                <DataTable.CellDate
                  className="whitespace-nowrap text-xs text-gray-500"
                  value={item.createdAt}
                  format="HH:mm dd/MM/yyyy"
                />
              </div>
            )}
          />
          <DataTable.Column
            label={t("Customer")}
            render={(item: MediaGenerationJob) =>
              item.customerId ? (
                <div className="flex items-center gap-1">
                  <Link
                    href={`/admin/management/customers?id=${item.customerId}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {item.customer?.email || item.customerId}
                  </Link>
                  <DataTable.CellButton
                    value={item}
                    icon={<RiShareBoxFill />}
                    tooltip={t("Đến khách hàng")}
                    onClick={() =>
                      router.push({
                        pathname: "/admin/management/customers",
                        query: { id: item.customerId },
                      })
                    }
                  />
                </div>
              ) : (
                <DataTable.CellText className="text-xs" value="-" />
              )
            }
          />
          <DataTable.Column
            label={t("Loại")}
            render={(item: MediaGenerationJob) => (
              <DataTable.CellText className="text-xs" value={item.type} />
            )}
          />
          <DataTable.Column
            center
            label={t("Tiến độ")}
            orderBy="progress"
            render={(item: MediaGenerationJob) => {
              const progress =
                item.status === "SUCCEEDED"
                  ? 100
                  : item.status === "FAILED" || item.status === "CANCELLED"
                    ? 100
                    : item.progress ?? 0;
              return (
                <div className="flex min-w-[5rem] flex-col items-center gap-1">
                  <span className="text-sm font-semibold">{progress}%</span>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={`h-full rounded-full transition-all ${getProgressBarColor(item.status)}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              );
            }}
          />
          <DataTable.Column
            label={t("Thông báo")}
            render={(item: MediaGenerationJob) => (
              <DataTable.CellText className="min-w-[10rem] max-w-xs text-xs" value={item.message} />
            )}
          />
          <DataTable.Column
            label={t("Lỗi")}
            render={(item: MediaGenerationJob) => (
              <DataTable.CellText
                className="min-w-[10rem] max-w-xs text-xs text-red-600"
                value={item.errorMessage}
              />
            )}
          />
          <DataTable.Column
            center
            label={t("Trạng thái")}
            render={(item: MediaGenerationJob) => (
              <DataTable.CellStatus options={STATUS_OPTIONS} value={item.status} />
            )}
          />
          <DataTable.Column
            right
            render={(item: MediaGenerationJob) => (
              <>
                {RUNNING_STATUSES.has(item.status) && (
                  <DataTable.CellButton
                    value={item}
                    icon={<RiCloseCircleLine />}
                    tooltip={t("Huỷ job")}
                    hoverDanger
                    onClick={async () => {
                      await MediaGenerationJobService.cancelJob(item.id);
                      toast.success(t("Đã gửi yêu cầu huỷ job"));
                    }}
                    refreshAfterTask
                  />
                )}
                {item.status === "FAILED" && (
                  <DataTable.CellButton
                    value={item}
                    icon={<RiRefreshLine />}
                    tooltip={t("Retry job")}
                    onClick={async () => {
                      await MediaGenerationJobService.retryJob(item.id);
                      toast.success(t("Đã retry job"));
                    }}
                    refreshAfterTask
                  />
                )}
              </>
            )}
          />
        </DataTable.Table>
        <DataTable.Pagination />
      </DataTable>
    </Card>
  );
}
