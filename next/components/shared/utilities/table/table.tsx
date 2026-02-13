import formatDate from "date-fns/format";
import { Children, Fragment, MouseEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RiArrowDownLine,
  RiArrowUpLine,
  RiCheckFill,
  RiCheckboxBlankCircleFill,
  RiCheckboxCircleFill,
  RiCloseFill,
  RiDeleteBinLine,
  RiEdit2Line,
  RiMore2Fill,
} from "react-icons/ri";
import { parseNumber } from "../../../../lib/helpers/parser";
import { BaseModel } from "../../../../lib/repo/crud.repo";
import { Button, ButtonProps } from "../form/button";
import { Img, ImgProps, NotFound, Spinner } from "../misc";
import { StatusLabelType } from "../misc/status-label";
import { Dropdown } from "../popover/dropdown";
import { useDataTable } from "./data-table";

interface TableProps extends ReactProps {
  items?: BaseModel[];
  disableDbClick?: boolean;
  onUpdateItem?: (item, index: number) => void;
}

export function Table({ className = "", style = {}, ...props }: TableProps) {
  const { t } = useTranslation();
  const {
    itemName,
    items,
    loadingItems,
    multiSelection,
    selectedItems,
    setSelectedItems,
    onUpdateItem,
    currentOrder,
    setCurrentOrder,
  } = useDataTable();
  const [tableItems, setTableItems] = useState<BaseModel[]>(undefined);
  const [columnComponents, setColumnComponents] = useState<any[]>([]);
  const [children, setChildren] = useState<any[]>([]);

  useEffect(() => {
    const column = [];
    const children = [];
    Children.map(props.children, (child) => {
      if (child?.type === Fragment) {
        Children.map(child.props.children, (child) => {
          column.push(child?.type?.displayName === "Column" ? { child } : null);
          children.push(!child?.type?.displayName ? { child } : null);
        });
      } else {
        column.push(child?.type?.displayName === "Column" ? { child } : null);
        children.push(!child?.type?.displayName ? { child } : null);
      }
    });

    setColumnComponents(column);
    setChildren(children);
  }, [props.children]);

  const columns = ([
    ...(multiSelection
      ? [
          {
            top: true,
            center: true,
            isSelection: true,
            width: 40,
          } as ColumnProps,
        ]
      : []),
    ...columnComponents?.map((col) => col.child.props),
  ] || []) as ColumnProps[];

  useEffect(() => {
    setTableItems(props.items ?? items);
  }, [items, props.items]);

  const onItemClick = (item: BaseModel) => {
    if (!multiSelection) {
      items && setSelectedItems([item]);
    } else {
      let index = selectedItems.findIndex((x) => x.id == item.id);
      if (index >= 0) {
        selectedItems.splice(index, 1);
      } else {
        selectedItems.push(item);
      }
      setSelectedItems([...selectedItems]);
    }
  };

  const onDoubleClick = (e: MouseEvent, item, index: number) => {
    if (e.detail != 2) return;
    else {
      if (!props.disableDbClick) {
        props.onUpdateItem ? props.onUpdateItem(item, index) : onUpdateItem(item);
      }
    }
  };

  const onHeaderClick = (col: ColumnProps) => {
    if (col.orderBy) {
      if (currentOrder && currentOrder.property == col.orderBy) {
        switch (currentOrder.type) {
          case "asc": {
            setCurrentOrder({ property: col.orderBy, type: "desc" });
            break;
          }
          case "desc": {
            setCurrentOrder(null);
            break;
          }
        }
      } else {
        setCurrentOrder({ property: col.orderBy, type: "asc" });
      }
    }
  };

  return (
    <table
      className={`w-full border-t border-l border-r border-gray-300 border-collapse ${className}`}
      style={{ ...style }}
    >
      <thead>
        <tr className="text-sm font-semibold text-gray-600 uppercase border-b border-gray-300 bg-gray-50">
          {columns.map((col, index, arr) => (
            <th
              onClick={() => onHeaderClick(col)}
              key={col.label + index.toString()}
              className={`py-3 ${
                index == 0 ? "pl-3 pr-2" : index == arr.length - 1 ? "pl-2 pr-3" : "px-2"
              } ${col.orderBy ? "cursor-pointer hover:text-primary hover:bg-gray-100" : ""} ${
                col.className || ""
              }`}
              style={{ width: col.width ? col.width + "px" : "auto" }}
            >
              <div
                className={`flex items-center ${
                  col.center ? "justify-center" : col.right ? "justify-end" : "justify-start"
                }`}
              >
                {col.orderBy && col.orderBy == currentOrder?.property && (
                  <i className="pr-1 text-lg">
                    {currentOrder?.type == "asc" ? <RiArrowUpLine /> : <RiArrowDownLine />}
                  </i>
                )}
                {col.label}
              </div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="relative">
        {loadingItems && (
          <>
            {tableItems?.length ? (
              <tr>
                <td className="border-b" colSpan={100}>
                  <Spinner className="absolute h-full py-0 max-h-44" />
                </td>
              </tr>
            ) : (
              <tr>
                <td className="border-b" colSpan={100}>
                  <Spinner className="py-20" />
                </td>
              </tr>
            )}
          </>
        )}
        {tableItems && !tableItems.length && !loadingItems && (
          <tr>
            <td className="border-b" colSpan={100}>
              <NotFound className="py-20" text={`${t("Không tìm thấy")} ${t(itemName) || ""}`} />
            </td>
          </tr>
        )}
        {tableItems?.map((item, itemIndex) => {
          const selected = item.id ? !!selectedItems?.find((x) => x.id == item.id) : false;
          return (
            <tr
              onClick={(e) => {
                e.stopPropagation();
                onDoubleClick(e, item, itemIndex);
                onItemClick(item);
              }}
              key={item.id + itemIndex.toString()}
              style={{ transitionProperty: "background-color" }}
              className={`border-b text-gray-800 text-sm duration-75 h-12 ${
                selected ? "bg-bluegray-50" : "hover:bg-gray-50"
              } ${
                loadingItems
                  ? "opacity-0 border-transparent pointer-events-none"
                  : `${itemIndex == tableItems.length - 1 ? "border-gray-300" : "border-gray-200"}`
              }`}
            >
              {columns.map((col, index, arr) => (
                <td
                  key={col.label + index.toString()}
                  className={`${
                    index == 0
                      ? "py-2 pl-3 pr-2"
                      : index == arr.length - 1
                      ? "py-2 pl-2 pr-3"
                      : "p-2"
                  } ${col.center ? "text-center" : col.right ? "text-right" : "text-left"} ${
                    col.top ? "align-top" : col.bottom ? "align-bottom" : "align-middle"
                  } ${col.className || ""}`}
                  style={{ width: col.width ? col.width + "px" : "auto" }}
                >
                  {col.isSelection && (
                    <div className="flex justify-center h-full pt-2 cursor-pointer group">
                      {selected ? (
                        <i className="text-xl text-primary group-hover:text-primary-dark">
                          <RiCheckboxCircleFill />
                        </i>
                      ) : (
                        <i className="text-xl text-bluegray-200 group-hover:text-bluegray-300">
                          <RiCheckboxBlankCircleFill />
                        </i>
                      )}
                    </div>
                  )}
                  {!!col.render && col.render(item, col, itemIndex)}
                </td>
              ))}
            </tr>
          );
        })}
        {children}
      </tbody>
    </table>
  );
}

interface ColumnProps extends ReactProps {
  label?: string;
  center?: boolean;
  right?: boolean;
  top?: boolean;
  bottom?: boolean;
  width?: number;
  orderBy?: string;
  isSelection?: boolean;
  render?: (item: BaseModel, column?: ColumnProps, index?: number) => React.ReactNode;
}
const Column = ({ children }: ColumnProps) => <>children</>;
Column.displayName = "Column";
Table.Column = Column;

interface CellProps extends ReactProps {
  value: any;
}

interface CellTextProps extends CellProps {
  subText?: any;
  subTextClassName?: string;
  image?: string;
  imageClassName?: string;
  avatar?: string;
  ratio169?: boolean;
  percent?: number;
  compress?: number;
  subTextOptions?: Option[];
  subTextIsLabel?: boolean;
  onClick?: () => void;
}
const CellText = ({
  value,
  className = "",
  style = {},
  subText = "",
  subTextClassName = "text-sm",
  image,
  avatar,
  imageClassName = "",
  ratio169,
  percent,
  compress,
  subTextOptions,
  subTextIsLabel = false,
  onClick = () => {},
}: CellTextProps) => {
  let option = subTextOptions ? subTextOptions.find((option) => option.value == subText) : null;
  return (
    <div className="flex items-center" onClick={onClick}>
      {(image !== undefined || avatar !== undefined) && (
        <Img
          // compress={compress || 80}
          className={`w-10 mr-3 ${imageClassName}`}
          imageClassName={`border border-gray-300`}
          src={image || avatar}
          avatar={avatar !== undefined}
          showImageOnClick
          ratio169={ratio169}
          percent={percent}
        />
      )}
      <div className="flex-1">
        <div className={`${className}`} style={{ ...style }}>
          {value}
        </div>
        {subText != null && (
          <div className={`${subTextClassName}`}>
            {option ? (
              <span
                className={`${subTextIsLabel ? "status-label" : "status-text"} ${
                  option?.color
                    ? subTextIsLabel
                      ? "bg-" + option.color
                      : "text-" + option.color
                    : subTextIsLabel
                    ? "bg-gray-400 text-gray-700"
                    : "text-gray-700"
                } ${className}`}
              >
                {option?.label}
              </span>
            ) : (
              subText
            )}
          </div>
        )}
      </div>
    </div>
  );
};
CellText.displayName = "CellText";
Table.CellText = CellText;

interface CellDateProps extends CellProps {
  format?: string;
}
const CellDate = ({ value, className = "", style = {}, format = "dd-MM-yyyy" }: CellDateProps) => (
  <div className={`${className}`} style={{ ...style }}>
    {value ? formatDate(new Date(value), format) : ""}
  </div>
);
CellDate.displayName = "CellDate";
Table.CellDate = CellDate;

interface CellNumberProps extends CellProps {
  suffix?: string;
  currency?: string | boolean;
  compact?: boolean;
  percent?: boolean;
  signDisplay?: "auto" | "always" | "never";
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}
const CellNumber = ({
  value,
  className = "",
  suffix = "",
  style = {},
  currency,
  compact,
  percent,
  signDisplay,
  minimumFractionDigits,
  maximumFractionDigits,
}: CellNumberProps) => (
  <div className={`${className}`} style={{ ...style }}>
    {parseNumber(value, currency, {
      compact,
      percent,
      signDisplay,
      minimumFractionDigits,
      maximumFractionDigits,
    })}
    {suffix}
  </div>
);
CellNumber.displayName = "CellNumber";
Table.CellNumber = CellNumber;

interface CellBooleanProps extends CellProps {
  trueIcon?: JSX.Element;
  falseIcon?: JSX.Element;
  trueClassName?: string;
  falseClassName?: string;
}
const CellBoolean = ({
  value,
  className = "",
  style = {},
  trueIcon = <RiCheckFill />,
  trueClassName = "text-success",
  falseIcon = <RiCloseFill />,
  falseClassName = "text-gray-700",
}: CellBooleanProps) => (
  <div className={`flex-center ${className}`} style={{ ...style }}>
    <i className={`${value ? trueClassName : falseClassName}`}>{value ? trueIcon : falseIcon}</i>
  </div>
);
CellBoolean.displayName = "CellBoolean";
Table.CellBoolean = CellBoolean;

interface CellImageProps extends CellProps, ImgProps {
  center?: boolean;
  right?: boolean;
  compress?: number;
}
const CellImage = ({
  value,
  className = "",
  style = {},
  center,
  right,
  compress,
  ...props
}: CellImageProps) => (
  <Img
    // compress={compress || 80}
    className={`flex ${center ? "mx-auto" : right ? "ml-auto" : "mr-auto"} ${className}`}
    imageClassName="border border-gray-300"
    style={{ ...style }}
    src={value}
    showImageOnClick
    {...props}
  />
);
CellImage.displayName = "CellImage";
Table.CellImage = CellImage;

interface CellStatusProps extends CellProps {
  options: Option[];
  isLabel?: boolean;
  type?: StatusLabelType;
  label?: string;
  extraClassName?: string;
}
const CellStatus = ({
  value,
  className = "",
  style = {},
  options,
  isLabel = true,
  extraClassName = "",
  type,
  ...props
}: CellStatusProps) => {
  const { t } = useTranslation();
  let option = options.find((option) => option.value == value);
  const color = option?.color || "bluegray";
  const label = props.label || option?.label || t("Không có");
  return (
    <span
      className={`${isLabel ? "status-label " : "status-text"} ${
        option?.color
          ? isLabel
            ? "bg-" + option.color
            : "text-" + option.color
          : isLabel
          ? "bg-gray-400 text-gray-700"
          : "text-gray-700"
      } ${className}  ${extraClassName} ${type == "label" ? `text-white` : `text-${color}`} ${
        type == "label" ? `bg-${color}` : type == "light" ? `bg-${color}-light` : "bg-transparent"
      }`}
      style={{
        ...style,
      }}
    >
      {label}
    </span>
  );
};
CellStatus.displayName = "CellStatus";
Table.CellStatus = CellStatus;

interface CellActionProps extends ReactProps {}
const CellAction = ({ className = "", style = {}, children }: CellActionProps) => {
  return (
    <div className={`flex border-group ${className}`} style={{ ...style }}>
      {children}
    </div>
  );
};
CellAction.displayName = "CellAction";
Table.CellAction = CellAction;

interface CellButtonProps extends ButtonProps {
  value: BaseModel;
  isEditButton?: boolean;
  isDeleteButton?: boolean;
  refreshAfterTask?: boolean;
  moreItems?: ((ButtonProps & { refreshAfterTask?: boolean }) | "divider")[];
}
const CellButton = ({
  value,
  isEditButton,
  isDeleteButton,
  refreshAfterTask,
  moreItems,
  className = "",
  ...props
}: CellButtonProps) => {
  const { updateItemHref, onDeleteItem, onUpdateItem, loadAll, loadingItem } = useDataTable();
  const ref = useRef();

  let icon = props.icon;
  if (!icon) {
    if (isEditButton) {
      icon = <RiEdit2Line />;
    } else if (isDeleteButton) {
      icon = <RiDeleteBinLine />;
    } else if (moreItems) {
      icon = <RiMore2Fill />;
    }
  }

  return (
    <>
      <Button
        {...props}
        icon={icon}
        innerRef={props.innerRef || ref}
        hoverDanger={isDeleteButton}
        className={`text-lg px-1.5 h-8 ${className}`}
        {...(isEditButton
          ? {
              isLoading: loadingItem == value.id,
            }
          : {})}
        href={
          props.href
            ? props.href
            : isEditButton && updateItemHref
            ? updateItemHref(value)
            : undefined
        }
        onClick={async (e) => {
          try {
            if (props.onClick) await props.onClick(e);
            if (isEditButton) await onUpdateItem(value);
            if (isDeleteButton) await onDeleteItem(value);
            if (refreshAfterTask) await loadAll(true);
          } catch (err) {}
        }}
      />
      {moreItems && (
        <Dropdown reference={props.innerRef || ref}>
          {moreItems.map((item, index) =>
            item == "divider" ? (
              <Dropdown.Divider key={index} />
            ) : (
              <Dropdown.Item
                key={index}
                {...item}
                onClick={async (e) => {
                  try {
                    if (item.onClick) await item.onClick(e);
                    if (item.refreshAfterTask) await loadAll(true);
                  } catch (err) {}
                }}
              />
            )
          )}
        </Dropdown>
      )}
    </>
  );
};
CellButton.displayName = "CellButton";
Table.CellButton = CellButton;
