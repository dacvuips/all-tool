import _ from "lodash";
import moment from "moment-timezone";

export default function getDateRangeComparison(
  fromDate?: string,
  toDate?: string,
  timeUnit: string = "day"
) {
  let $gte: Date = undefined,
    $lte: Date = undefined;

  if (fromDate) {
    $gte = moment(fromDate, "YYYY-MM-DD")
      .startOf(timeUnit as any)
      .toDate();
  }

  if (toDate) {
    $lte = moment(toDate, "YYYY-MM-DD")
      .endOf(timeUnit as any)
      .toDate();
  }
  return _.pickBy(
    {
      $gte,
      $lte,
    },
    _.identity
  );
}
