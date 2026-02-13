import { Player } from "@lottiefiles/react-lottie-player";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiDoubleQuotesL, RiDoubleQuotesR } from "react-icons/ri";
import { Swiper, SwiperSlide } from "swiper/react";
import { useScreen } from "../../../../lib/hooks/useScreen";
import { AuthDialogHeader } from "../../../shared/auth/auth-dialog-header";
import { Dialog } from "../../../shared/utilities/dialog/dialog";
import { Button, Checkbox } from "../../../shared/utilities/form";
import { useHomeContext } from "../provider/home-provider";

export function HomePopupNotify() {
  const { t } = useTranslation();
  const screenMd = useScreen("md");
  const [checkBox, setCheckBox] = useState<boolean>();
  const navigationPrevRef = useRef(null);
  const navigationNextRef = useRef(null);
  const paginationRef = useRef(null);
  const { openHomePopupNotify, setOpenHomePopupNotify } = useHomeContext();
  // Thời hạn 30 ngày
  const expired = 5592000000;

  const date = new Date().getTime();

  const setLoCalStorage = () => {
    localStorage.setItem("home-popup-notify", JSON.stringify(date + expired));
  };

  const onClose = () => {
    setLoCalStorage();
    setOpenHomePopupNotify(false);
  };

  return (
    <>
      <Dialog
        maxWidth={"93vw"}
        isOpen={screenMd && openHomePopupNotify}
        onClose={() => {}}
        slideFromBottom={"none"}
      >
        <div className={`flex p-4 ${!screenMd ? "flex-col" : "flex-row"} `}>
          {screenMd ? (
            <div className="flex-col pt-10">
              <Player
                className=""
                autoplay
                loop
                src={`/assets/lottie/welcome.json`}
                style={{ height: "300px", width: "300px" }}
              ></Player>
            </div>
          ) : (
            <AuthDialogHeader
              title={t("Chào mừng đến với StoreMMO")}
              subtitle={``}
              onClose={() => {}}
              noCloseButton={false}
            />
          )}

          <div
            className={`relative text-center bg-gray-50 p-4 rounded-lg ${
              screenMd ? " w-96 " : "w-full px-1"
            }`}
          >
            {screenMd && (
              <div
                className={`my-3 font-semibold leading-6 text-accent ${
                  screenMd ? "text-24" : "text-20"
                } `}
              >
                {t("Chào mừng đến với StoreMMO")}
              </div>
            )}
            <div className={`my-3  text-accent ${screenMd ? "text-20" : "text-16"} `}>
              {t("Lời ngỏ")}
            </div>
            <Swiper
              navigation={{
                prevEl: navigationPrevRef.current,
                nextEl: navigationNextRef.current,
              }}
              pagination={{
                el: paginationRef.current,
                clickable: true,
                type: "bullets",
                bulletActiveClass: "bg-primary hover:bg-primary-dark w-10",
                bulletClass:
                  "inline-block w-2 h-2 bg-black bg-opacity-60 hover:bg-gray-700 rounded-full transition-all cursor-pointer",
                renderBullet: function (index, className) {
                  return `<span class="${className}"></span>`;
                },
              }}
            >
              <SwiperSlide className="text-center">
                <span className="italic text-16">
                  <RiDoubleQuotesL className="inline" />
                  {t(
                    "Chào các bạn!. Rất vui khi các bạn đến với dịch vụ của chúng tôi. Chúng tôi tiền thân là những trung gian game với hơn 10 năm trong lĩnh vực trung gian game Online. Chúng tôi trăn trở suốt 10 năm qua về vấn nạn lừa đảo trực tuyến ngày càng nhiều và tinh vi mà không có cách nào ngăn chặn, xuất phát từ chính trăn trở ấy chúng tôi muốn giúp ích cho cộng đồng, xã hội và không gian mạng hạn chế thấp nhất tình trạng lừa đảo trực tuyến. Vì thế chúng tôi đã ngày đêm nghiên cứu với nhiều tâm huyết mới tạo nên được sản phẩm này. Rất mong sự ủng hộ từ cộng đồng!."
                  )}
                  <RiDoubleQuotesR className="inline" />
                </span>
              </SwiperSlide>
              <SwiperSlide className="inline text-center">
                <span className="italic text-16">
                  <RiDoubleQuotesL className="inline" />
                  {t(
                    "Chúng tôi nhận thấy việc giao dịch game là nhu cầu có thật của cộng đồng và đã 10 năm trôi qua hiện tại trên thế giới đã chấp nhận giao dịch game như [Singapore, Mỹ, Canada, Nhật, EU...]. Mong luật pháp nước nhà cởi mở hơn về giao dịch game cho phép đơn vị uy tín đăng ký hoạt động và đảm bảo giao dịch game an toàn từ đó thu ngân sách và nguồn tiền không bị chảy ra nước ngoài như hiện nay"
                  )}
                  <RiDoubleQuotesR className="inline" />
                  <p className="mt-2 italic">
                    <RiDoubleQuotesL className="inline" />
                    {t(
                      "Chúng tôi chỉ làm dịch vụ bảo đảm an toàn giao dịch, chờ đợi một ngày luật pháp nước nhà cởi mở hơn với giao dịch game cũng như cởi mở với cá cược bóng đá online"
                    )}{" "}
                    <RiDoubleQuotesR className="inline" />
                  </p>
                </span>
              </SwiperSlide>
              <SwiperSlide className="inline text-center">
                <RiDoubleQuotesL className="inline" />
                <span className="italic">
                  {t(
                    "Chúng tôi cam kết bảo vệ an toàn giao dịch của khách hàng, góp phần giảm thiểu tối đa lừa đảo trên không gian mạng!"
                  )}
                </span>{" "}
                <RiDoubleQuotesR className="inline" />
                <p className="flex flex-row mt-2">
                  <span className="italic font-semibold text-green-700">
                    <RiDoubleQuotesL className="inline" />
                    {t(
                      "Mong khách hàng cùng với chúng tôi tạo nên môi trường không gian mạng không còn lừa đảo tràn lan và tinh vi như hiện nay mà không có cách nào ngăn chặn được"
                    )}{" "}
                    <RiDoubleQuotesR className="inline" />
                  </span>
                </p>
                <div className="">
                  <Checkbox
                    onChange={(value) => {
                      setCheckBox(value);
                    }}
                    className="whitespace-nowrap"
                    placeholder={t("Tôi đã đọc và ủng hộ các bạn!")}
                  />
                  <Button
                    primary
                    text={t("Tôi đồng hành cùng các bạn!")}
                    className="rounded-full whitespace-nowrap"
                    disabled={!checkBox}
                    onClick={() => onClose()}
                  />
                </div>
              </SwiperSlide>
            </Swiper>
            <div
              className="absolute z-50 left-0 w-full gap-1.5 flex-center top-3"
              ref={paginationRef}
            ></div>
            <div className="flex flex-row justify-between w-full gap-2 mt-3">
              <Button
                className="px-4 text-green-700 rounded-full bg-green-50 "
                innerRef={navigationPrevRef}
                stopPropagation
              >
                {`< ${t("Quay lại")}`}
              </Button>

              <Button
                className="px-4 text-green-700 rounded-full bg-green-50"
                innerRef={navigationNextRef}
                stopPropagation
              >
                {`${t("tiếp")} >`}
              </Button>
            </div>
          </div>
        </div>
      </Dialog>
    </>
  );
}
