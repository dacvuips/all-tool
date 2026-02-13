import { useTranslation } from "react-i18next";

interface ProductServicesProps {}
export const ProductServices = ({}: ProductServicesProps) => {
  const { t } = useTranslation();

  // const handleClick = ({ serviceId }: { serviceId: string }) => {
  //   const isService = serviceId === selectServiceId;

  //   !isService && setSelectServiceId(serviceId);
  // };

  return (
    <div className="py-2">
      <p className="pl-2 ml-2 font-semibold border-l-2 border-primary-dark">{t("Dịch vụ")}</p>
      {/* <div className={`grid items-start w-full rounded-md`}>
        <div className="overflow-auto max-h-72 border-gray-200 v-scrollbar">
          <div className="flex flex-wrap gap-2 py-2">
            {services?.map((service) => (
              <div
                key={service.id}
                onClick={() => handleClick({ serviceId: service.id })}
                className={`select-none relative flex flex-col items-start justify-center p-1 border rounded-md cursor-pointer hover:border-primary hover:text-primary ${
                  selectServiceId === service.id
                    ? "border-primary text-primary-dark bg-primary-light"
                    : ""
                }`}
              >
                {selectServiceId === service.id ? (
                  <div className="absolute -right-1 -bottom-1 text-white rounded-full border border-white bg-primary">
                    <HiOutlineCheck />
                  </div>
                ) : (
                  ""
                )}
                <div className="flex gap-2 items-center">
                  <Img className="w-5 h-5" src={service.imgUrl} />
                  <span>{service.name}</span>
                </div>
                <div className="leading-3 text-12 mt-0.5">
                  {service.min > 0 && <span>{`${t("Tối thiểu")}: ${service.min}`}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div> */}
    </div>
  );
};
