import { useTranslation } from "react-i18next";
import { HiSearch } from "react-icons/hi";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function FilmProductionSearchInput({
  value,
  onChange,
  placeholder,
  className = "",
}: Props) {
  const { t } = useTranslation();

  return (
    <div className={`relative min-w-0 ${className}`}>
      <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
        <HiSearch className="text-gray-400 text-xs block" />
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || t("Tìm theo tên...")}
        className="w-full rounded-lg border border-gray-200 pl-8 pr-2.5 py-1.5 text-xs outline-none focus:border-blue-400 bg-white"
      />
    </div>
  );
}
