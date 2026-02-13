import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaChevronRight } from "react-icons/fa";
import { Thumbs } from "swiper";
import SwiperCore, { Autoplay, Navigation, Pagination } from "swiper/core";
import { Swiper, SwiperSlide } from "swiper/react";
import { useScreen } from "../../../../../lib/hooks/useScreen";
import { useSettingPublic } from "../../../../../lib/hooks/useSettingPublic";
import { useAlert } from "../../../../../lib/providers/alert-provider";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { IconNumber1 } from "../../../../../lib/svg";
import { NotifyText } from "../../../../shared/common/notify-text";
import { Button, Field, Form, Input, Select } from "../../../../shared/utilities/form";
SwiperCore.use([Navigation, Pagination, Autoplay, Thumbs]);
export function ProfileAccountBankInfo({
  setUpdated,
  isDialog,
}: {
  setUpdated?: (value: boolean) => void;
  isDialog?: boolean;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const alert = useAlert();
  const screenLg = useScreen("lg");

  const { loadCustomer, customer } = useAuth();
  const [banks, setBanks] = useState<any[]>([]);
  const [bankData, setBankData] = useState<any>(null);
  const [accountNumber, setAccountNumber] = useState<string>(null);
  const [account, setAccount] = useState<string>(null);
  const [accountName, setAccountName] = useState<string>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<boolean>(false);
  const [playing, setPlaying] = useState(true);
  const [thumbsSwiper, setThumbsSwiper] = useState(null);
  const [bankVerified, setBankVerified] = useState<any>(null);
  const [getVerifyCount, setGetVerifyCount] = useState<number>(0);
  const isVerifyBankSettingAPIKey = useSettingPublic("verify-bank-api-key");
  const isVerifyBankSettingClientID = useSettingPublic("verify-bank-clientID");
  const navigationPrevRef = useRef(null);
  const navigationNextRef = useRef(null);
  const paginationRef = useRef(null);

  useEffect(() => {
    if (getVerifyCount > 2) {
      alert.info(
        t("Kích hoạt nhập thủ công"),
        t(
          "Bạn có thể nhập thủ công số tài khoản và tên chủ tài khoản, hãy nhập chính xác thông tin của bạn, vì mỗi tài khoản chỉ cập nhật 1 lần duy nhất và sẽ sử dụng về sau, Đây là yêu cầu bắt buộc để chống lừa đảo và spam tài khoản !"
        )
      );
    }
  }, [getVerifyCount]);

  const GetBankAccount = async (bin, accountNumber) => {
    if (!bin || !accountNumber) {
      toast.error(t("Thiếu thông tin ngân hàng hoặc số tài khoản, vui lòng nhập đủ"));
      return;
    }
    setLoading(true);
    setFetchError(false);

    const config = {
      method: "post",
      url: "https://api.vietqr.io/v2/lookup",
      headers: {
        "x-client-id": isVerifyBankSettingClientID.value,
        "x-api-key": isVerifyBankSettingAPIKey.value,
        "Content-Type": "application/json",
      },
      data: { bin, accountNumber: accountNumber.trim() },
    };
    await axios(config as any)
      .then(function (response) {
        setAccount(response.data.data.accountName);
        setLoading(false);
        setFetchError(false);
        toast.success(
          `${t("Xác thực tài khoản thành công")} [ ${response.data.data.accountName} ]`
        );
      })
      .catch(function (error) {
        console.log(error);
        setLoading(false);
        setFetchError(true);
        setGetVerifyCount(getVerifyCount + 1);
      });
  };

  return (
    <>
      <Form>
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-full">
            <Swiper
              grabCursor
              loop={true}
              slidesPerView={1}
              spaceBetween={20}
              className="w-full"
              autoplay={{
                delay: 3000,
                disableOnInteraction: true,
              }}
              thumbs={{ swiper: thumbsSwiper }}
              pagination={{
                el: paginationRef.current,
                clickable: true,
                type: "bullets",
                bulletActiveClass: "bg-primary hover:bg-primary-dark w-4",
                bulletClass:
                  "inline-block w-2 h-2 bg-black bg-opacity-60 hover:bg-gray-700 rounded-full transition-all cursor-pointer",
                renderBullet: function (index, className) {
                  return `<span class="${className}"></span>`;
                },
              }}
              navigation={{
                prevEl: navigationPrevRef.current,
                nextEl: navigationNextRef.current,
              }}
              onSlideChange={() => {
                setPlaying(false);
              }}
            >
              {/* <div
                ref={navigationPrevRef}
                className="absolute left-0 top-1/2 pr-2 w-8 h-6 text-gray-600 bg-white bg-opacity-30 rounded-r-full border shadow transform -translate-y-1/2 cursor-pointer flex-center group-hover:text-primary z-100"
              >
                <i className="text-sm">
                  <FaChevronLeft />
                </i>
              </div> */}
              <div
                ref={navigationNextRef}
                className="absolute right-0 top-1/2 pr-0 w-8 h-6 text-gray-600 bg-white bg-opacity-30 rounded-l-full border shadow transform -translate-y-1/2 cursor-pointer flex-center group-hover:text-primary z-100"
              >
                <i className="text-sm">
                  <FaChevronRight />
                </i>
              </div>
              {/* <div
                className="absolute z-50 w-full gap-1.5 flex-center bottom-2"
                ref={paginationRef}
              ></div> */}
              {!customer?.bankVerifiedId && (
                <>
                  <SwiperSlide>
                    <div>
                      <NotifyText
                        className={`w-full px-8 ${!screenLg && "leading-4"}`}
                        color="red"
                        text={t(
                          "Cần cập nhật thêm tài khoản ngân hàng để được kích hoạt tính năng mua hàng, tăng mức độ bảo mật tài khoản!"
                        )}
                      />
                    </div>
                  </SwiperSlide>
                  <SwiperSlide>
                    <div>
                      <NotifyText
                        className={` w-full px-8 ${!screenLg && "leading-4"}`}
                        color="red"
                        text={t(
                          "Yêu cầu này nhầm chống lừa đảo và chống tạo nhiều tài khoản ảo, nên quý khách hàng thông cảm vì sự bất tiện này!"
                        )}
                      />
                    </div>
                  </SwiperSlide>

                  <SwiperSlide>
                    <div>
                      <NotifyText
                        className={` w-full px-8 ${!screenLg && "leading-4"}`}
                        color="red"
                        text={t(
                          "Chỉ cập nhật duy nhất 1 lần/tài khoản/khách hàng và không thể thay đổi, cân nhắc chọn tài khoản ngân hàng!"
                        )}
                      />
                    </div>
                  </SwiperSlide>
                  <SwiperSlide>
                    <div>
                      <NotifyText
                        className={` w-full px-8 ${!screenLg && "leading-4"}`}
                        color="red"
                        text={t(
                          "Chúng tôi đã ký hợp tác với ngân hàng mới có thể tra cứu được stk của các bạn, nên các bạn yên tâm sử dụng!"
                        )}
                      />
                    </div>
                  </SwiperSlide>
                </>
              )}
            </Swiper>
          </div>

          <Field
            noError
            className="flex-1"
            label={t("Ngân hàng")}
            tooltip={t("Danh sách ngân hàng.")}
            required
            cols={screenLg ? 4 : 12}
            readOnly={loading || !!account || !!customer?.bankVerifiedId}
          >
            <Select
              clearable
              hasImage
              defaultValue={bankVerified?.bin}
              value={bankVerified?.bin}
              options={banks}
              placeholder={t("Chọn ngân hàng")}
              onChange={(value, extra) => {
                setBankData(extra?.data);
              }}
            />
          </Field>
          <Field
            readOnly={loading || !!account || !!customer?.bankVerifiedId}
            noError
            className="flex-1"
            label={t("Số tài khoản")}
            required
            cols={screenLg ? 4 : 12}
          >
            <Input
              clearable
              defaultValue={bankVerified?.accountNumber}
              value={bankVerified?.accountNumber}
              placeholder={t("Nhập số tài khoản")}
              onChange={(value) => {
                setAccountNumber(value.trim());
              }}
            />
          </Field>
          <Field
            noError
            className="flex-1"
            label={t("Tên chủ tài khoản")}
            required={getVerifyCount > 2}
            readOnly={getVerifyCount <= 2 || !!customer?.bankVerifiedId}
            cols={screenLg ? 4 : 12}
          >
            <Input
              placeholder={`${
                getVerifyCount > 2 ? t("Vui lòng nhập số tài khoản") : t("Chưa xác thực")
              }`}
              value={account || bankVerified?.accountName}
              onChange={(value) => setAccountName(value)}
            />
          </Field>
          {fetchError && (
            <p
              className={` col-span-full ${
                getVerifyCount <= 2
                  ? "text-red-600"
                  : "text-info bg-blue-50 p-1 rounded-sm border border-blue-500"
              }`}
            >
              {getVerifyCount <= 2
                ? t(
                    "* Không tìm thấy tài khoản ngân hàng của bạn, kiểm tra lại thông tin nhập hoặc do server bận!"
                  )
                : t(
                    "Bạn có thể nhập thủ công số tài khoản và tên chủ tài khoản, hãy nhập chính xác thông tin của bạn, vì mỗi tài khoản chỉ cập nhật 1 lần duy nhất và sẽ sử dụng về sau, Đây là yêu cầu bắt buộc để chống lừa đảo và spam tài khoản !"
                  )}
            </p>
          )}
          {!customer?.bankVerifiedId && (
            <div className="grid grid-cols-12 col-span-full gap-5 mb-5">
              <Button
                onClick={() => GetBankAccount(bankData?.bin, accountNumber)}
                primary
                text={t("Xác thực số tài khoản")}
                icon={
                  <div className="p-1 rounded-full border text-14">
                    <IconNumber1 />
                  </div>
                }
                className={`${screenLg ? "col-span-6" : "col-span-12"}`}
                disabled={loading || !!account || !!customer?.bankVerifiedId || getVerifyCount > 2}
              />
            </div>
          )}
        </div>
      </Form>
    </>
  );
}
