import { useRef } from "react";
import { FaEllipsisH } from "react-icons/fa";
import { HiOutlineDotsVertical } from "react-icons/hi";
import { Button, ButtonProps } from "../form";
import { Dropdown } from "../popover/dropdown";

interface PropsType extends ReactProps {}
export function Card({ className = "", style = {}, ...props }: PropsType) {
  return (
    <div
      className={`p-4 bg-white border-gray-100 rounded shadow ${className}`}
      style={{ ...style }}
    >
      {props.children}
    </div>
  );
}

interface HeaderProps extends ReactProps {
  title: string;
  subtitle?: string;
  actions?: ButtonProps[];
  moreActions?: ButtonProps[];
}
Card.Header = ({
  title,
  subtitle,
  actions,
  moreActions,
  className = "",
  style = {},
  ...props
}: HeaderProps) => {
  const moreRef = useRef();
  return (
    <div className="flex items-center justify-between border-b border-gray-300 pb-2">
      <div>
        <h6 className="text-lg font-semibold text-gray-800">{props.children || title}</h6>
        {subtitle && <p className="text-sm leading-tight text-gray-500">{subtitle}</p>}
      </div>
      <div className="flex items-center space-x-4">
        {moreActions && (
          <>
            <Button outline icon={<HiOutlineDotsVertical />} innerRef={moreRef} />
            <Dropdown reference={moreRef}>
              {moreActions.map((btnProps, index) => (
                <Dropdown.Item key={index} {...btnProps} />
              ))}
            </Dropdown>
          </>
        )}
        {actions && actions.map((btn, index) => <Button key={index} {...btn} />)}
      </div>
    </div>
  );
};
