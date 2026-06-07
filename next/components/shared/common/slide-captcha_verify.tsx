import { useTranslation } from "react-i18next";
import SlideVertify from "../../../lib/helpers/slide-vertify";
import { useToast } from "../../../lib/providers/toast-provider";
import { Dialog } from "../utilities/dialog/dialog";
export function SlideCaptchaVerifyDialog({
  width = 320,
  height = 200,
  openSlideVerify,
  setOpenSlideVerify,
  onSuccess,
  onFail,
}: {
  width?: number;
  height?: number;
  openSlideVerify?: any;
  setOpenSlideVerify?: (value: any) => void;
  onSuccess?: () => void;
  onFail?: () => void;
}) {
  const toast = useToast();
  const { t } = useTranslation();
  return (
    <Dialog
      bodyClass="relative p-5 bg-white rounded-2xl md:pb-5 pb-14"
      isOpen={openSlideVerify}
      onClose={() => setOpenSlideVerify(undefined)}
    >
      <Dialog.Body>
        <div className="mb-2 w-full font-semibold text-center text-gray-500 uppercase">
          {t("xác thực bảo mật")}
        </div>
        <SlideVertify
          width={width}
          height={height}
          // resultHeight={25}
          r={Math.floor(Math.random() * 11)}
          imgUrl={[
            "/assets/img/verify-image-4.jpg",
            "/assets/img/verify-image-2.jpg",
            "/assets/img/verify-image-3.jpg",
          ]}
          text={t("Vuốt sang phải")}
          resultSuccessText={t("Thành công")}
          resultFailText={t("Thất bại")}
          sliderIconColor="#757575"
          canvasAreaStyle={{ borderRadius: "10px", border: "1px solid #fff" }}
          sliderTextStyle={{ fontSize: "20px", color: "#fb9420" }}
          // sliderColor="rgb(233, 232, 232)"
          // backgroundLinearGradientGlass="transparent"
          slideGlassSpeed={1.5}
          // sliderWidth={70}
          resultSliderStyle={{}}
          onFail={onFail || (() => toast.error(t("Xác thực bảo mật thất bại")))}
          onSuccess={onSuccess || (() => toast.success(t("Xác thực thành công")))}
        />
      </Dialog.Body>
    </Dialog>
  );
}
