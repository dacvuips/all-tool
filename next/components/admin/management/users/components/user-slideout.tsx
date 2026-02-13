import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { User, UserService } from "../../../../../lib/repo/";
import { Slideout, SlideoutProps } from "../../../../shared/utilities/dialog/slideout";
import { Spinner } from "../../../../shared/utilities/misc";
import { TabGroup } from "../../../../shared/utilities/tab/tab-group";

import { AccountDecentralization } from "./account-decentralization";
import { AccountOverview } from "./account-overview";
import { AccountWalletTransaction } from "./account-wallet-transaction";

interface Props extends SlideoutProps {
  userId: string;
  onSubmit: () => any;
  loadAll: (value: boolean) => any;
}
export function UserSlideout({ userId, loadAll, ...props }: Props) {
  const { t } = useTranslation();

  const router = useRouter();
  const [user, setUser] = useState<User>(null);
  const toast = useToast();

  useEffect(() => {
    if (userId) {
      fetchUser(userId);
    }
  }, [userId]);
  const fetchUser = async (id) => {
    setUser(null);
    await UserService.getOne({ id: id, toast })
      .then((res) => {
        setUser(res);
      })
      .catch((err) => {
        console.log(err);
        onClose();
      });
  };
  const onClose = () => router.replace({ pathname: location.pathname, query: {} });

  return (
    <Slideout
      width="86vw"
      maxWidth="1200px"
      isOpen={!!userId}
      onClose={() => {
        loadAll(true);
        onClose();
      }}
    >
      {!user ? (
        <Spinner />
      ) : (
        <TabGroup
          name="user"
          flex={false}
          className="px-4 bg-gray-50"
          tabClassName="h-16 py-4 text-base px-4"
          bodyClassName="p-6 v-scrollbar"
          activeClassName="bg-white border-l border-r border-gray-300"
          bodyStyle={{
            height: "calc(100vh - 64px)",
          }}
        >
          <TabGroup.Tab label={t("Thông tin tài khoản")}>
            <AccountOverview
              user={user}
              loadAll={loadAll}
              setUser={(user) => {
                setUser(user);
                props.onSubmit();
              }}
            />
          </TabGroup.Tab>
          <TabGroup.Tab label={t("Phân quyền tài khoản")}>
            <AccountDecentralization
              userDecentrali={user}
              setUser={(user) => {
                setUser(user);
                props.onSubmit();
              }}
            />
          </TabGroup.Tab>
          <TabGroup.Tab label={t("Lịch sử mPoint")}>
            <AccountWalletTransaction
              user={user}
              setUser={(user) => {
                setUser(user);
                props.onSubmit();
              }}
            />
          </TabGroup.Tab>
        </TabGroup>
      )}
    </Slideout>
  );
}
