import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AiOutlineFacebook } from "react-icons/ai";
import { RiMailLine } from "react-icons/ri";
import { Accordion } from "../../../components/shared/utilities/misc";
import { useScreen } from "../../../lib/hooks/useScreen";

export function Footer({ className, ...props }: ReactProps) {
  const { t } = useTranslation();
  const screenLg = useScreen("lg");
  const [openEmail, setOpenEmail] = useState<boolean>(false);
  if (!screenLg)
    return (
      <footer className={`w-full text-accent mt-5 ${className}`}>
        <div className="border-t-4 border-primary"></div>
        <div className="pt-2 pb-4 bg-white">
          <div className="mx-4 ">
            <div className="flex flex-col items-center ">
              <img src="/assets/img/logo-full-1.png" className="object-cover py-1 w-44" alt="" />

              <div className="flex flex-row ">
                <span className="text-sm font-bold text-accent">
                  {t("Free Generate Image - Video - AI")}
                </span>
              </div>
              <div className="flex flex-col  items-center justify-center ">
                <div className="max-w-3xl text-center text-12 text-accent">
                  {t("Lấy link tiếp thị liên kết để nhận 20% hoa hồng.")}
                </div>
                <div className="text-center text-12 text-accent">
                  {`Zalo: 097.352.2962 - 037.7733.100`}
                </div>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex flex-col items-center justify-center ">
                  <div className="flex gap-2 item-center">
                    <Link href={"https://www.facebook.com/midman.vn"} target="_blank">
                      <i className="cursor-pointer text-32 hover:text-primary">
                        <AiOutlineFacebook />
                      </i>
                    </Link>
                    <Link href="mailto:midmanvn@gmail.com">
                      <i
                        onClick={() => setOpenEmail(!openEmail)}
                        className="cursor-pointer text-32 hover:text-primary"
                      >
                        <RiMailLine />
                      </i>
                    </Link>
                  </div>
                  <Accordion isOpen={openEmail}>
                    <div className="px-2 border rounded-full">{"midmanvn@gmail.com"}</div>
                  </Accordion>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* <div className="py-2 text-sm text-center">{`MidMan © ${new Date().getFullYear()}${
          publicRuntimeConfig?.version ? " v" + publicRuntimeConfig?.version : ""
        }`}</div> */}
      </footer>
    );

  return (
    <>
      <footer className={`w-full text-accent mt-5 ${className}`}>
        <div className="border-t-4 border-primary "></div>
        <div className="pt-2 pb-4 bg-white ">
          <div className="main-container ">
            <div className="flex items-start gap-5">
              <img src="/assets/img/logo-full-1.png" className="object-cover py-1 w-44" alt="" />
              <div>
                <div className="flex flex-row ">
                  <span className="text-sm font-bold text-accent">
                    {t("Free Generate Image - Video - AI")}
                  </span>
                </div>
                <div className="flex flex-col   justify-center ">
                  <span className=" text-12 text-accent">
                    {t("Lấy link tiếp thị liên kết để nhận 20% hoa hồng.")}
                  </span>
                  <p className="text-12   text-accent">{`Zalo: 097.352.2962 - 037.7733.100`}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* <div className="py-2 text-sm text-center">{`MidMan © ${new Date().getFullYear()}${
          publicRuntimeConfig?.version ? " v" + publicRuntimeConfig?.version : ""
        }`}</div> */}
      </footer>
    </>
  );
}

const TOPIC_LIST = [
  { title: "Giải quyết khiếu nại", slug: "giai-quyet-khieu-nai" },
  { title: "Quy chế hoạt động website", slug: "quy-che-hoat-dong-website" },
  { title: "Quy chế hoạt động ứng dụng", slug: "quy-che-hoat-dong-ung-dung" },
  { title: "Điều khoản dịch vụ", slug: "dieu-khoan-dich-vu" },
];
