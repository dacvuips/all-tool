import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import { useTranslation } from "react-i18next";
import { Bank, BankService } from "../../../../../lib/repo/list/bank.repo";
import { Slideout, SlideoutProps } from "../../../../shared/utilities/dialog/slideout";
import { Spinner } from "../../../../shared/utilities/misc";
import { TabGroup } from "../../../../shared/utilities/tab/tab-group";
import { BankOverviewTab } from "./bank-overview";

interface Props extends SlideoutProps {
  id: string;
  onSubmit: () => any;
}
export function BankSlideout({ id, ...props }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const [bank, setBank] = useState<Bank>(null);

  useEffect(() => {
    if (id !== null) {
      if (id) {
        BankService.getOne({ id: id }).then((res) => {
          setBank(res);
        });
      } else {
        setBank({});
      }
    } else {
      setBank(null);
    }
  }, [id]);

  const onClose = () => router.replace({ pathname: location.pathname, query: {} });

  return (
    <Slideout width="86vw" maxWidth="800px" isOpen={!!bank} onClose={onClose}>
      {!bank ? (
        <Spinner />
      ) : (
        <TabGroup
          name="bank"
          flex={false}
          className="px-4 bg-gray-50"
          tabClassName="h-16 py-4 text-base px-4"
          bodyClassName="p-6 v-scrollbar"
          activeClassName="bg-white border-l border-r border-gray-300"
          bodyStyle={{
            height: "calc(100vh - 64px)",
          }}
        >
          <TabGroup.Tab label={t("Thông tin ngân hàng")}>
            <BankOverviewTab
              bank={bank}
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
