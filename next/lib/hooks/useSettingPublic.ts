import { useEffect, useMemo, useState } from "react";
import { Setting, SettingService } from "../repo";

export function useSettingPublic(key: string) {
  const [settingNotPrivate, setSettingNotPrivate] = useState<Setting[]>([]);
  useEffect(() => {
    SettingService.getSettingNotPrivate()
      .then((res) => {
        setSettingNotPrivate(res);
      })
      .catch((err) => {
        console.log(err);
      });
  }, []);

  const openPageDeactiveDialog = useMemo(() => {
    return settingNotPrivate.find((item) => item.key == key);
  }, [settingNotPrivate]);
  return openPageDeactiveDialog;
}
