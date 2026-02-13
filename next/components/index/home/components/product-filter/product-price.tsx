import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaChevronDown, FaTimes } from "react-icons/fa";
import { CONSTANTS, ParamName } from "../../../../../lib/constants/constants";
import { useFormatNumberToText } from "../../../../../lib/hooks/useFormatNumberToText";
import { Button } from "../../../../shared/utilities/form";
import MultiRangeSlider from "../../../../shared/utilities/form/multiRange";
import { Popover } from "../../../../shared/utilities/popover/popover";
import { useHomeContext } from "../../provider/home-provider";

interface ButtonProductPriceList {
  text: string;
  onClick: () => void;
  isOutLine?: boolean;
  isPrimary?: boolean;
  isDisabled?: boolean;
}

export const ProductPrice = () => {
  const { t } = useTranslation();
  const productPriceRef = useRef();
  const [visible, setVisible] = useState(undefined);

  const { formatNumberToText } = useFormatNumberToText();
  const { queryParam, setQueryParam } = useHomeContext();
  const { [ParamName.minPrice]: minPrice, [ParamName.maxPrice]: maxPrice } = queryParam;
  const [range, setRange] = useState<{ min: number | string; max: number | string }>({
    min: minPrice,
    max: maxPrice,
  });

  const hideSelectGame = () => {
    setVisible(false);
    !visible &&
      setTimeout(() => {
        setVisible(undefined);
      }, 300);
  };

  const filterValue = `${minPrice ? formatNumberToText(minPrice) : 0} - ${
    maxPrice ? formatNumberToText(maxPrice) : formatNumberToText(CONSTANTS.productMaxPrice)
  } `;

  const handleResetFilter = () => {
    hideSelectGame();
    setQueryParam({
      ...queryParam,
      [ParamName.minPrice]: "",
      [ParamName.maxPrice]: "",
    });
    setRange({
      min: "",
      max: "",
    });
  };

  const handleApplyFilter = () => {
    hideSelectGame();
    setQueryParam({
      ...queryParam,
      [ParamName.minPrice]: range.min === 0 ? "" : range.min,
      [ParamName.maxPrice]: range.max === CONSTANTS.productMaxPrice ? "" : range.max,
    });
  };

  const hasFilter = minPrice || maxPrice;

  return (
    <>
      <div>
        <div
          ref={productPriceRef}
          className={`p-1 border  text-center flex items-center hover:border-primary-dark hover:bg-gray-100 rounded-full cursor-pointer ${
            hasFilter ? " border-primary bg-primary-light" : "border-gray-400"
          }`}
        >
          {hasFilter ? (
            <div
              className={`flex items-center justify-between w-full pl-1 ${
                hasFilter ? " text-primary font-semibold" : ""
              }`}
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
              className="flex items-center justify-between w-full pl-2"
              style={{ height: "30px" }}
            >
              <span className="text-gray-500 whitespace-nowrap">{t("Chọn giá")}</span>
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
          <div className="flex-1 min-w-3xs">
            <MultiRangeSlider
              label={t("Khoảng giá")}
              className="w-full"
              multi
              min={0}
              max={CONSTANTS.productMaxPrice}
              defaultMinValue={+minPrice || 0}
              defaultMaxValue={+maxPrice || CONSTANTS.productMaxPrice}
              onChange={({ min, max }) => {
                setRange({
                  min,
                  max,
                });
              }}
              textValue={""}
            />
          </div>
          <div className="flex justify-center gap-2 pt-2 mt-3 border-t">
            <Button
              text={t("Áp dụng")}
              onClick={() => handleApplyFilter()}
              primary
              disabled={!range.min && !range.max}
              className="h-8 px-4 text-12"
            />
          </div>
        </Popover>
      </div>
    </>
  );
};
