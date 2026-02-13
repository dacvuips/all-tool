import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import { useTranslation } from "react-i18next";
import {
  WalletTransaction,
  WalletTransactionService,
} from "../../../../../lib/repo/wallet/wallet-transaction.repo";
import { Slideout, SlideoutProps } from "../../../../shared/utilities/dialog/slideout";
import { Spinner } from "../../../../shared/utilities/misc";
import { TabGroup } from "../../../../shared/utilities/tab/tab-group";
import { WalletTransactionOverviewTab } from "./wallet-transaction-overview";

interface Props extends SlideoutProps {
  id: string;
  onSubmit: () => any;
}
export function WalletTransactionSlideout({ id, ...props }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const [walletTransaction, setWalletTransaction] = useState<WalletTransaction>(null);

  useEffect(() => {
    if (id !== null) {
      if (id) {
        WalletTransactionService.getOne({ id: id }).then((res) => {
          setWalletTransaction(res);
        });
      } else {
        setWalletTransaction({});
      }
    } else {
      setWalletTransaction(null);
    }
  }, [id]);

  const onClose = () => router.replace({ pathname: location.pathname, query: {} });

  return (
    <Slideout width="86vw" maxWidth="800px" isOpen={!!walletTransaction} onClose={onClose}>
      {!walletTransaction ? (
        <Spinner />
      ) : (
        <TabGroup
          name="walletTransaction"
          flex={false}
          className="px-4 bg-gray-50"
          tabClassName="h-16 py-4 text-base px-4"
          bodyClassName="p-6 v-scrollbar"
          activeClassName="bg-white border-l border-r border-gray-300"
          bodyStyle={{
            height: "calc(100vh - 64px)",
          }}
        >
          <TabGroup.Tab label={t("Thông tin giao dịch mPoint")}>
            <WalletTransactionOverviewTab
              walletTransaction={walletTransaction}
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
