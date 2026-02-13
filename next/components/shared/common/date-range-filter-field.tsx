import { useEffect, useState } from "react";

import { useTranslation } from "react-i18next";
import { DatePicker, Field } from "../utilities/form";
import { useDataTable } from "../utilities/table/data-table";

type DateRangeFilterFieldProps = ReactProps & {
  name: string;
};
export function DateRangeFilterField({ name }: DateRangeFilterFieldProps) {
  const { t } = useTranslation();
  const [timeRange, setTimeRange] = useState<any>(null);
  const { onFilterChange } = useDataTable();
  useEffect(() => {
    const filter = timeRange
      ? { [name]: { $gte: timeRange.startDate, $lte: timeRange.endDate } }
      : { [name]: undefined };
    onFilterChange({ ...filter });
  }, [timeRange]);
  return (
    <Field noError>
      <DatePicker
        className="w-60"
        placeholder={t("Lọc theo ngày")}
        placement="bottom-end"
        selectsRange
        monthsShown={2}
        value={timeRange}
        onChange={setTimeRange}
      />
    </Field>
  );
}
