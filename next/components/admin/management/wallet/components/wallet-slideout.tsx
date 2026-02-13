import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import { useTranslation } from "react-i18next";
import { Wallet, WalletService } from "../../../../../lib/repo/wallet/wallet.repo";
import { Slideout, SlideoutProps } from "../../../../shared/utilities/dialog/slideout";
import { Spinner } from "../../../../shared/utilities/misc";
import { TabGroup } from "../../../../shared/utilities/tab/tab-group";
import { WalletOverviewTab } from "./wallet-overview";

interface Props extends SlideoutProps {
  id: string;
  onSubmit: () => any;
}
export function WalletSlideout({ id, ...props }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const [wallet, setWallet] = useState<Wallet>(null);

  useEffect(() => {
    if (id !== null) {
      if (id) {
        WalletService.getOne({ id: id }).then((res) => {
          setWallet(res);
        });
      } else {
        setWallet({});
      }
    } else {
      setWallet(null);
    }
  }, [id]);

  const onClose = () => router.replace({ pathname: location.pathname, query: {} });

  return (
    <Slideout width="86vw" maxWidth="800px" isOpen={!!wallet} onClose={onClose}>
      {!wallet ? (
        <Spinner />
      ) : (
        <TabGroup
          name="wallet"
          flex={false}
          className="px-4 bg-gray-50"
          tabClassName="h-16 py-4 text-base px-4"
          bodyClassName="p-6 v-scrollbar"
          activeClassName="bg-white border-l border-r border-gray-300"
          bodyStyle={{
            height: "calc(100vh - 64px)",
          }}
        >
          <TabGroup.Tab label={t("Nạp mPoint")}>
            <WalletOverviewTab
              wallet={wallet}
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
