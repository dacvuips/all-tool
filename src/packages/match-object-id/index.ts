import moment from "moment-timezone";
import { Types } from "mongoose";

export function matchObjectId(fromDate: string, toDate: string) {
  const startHexString = Math.trunc(
    moment(fromDate, "YYYY-MM-DD").startOf("date").toDate().getTime() / 1000
  );
  const endHexString = Math.trunc(
    moment(toDate, "YYYY-MM-DD").endOf("date").toDate().getTime() / 1000
  );
  return {
    _id: {
      $gte: new Types.ObjectId(startHexString),
      $lte: new Types.ObjectId(endHexString),
    },
  };
}
