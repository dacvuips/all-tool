import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import { useTranslation } from "react-i18next";
import { Thread, ThreadService } from "../../../../../lib/repo/thread/thread.repo";
import { Slideout, SlideoutProps } from "../../../../shared/utilities/dialog/slideout";
import { Spinner } from "../../../../shared/utilities/misc";
import { TabGroup } from "../../../../shared/utilities/tab/tab-group";
import { ThreadOverviewTab } from "./thread-overview";

interface Props extends SlideoutProps {
  id: string;
  onSubmit: () => any;
  loadAll: (value: boolean) => any;
}
export function ThreadSlideout({ id, ...props }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const [thread, setThread] = useState<Thread>(null);

  useEffect(() => {
    if (id !== null) {
      if (id) {
        ThreadService.getOne({ id: id }).then((res) => {
          setThread(res);
        });
      } else {
        setThread({});
      }
    } else {
      setThread(null);
    }
  }, [id]);

  const onClose = () => router.replace({ pathname: location.pathname, query: {} });

  return (
    <Slideout width="86vw" maxWidth="600px" isOpen={!!thread} onClose={onClose}>
      {!thread ? (
        <Spinner />
      ) : (
        <TabGroup
          name="thread"
          flex={false}
          className="px-4 bg-gray-50"
          tabClassName="h-16 py-4 text-base px-4"
          bodyClassName="p-6 v-scrollbar"
          activeClassName="bg-white border-l border-r border-gray-300"
          bodyStyle={{
            height: "calc(100vh - 64px)",
          }}
        >
          <TabGroup.Tab label={t("Thông tin tán gẫu")}>
            <ThreadOverviewTab
              thread={thread}
              loadAll={() => {
                onClose();
                props.loadAll(true);
              }}
            />
          </TabGroup.Tab>
        </TabGroup>
      )}
    </Slideout>
  );
}
