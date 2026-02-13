import { Subject } from "rxjs";

import { ActivityModel } from "../libs/dal/activity";

export const onActivity = new Subject<{ username: string; message: string }>();

onActivity.subscribe((event) => {
  ActivityModel.create(event);
});
