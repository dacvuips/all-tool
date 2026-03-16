import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaChevronDown, FaTimes } from "react-icons/fa";

import { mapValues } from "lodash";
import { ParamName } from "../../../../../lib/constants/constants";

import { PropertyTypeEnum } from "../../../../../lib/repo/product";
import { Field, Form, Input, MediaInput, Select, Switch } from "../../../../shared/utilities/form";
import { Popover } from "../../../../shared/utilities/popover/popover";
import { useHomeContext } from "../../provider/home-provider";

export const ProductProperty = () => {
  const { t } = useTranslation();

  const productGameOptionsRef = useRef();
  const [visible, setVisible] = useState(undefined);

  const { queryParam, setQueryParam, categories, selectCategory, queryProperty } = useHomeContext();

  const { [ParamName.categoryId]: categoryId } = queryParam;

  const hideSelectGame = () => {
    setVisible(false);
    !visible &&
      setTimeout(() => {
        setVisible(undefined);
      }, 300);
  };

  const badgeCount = useMemo(() => {
    return Object.entries(queryProperty).reduce((acc, [key, _]) => {
      if (queryProperty[key] !== "") {
        return acc + 1;
      }

      return acc;
    }, 0);
  }, [queryProperty]);

  const onSubmit = async (data) => {
    // Flatten nested categoryProperties object if it exists
    const flattenedData = data.categoryProperties ? data.categoryProperties : data;
    const convertedData = mapValues(flattenedData, (value) => value || "");
    hideSelectGame();
    setQueryParam(convertedData);
  };

  const handleResetFilter = () => {
    hideSelectGame();
    const resetValue =
      selectCategory?.properties?.reduce((acc, field) => {
        acc[field.key] = "";
        return acc;
      }, {}) || {};
    console.log("resetValue", resetValue, selectCategory);
    setQueryParam({
      ...queryParam,
      ...resetValue,
    });
  };

  return (
    <>
      <div>
        <div
          ref={productGameOptionsRef}
          className={`p-1 border text-center flex items-center hover:border-primary-dark hover:bg-gray-100 rounded-full cursor-pointer ${
            badgeCount ? "border-primary bg-primary-light" : "border-gray-400"
          }`}
        >
          {badgeCount ? (
            <div
              className={`flex items-center justify-between pl-1 ${
                badgeCount ? "font-semibold text-primary" : ""}`}
              style={{ height: "30px" }}
            >
              <div className="flex items-center">
                <span className="whitespace-nowrap">{`${t("Đang lọc")} (${badgeCount})`}</span>
              </div>

              <div onClick={handleResetFilter} className="px-2 text-gray-500 text-14">
                <FaTimes />
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-center pl-2" style={{ height: "30px" }}>
              <span className="text-gray-500 whitespace-nowrap">{t("Thêm lọc")}</span>
              <div className="px-2 text-gray-500 text-14">
                <FaChevronDown />
              </div>
            </div>
          )}
        </div>

        <Popover
          theme="light-border"
          visible={visible}
          reference={productGameOptionsRef}
          trigger="click"
          placement="bottom-start"
          arrow={false}
        >
          {!!categoryId ? (
            <div>
              <Form
                className={`grid grid-cols-12 gap-2 w-64 2xs:w-80`}
                onSubmit={(data) => {
                  onSubmit(data);
                }}
                defaultValues={queryProperty}
              >
                <>
                  {selectCategory?.properties?.map((field) => {
                    return (
                      <Field
                        namePrefix="categoryProperties"
                        key={field.key}
                        name={field.key}
                        label={field.label}
                        cols={12}
                        tooltip={field.tooltip}
                      >
                        {field.type == PropertyTypeEnum.TEXT && (
                          <Input placeholder={field.placeholder} />
                        )}
                        {field.type == PropertyTypeEnum.NUMBER && (
                          <Input number placeholder={field.placeholder} />
                        )}
                        {field.type == PropertyTypeEnum.BOOLEAN && (
                          <Switch placeholder={field.placeholder} />
                        )}
                        {(field.type == PropertyTypeEnum.SELECT ||
                          field.type == PropertyTypeEnum.MULTI_SELECT) && (
                          <Select
                            clearable
                            multi={field.type == PropertyTypeEnum.MULTI_SELECT}
                            placeholder={field.placeholder}
                            options={field.options.map((x) => ({
                              value: x.key,
                              label: x.label,
                            }))}
                          />
                        )}
                        {field.type == PropertyTypeEnum.MEDIA && (
                          <MediaInput placeholder={field.placeholder} />
                        )}
                      </Field>
                    );
                  })}
                </>

                <Form.Footer
                  cancelText=""
                  submitProps={{
                    small: true,
                  }}
                  submitText={t("Áp dụng")}
                  className="justify-center"
                />
              </Form>
            </div>
          ) : (
            <span className="py-2">{t("Chọn danh mục")}</span>
          )}
        </Popover>
      </div>
    </>
  );
};
