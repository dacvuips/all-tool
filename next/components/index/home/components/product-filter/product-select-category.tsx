import { mapValues } from "lodash";
import { useRouter } from "next/router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaChevronDown, FaTimes } from "react-icons/fa";
import { ParamName } from "../../../../../lib/constants/constants";
import { useScreen } from "../../../../../lib/hooks/useScreen";
import { Img } from "../../../../shared/utilities/misc";
import { Popover } from "../../../../shared/utilities/popover/popover";
import { useHomeContext } from "../../provider/home-provider";

export const ProductSelectCategory = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const lg = useScreen("lg");
  const categoryRef = useRef();
  const [visible, setVisible] = useState(undefined);
  const { [ParamName.categoryId]: categoryId } = router.query;
  const { categories, queryParam, setQueryParam, queryProperty } = useHomeContext();

  const selectedCategory = categories?.find((item) => item.id === categoryId);

  const handleCloseSelectCategory = () => {
    const resetValue = mapValues(queryProperty, () => "");
    setQueryParam({ ...queryParam, ...resetValue, categoryId: "" });
    hideSelectCategory();
  };

  const hideSelectCategory = () => {
    setVisible(false);
    !visible &&
      setTimeout(() => {
        setVisible(undefined);
      }, 300);
  };

  const handleClickCategory = (categoryId: string) => {
    const resetValue = mapValues(queryProperty, () => "");
    setQueryParam({ ...queryParam, ...resetValue, categoryId: categoryId });
    hideSelectCategory();
  };

  return (
    <div className="w-fit">
      <div
        ref={categoryRef}
        className={`p-1 border text-center flex items-center hover:border-primary-dark hover:bg-gray-100 rounded-full cursor-pointer ${
          selectedCategory ? "border-primary bg-primary-light" : "border-gray-400 "
        }`}
      >
        {selectedCategory ? (
          <div className="flex items-center justify-between w-full">
            <div className="flex flex-row items-center justify-center gap-3 ml-1 whitespace-nowrap">
              <Img src={selectedCategory?.imgUrl} className="object-contain w-5 h-5 mx-auto "></Img>
              <span className="mt-1 text-sm font-medium text-gray-700 ">
                {selectedCategory?.name}
              </span>
            </div>
            <div
              onClick={(e) => {
                handleCloseSelectCategory();
              }}
              className="px-2 text-gray-500 text-14"
            >
              <FaTimes />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full pl-1" style={{ height: "30px" }}>
            <span className="text-gray-500 whitespace-nowrap">{t("Chọn danh mục")}</span>
            <div className="px-2 text-gray-500 text-14">
              <FaChevronDown />
            </div>
          </div>
        )}
      </div>

      <Popover
        theme="light-border"
        reference={categoryRef}
        trigger="click"
        placement="bottom-start"
        arrow={false}
        visible={visible}
      >
        {categories &&
          categories?.map((category) => {
            return (
              <div key={category.id}>
                <div className={`grid gap-2`}>
                  <div
                    onClick={() => handleClickCategory(category.id)}
                    key={category.id}
                    className={`col-span-1 hover:text-primary p-1  hover:bg-gray-50 rounded-md cursor-pointer ${
                      router.query.categoryId == category.id ? " bg-primary-light" : ""
                    }`}
                  >
                    <div className="flex flex-row items-center justify-start gap-3 whitespace-nowrap ">
                      <Img src={category.imgUrl} className="object-contain w-5 h-5 "></Img>
                      <span className="mt-1 text-sm font-medium ">{category.name}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </Popover>
    </div>
  );
};
