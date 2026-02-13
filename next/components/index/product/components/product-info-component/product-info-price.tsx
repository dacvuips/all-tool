import { useTranslation } from "react-i18next";

interface ProductPriceProps {
  selectServiceId: string;
}
export const ProductInfoPrice = ({ selectServiceId }: ProductPriceProps) => {
  const { t } = useTranslation();

  // const amount = useMemo(() => {
  //   const service = services?.find((item) => item.id === selectServiceId);

  //   return service?.isNegotiablePrice ? t("Giá thỏa thuận") : currencyPrice(service?.value);
  // }, [selectServiceId]);

  return (
    <div className="flex gap-2 items-center py-2">
      <div className="pl-2 ml-2 text-sm font-semibold border-l-2 border-primary-dark lg:text-base text-accent">
        {`${t("Giá")}: `}
      </div>
      <div className="flex gap-2 items-center">
        {/* <span className="text-lg font-bold text-primary-dark">{amount}</span> */}
      </div>
    </div>
  );
};
