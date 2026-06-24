/**
 * Phân trang danh sách scene khi số lượng quá lớn (>500).
 */
import { useTranslation } from "react-i18next";
import { RiArrowLeftSLine, RiArrowRightSLine } from "react-icons/ri";
import { Button } from "../../../shared/utilities/form";

export const BATCH_SCENE_PAGINATION_THRESHOLD = 500;
export const BATCH_SCENE_PAGE_SIZE = 100;

export interface BatchScenePaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

export function BatchScenePagination({
  currentPage,
  totalPages,
  pageSize,
  totalCount,
  onPageChange,
}: BatchScenePaginationProps) {
  const { t } = useTranslation();
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="flex flex-wrap gap-2 justify-between items-center px-3 py-2 bg-white border-b border-gray-200 shrink-0">
      <span className="text-xs text-gray-500">
        {t("Hiển thị")} <span className="font-semibold text-gray-700">{start}–{end}</span> /{" "}
        {totalCount} {t("cảnh")}
      </span>
      <div className="flex gap-1 items-center">
        <Button
          className="px-2 h-8"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          icon={<RiArrowLeftSLine />}
          tooltip={t("Trang trước")}
        />
        <span className="px-2 text-xs font-medium text-gray-600 tabular-nums">
          {t("Trang")} {currentPage} / {totalPages}
        </span>
        <Button
          className="px-2 h-8"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          icon={<RiArrowRightSLine />}
          tooltip={t("Trang sau")}
        />
      </div>
    </div>
  );
}
