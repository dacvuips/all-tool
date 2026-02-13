import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import { useTranslation } from "react-i18next";
import { Category, CategoryService } from "../../../../../lib/repo";
import { Slideout, SlideoutProps } from "../../../../shared/utilities/dialog/slideout";
import { Spinner } from "../../../../shared/utilities/misc";
import { TabGroup } from "../../../../shared/utilities/tab/tab-group";
import { CategoryOverviewTab } from "./category-overview";

interface Props extends SlideoutProps {
  id: string;
  onSubmit: () => any;
}
export function CategorySlideout({ id, ...props }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const [category, setCategory] = useState<Category>(null);

  useEffect(() => {
    if (id !== null) {
      if (id) {
        CategoryService.getOne({ id: id }).then((res) => {
          setCategory(res);
        });
      } else {
        setCategory({});
      }
    } else {
      setCategory(null);
    }
  }, [id]);

  const onClose = () => router.replace({ pathname: location.pathname, query: {} });

  return (
    <Slideout width="86vw" maxWidth="1400px" isOpen={!!category} onClose={onClose}>
      {!category ? (
        <Spinner />
      ) : (
        <TabGroup
          name="Category"
          flex={false}
          className="px-4 bg-gray-50"
          tabClassName="h-16 py-4 text-base px-4"
          bodyClassName="p-6 v-scrollbar"
          activeClassName="bg-white border-l border-r border-gray-300"
          bodyStyle={{
            height: "calc(100vh - 64px)",
          }}
        >
          <TabGroup.Tab label={t("Thông tin danh mục")}>
            <CategoryOverviewTab
              category={category}
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
