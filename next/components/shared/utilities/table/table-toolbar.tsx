import { Children } from "react";
import { useTranslation } from "react-i18next";
import { RiSearchLine } from "react-icons/ri";
import { Form, FormProps } from "../form/form";
import { Input, InputProps } from "../form/input";
import { useDataTable } from "./data-table";

interface PropsType extends ReactProps {
  className?: string;
}

export function TableToolbar({ className, ...props }: PropsType) {
  const { t } = useTranslation();
  const { itemName, onFilterChange, onSearchChange } = useDataTable();

  const searchComponents = Children.map(props.children, (child) =>
    child?.type?.displayName === "Search" ? { child } : null
  );
  const filterComponents = Children.map(props.children, (child) =>
    child?.type?.displayName === "Filter" ? { child } : null
  );
  let children = Children.map(props.children, (child) =>
    !child?.type?.displayName ? child : null
  );
  return (
    <div className={`flex items-center justify-between gap-x-2 ${className}`}>
      <div>
        {!!searchComponents?.length &&
          searchComponents.map((search, index) => (
            <Input
              key={index}
              style={{
                maxWidth: 250,
              }}
              clearable
              prefix={
                <i className="text-xl">
                  <RiSearchLine />
                </i>
              }
              placeholder={`${t("Tìm kiếm")} ${t(itemName)}`}
              debounce={300}
              onChange={onSearchChange}
              {...search.child.props}
            />
          ))}
      </div>
      <div className={`flex justify-end flex-1  `}>
        {!!filterComponents?.length &&
          filterComponents.map((search, index) => (
            <Form
              key={index}
              className={`flex w-auto gap-x-2`}
              {...search.child?.props}
              onChange={onFilterChange}
            >
              {search.child?.props?.children}
            </Form>
          ))}
      </div>
    </div>
  );
}

const Search = ({ children }: InputProps) => children;
Search.displayName = "Search";
TableToolbar.Search = Search;

const Filter = ({ children }: FormProps) => children;
Filter.displayName = "Filter";
TableToolbar.Filter = Filter;

// type ButtonCompProps = ButtonProps & { isAddButton?: boolean; isDeleteButton?: boolean };
// const ButtonComp = ({ isAddButton, isDeleteButton, children, ...props }: ButtonCompProps) =>
//   children;
// ButtonComp.displayName = "Button";
// TableHeader.Button = ButtonComp;
