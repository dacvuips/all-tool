import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { RiArticleLine, RiBankCard2Line, RiBankCardLine } from "react-icons/ri";

export function Steps({
  step,
  stepList,
}: {
  step: number;
  stepList?: { icon: ReactNode; title: string }[];
}) {
  const { t } = useTranslation();
  const STEPS = stepList || [
    {
      icon: <RiArticleLine />,
      title: t("Tạo đơn mua"),
    },
    // {
    //   icon: <RiCheckDoubleLine />,
    //   title: "Xác nhận đơn",
    // },
    {
      icon: <RiBankCardLine />,
      title: t("Thanh toán"),
    },
    {
      icon: <RiBankCard2Line />,
      title: t("Lấy mã thẻ"),
    },
  ];
  return (
    <>
      <div className="w-full py-2 ">
        <div className="flex">
          {STEPS.map((item, index) => (
            <div key={index} className="w-1/3">
              <div className="relative mb-2">
                {index !== 0 && (
                  <div
                    className="absolute flex items-center content-center align-middle align-center"
                    style={{
                      width: "calc(100% - 2.5rem - 1rem)",
                      top: "50%",
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <div className="items-center flex-1 w-full align-middle bg-gray-200 rounded align-center">
                      <div
                        className={`w-0 py-1  rounded ${
                          index < step + 1 ? "bg-green-300" : "bg-gay-200"
                        }`}
                        style={{ width: "100%" }}
                      ></div>
                    </div>
                  </div>
                )}

                <div
                  className={`flex items-center w-10 h-10 mx-auto text-lg  rounded-full ${
                    index === step
                      ? "bg-primary text-white"
                      : "bg-white text-gray-400 border-2 border-gray-200"
                  } `}
                >
                  <i style={{ padding: "7px" }} className=" text-24">
                    {item.icon}
                  </i>
                </div>
              </div>

              <div className="text-xs text-center md:text-base">{item.title}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
