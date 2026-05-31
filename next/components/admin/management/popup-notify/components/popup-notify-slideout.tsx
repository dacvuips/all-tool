import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import { useTranslation } from "react-i18next";
import { PopupNotify, PopupNotifyService } from "../../../../../lib/repo/list/popup-notify.repo";
import { Slideout, SlideoutProps } from "../../../../shared/utilities/dialog/slideout";
import { Spinner } from "../../../../shared/utilities/misc";
import { TabGroup } from "../../../../shared/utilities/tab/tab-group";
import { PopupNotifyOverviewTab } from "./popup-notify-overview";

interface Props extends SlideoutProps {
  id: string;
  onSubmit: () => any;
}
export function PopupNotifySlideout({ id, ...props }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const [popupNotify, setPopupNotify] = useState<PopupNotify>(null);

  useEffect(() => {
    if (id !== null) {
      if (id) {
        PopupNotifyService.getOne({ id: id }).then((res) => {
          setPopupNotify(res);
        });
      } else {
        setPopupNotify({});
      }
    } else {
      setPopupNotify(null);
    }
  }, [id]);

  const onClose = () => router.replace({ pathname: location.pathname, query: {} });

  return (
    <Slideout width="86vw" maxWidth="800px" isOpen={!!popupNotify} onClose={onClose}>
      {!popupNotify ? (
        <Spinner />
      ) : (
        <TabGroup
          name="popup-notify-slideout"
          flex={false}
          className="px-4 bg-gray-50"
          tabClassName="h-16 py-4 text-base px-4"
          bodyClassName="p-6 v-scrollbar"
          activeClassName="bg-white border-l border-r border-gray-300"
          bodyStyle={{
            height: "calc(100vh - 64px)",
          }}
        >
          <TabGroup.Tab label={t("Thông tin thông báo")}>
            <PopupNotifyOverviewTab
              popupNotify={popupNotify}
              loadAll={() => {
                onClose();
                props.onSubmit();
              }}
            />
          </TabGroup.Tab>
        </TabGroup>
      )}
    </Slideout>
  );
}
