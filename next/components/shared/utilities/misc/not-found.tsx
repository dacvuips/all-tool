import { useTranslation } from "react-i18next";

interface PropsType extends ReactProps {
  icon?: JSX.Element;
  text: string;
}
export function NotFound(props: PropsType) {
  const { t } = useTranslation();
  return (
    <div
      className={`w-full flex-center col-span-full flex-col text-center text-gray-500 py-12 font-semibold ${
        props.className || ""
      }`}
    >
      {props.icon && <i className="mb-2 text-2xl">{props.icon}</i>}
      <span>{props.text || t("Không tìm thấy")}</span>
      {props.children}
    </div>
  );
}
