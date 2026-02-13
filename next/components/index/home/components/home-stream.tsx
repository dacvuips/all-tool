import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BsPlayCircle } from "react-icons/bs";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { RiInformationLine, RiShareBoxFill, RiStore2Fill } from "react-icons/ri";
import ReactPlayer from "react-player";
import { Swiper, SwiperSlide } from "swiper/react";
import { useHomeLayoutContext } from "../../../../layouts/home-layout/provider/home-layout-provider";
import { useScreen } from "../../../../lib/hooks/useScreen";
import { NotifyText } from "../../../shared/common/notify-text";
import { SectionTitle } from "../../../shared/common/section-title";
import { Dialog } from "../../../shared/utilities/dialog/dialog";
import { Button } from "../../../shared/utilities/form";
import { Img } from "../../../shared/utilities/misc";
type Props = {};

export function HomeStreams({ ...props }) {
  const { t } = useTranslation();
  const { streams } = useHomeLayoutContext();
  const [openVideo, setOpenVideo] = useState<{ videoLink: string; shopCode: string }>(null);
  const navigationPrevRef = useRef(null);
  const navigationNextRef = useRef(null);
  const xl = useScreen("xl");
  const md = useScreen("md");
  const xs = useScreen("xs");

  if (streams?.length == 0) return;

  return (
    <div>
      <SectionTitle className="pl-3 border-l-4 xs:ml-0 border-primary-dark">
        {t("Đang phát live stream")}
      </SectionTitle>

      <Swiper
        className="-mx-2"
        slidesPerView={xl ? 4 : md ? 3 : xs ? 2 : 1}
        loop={false}
        autoplay={{
          delay: 5000,
          disableOnInteraction: false,
        }}
        navigation={{
          prevEl: navigationPrevRef.current,
          nextEl: navigationNextRef.current,
        }}
      >
        <>
          <div
            ref={navigationPrevRef}
            className="absolute left-2 top-1/2 pl-0 w-8 h-8 text-white bg-black bg-opacity-70 rounded-full transform -translate-y-1/2 cursor-pointer flex-center z-100"
          >
            <i className="text-lg">
              <FaChevronLeft />
            </i>
          </div>
          <div
            ref={navigationNextRef}
            className="absolute right-2 top-1/2 pr-0 w-8 h-8 text-white bg-black bg-opacity-70 rounded-full transform -translate-y-1/2 cursor-pointer flex-center z-100"
          >
            <i className="text-lg">
              <FaChevronRight />
            </i>
          </div>
        </>

        {streams?.map((item, index) => (
          <SwiperSlide className={`px-1 my-4 w-full rounded-md max-h-70`} key={index}>
            <div className="overflow-hidden rounded-lg border border-gray-100 shadow cursor-pointer">
              <div
                onClick={() => setOpenVideo({ videoLink: item.videoLink, shopCode: item.shopCode })}
                className="overflow-hidden relative"
              >
                <Img
                  ratio169
                  className="w-full rounded-tl-md rounded-tr-md"
                  src={`${item?.image || "/assets/default/default.png"}`}
                />
                {item?.image && (
                  <div className="flex absolute top-0 left-0 w-full h-full animate-ping">
                    <i className="m-auto text-3xl text-danger">
                      <BsPlayCircle />
                    </i>
                  </div>
                )}
                <div className="absolute top-2 left-2 px-2 text-white bg-black bg-opacity-70 rounded-full">
                  {item?.gameName}
                </div>
              </div>

              <div className="p-2 bg-gray-700 rounded-br-md rounded-bl-md">
                <div className="flex flex-row gap-2 items-start">
                  <Img
                    avatar
                    imageClassName="border border-white"
                    className="w-11 h-11 rounded-full"
                    src={`${item.shopLogoUrl || "/assets/default/default.png"}`}
                  />
                  <div className="flex overflow-hidden flex-col">
                    <p className="font-semibold text-gray-100 whitespace-nowrap text-ellipsis">
                      {item?.title}
                    </p>
                    <p className="text-gray-100 whitespace-nowrap text-ellipsis">
                      {item?.shopName}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      <Dialog
        title={t("Video live Stream")}
        hasCloseIcon
        width={600}
        isOpen={!!openVideo}
        onClose={() => setOpenVideo(null)}
        bodyClass="p-4 pt-0"
      >
        <Dialog.Body>
          <NotifyText
            color="blue"
            className="mb-4"
            text={t("Một số video facebook không xem được có thể do bạn chưa đăng nhập Facebook")}
          />
          <ReactPlayer
            url={openVideo?.videoLink}
            width="100%"
            height={`${!xs ? "280px" : "350px"}`}
            controls
            config={{
              youtube: {
                playerVars: { showinfo: 1, origin: "/" },
              },
              file: {
                attributes: {
                  controlsList: "nodownload",
                },
              },
            }}
          />
          <div className="flex flex-col gap-2 justify-center mt-4 w-full sm:flex-row">
            <Button
              icon={<RiStore2Fill />}
              className=""
              href={`/store/${openVideo?.shopCode}`}
              accent
              text={t("Đến cửa hàng")}
            />
            <Button
              icon={<RiShareBoxFill />}
              className=""
              href={openVideo?.videoLink}
              targetBlank
              primary
              text={t("Đến nguồn video")}
            />
            <Button
              icon={<RiInformationLine />}
              iconClassName="text-20"
              className=""
              targetBlank
              danger
              text={t("Tố cáo")}
            />
          </div>
        </Dialog.Body>
      </Dialog>
    </div>
  );
}
