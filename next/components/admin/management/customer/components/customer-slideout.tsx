import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import { useTranslation } from "react-i18next";
import { Customer, CustomerService } from "../../../../../lib/repo/customer/customer.repo";
import { Slideout, SlideoutProps } from "../../../../shared/utilities/dialog/slideout";
import { Spinner } from "../../../../shared/utilities/misc";
import { TabGroup } from "../../../../shared/utilities/tab/tab-group";
import { CustomerOverviewTab } from "./customer-overview";

interface Props extends SlideoutProps {
  id: string;
  loadAll: (value: boolean) => any;
}
export function CustomerSlideout({ id, ...props }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer>(null);

  useEffect(() => {
    if (id !== null) {
      if (id) {
        CustomerService.getOne({ id: id }).then((res) => {
          setCustomer(res);
        });
      } else {
        setCustomer({});
      }
    } else {
      setCustomer(null);
    }
  }, [id]);

  const onClose = () => router.replace({ pathname: location.pathname, query: {} });

  return (
    <Slideout width="86vw" maxWidth="900px" isOpen={!!customer} onClose={onClose}>
      {!customer ? (
        <Spinner />
      ) : (
        <TabGroup
          name="customer"
          flex={false}
          className="px-4 bg-gray-50"
          tabClassName="h-16 py-4 text-base px-4"
          bodyClassName="p-6 v-scrollbar"
          activeClassName="bg-white border-l border-r border-gray-300"
          bodyStyle={{
            height: "calc(100vh - 64px)",
          }}
        >
          <TabGroup.Tab label={t("Thông tin khách hàng")}>
            <CustomerOverviewTab
              customer={customer}
              setCustomer={setCustomer}
              loadAll={() => {
                onClose();
                props.loadAll(true);
              }}
              refreshList={() => props.loadAll(true)}
            />
          </TabGroup.Tab>
        </TabGroup>
      )}
    </Slideout>
  );
}
