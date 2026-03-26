import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaChevronDown, FaTimes } from "react-icons/fa";
import { ParamName } from "../../../../../lib/constants/constants";
import { ProductAppService } from "../../../../../lib/repo/product/productApp.repo";
import { SortDirection } from "../../../../../lib/repo/types";
import { Button } from "../../../../shared/utilities/form";
import { Popover } from "../../../../shared/utilities/popover/popover";
import { useHomeContext } from "../../provider/home-provider";

export const ProductPriceSort = () => {
  const { t } = useTranslation();
  const productPriceRef = useRef();
  const [visible, setVisible] = useState(undefined);

  const { queryParam, setQueryParam, setPagination } = useHomeContext();
  const { [ParamName.sort]: sort } = queryParam;

  const priceSortButtonMap = [
    {
      text: t("Giá thấp - cao"),
      value: SortDirection.Asc,
    },
    { text: t("Giá cao - thấp"), value: SortDirection.Desc },
  ];

  const hideSelect = () => {
    setVisible(false);
    !visible &&
      setTimeout(() => {
        setVisible(undefined);
      }, 300);
  };

  const filterValue = priceSortButtonMap.find((item) => item.value === sort)?.text;

  const handleResetFilter = async () => {
    hideSelect();
    await ProductAppService.clearStore();
    setPagination({ page: 1 });
    setQueryParam({
      ...queryParam,
      [ParamName.sort]: "",
    });
  };

  const handleApplyFilter = async (value: string) => {
    hideSelect();
    await ProductAppService.clearStore();
    setPagination({ page: 1 });
    setQueryParam({
      ...queryParam,
      [ParamName.sort]: value,
    });
  };

  return (
    <>
      <div>
        <div
          ref={productPriceRef}
          className={`px-1 border  text-center flex items-center hover:border-primary-dark hover:bg-gray-100 rounded-full cursor-pointer ${
            sort ? "border-primary bg-primary-light" : "border-gray-400"
          }`}
        >
          {sort ? (
            <div
              className={`flex items-center justify-between w-full pl-1 ${
                sort ? "font-semibold text-primary" : ""}`}
              style={{ height: "30px" }}
            >
              <span className="whitespace-nowrap">{filterValue}</span>
              <div
                onClick={(e) => {
                  handleResetFilter();
                }}
                className="px-2 text-gray-500 text-14"
              >
                <FaTimes />
              </div>
            </div>
          ) : (
            <div
              className="flex justify-between items-center pl-1 w-full"
              style={{ height: "30px" }}
            >
              <span className="text-gray-500 whitespace-nowrap">{t("Sắp xếp giá")}</span>
              <div className="px-2 text-gray-500 text-14">
                <FaChevronDown />
              </div>
            </div>
          )}
        </div>

        <Popover
          theme="light-border"
          visible={visible}
          reference={productPriceRef}
          trigger="click"
          placement="bottom-start"
          arrow={false}
        >
          <div className="flex flex-col gap-y-1 items-center">
            {priceSortButtonMap.map((button, index) => (
              <Button
                key={index}
                text={button.text}
                onClick={() => handleApplyFilter(button.value)}
                className={`hover:bg-gray-50 rounded-md px-0.5 ${
                  sort === button.value ? "bg-primary-light" : ""
                }`}
              />
            ))}
          </div>
        </Popover>
      </div>
    </>
  );
};
