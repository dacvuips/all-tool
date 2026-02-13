import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineDownload, HiOutlineX, HiOutlineZoomIn } from "react-icons/hi";


import { useAuth } from "../../../../lib/providers/auth-provider";
import { useGlobalContext } from "../../../../lib/providers/global-provider";
import { useToast } from "../../../../lib/providers/toast-provider";
import { Dialog } from "../../../shared/utilities/dialog/dialog";
import { Button, Field, Form, ImageInput, Input, Select, Textarea } from "../../../shared/utilities/form";
import { Img, Spinner } from "../../../shared/utilities/misc";
interface TryOnDialogProps {
  isOpen: boolean;
  onClose: () => void;
  productImage?: string;
  guestLimit?: number;
  setGuestLimit?: (limit: number) => void;
}
 

export function TryOnDialog({ isOpen, onClose, productImage, guestLimit, setGuestLimit }: TryOnDialogProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { customer } = useAuth();
  const { setOpenCustomerLoginDialog } = useGlobalContext();
  const [uploadedImage, setUploadedImage] = useState<any>(null);
  const [backgroundImage, setBackgroundImage] = useState<any>(null);
  const [resultImage, setResultImage] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [pose, setPose] = useState("standing");
  const [angle, setAngle] = useState("front");
  const [actualWeight, setActualWeight] = useState<number | "">("");
  const [actualHeight, setActualHeight] = useState<number | "">("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultImageRef = useRef<HTMLDivElement>(null);
 
  // Options for select dropdowns
  const poseOptions = [
    { label: t("Đứng"), value: "standing" },
    { label: t("Ngồi"), value: "sitting" },
    { label: t("Đi bộ"), value: "walking" },
    { label: t("Chạy"), value: "running" },
  ];

  const angleOptions = [
    { label: t("Mặt trước"), value: "front" },
    { label: t("Mặt sau"), value: "back" },
    { label: t("Nghiêng bên hông"), value: "side" },
    { label: t("Chếch 3/4"), value: "three-quarter" },
  ];

  const handleChangeImage = async (e) => {
    setUploadedImage(e);
  };

  const handleDownloadImage = async (imageUrl: string, filename: string) => {
    try {
      const link = document.createElement("a");

      // If it's a data URL, use it directly
      if (imageUrl.startsWith("data:")) {
        link.href = imageUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // For external URLs, always use proxy to avoid CSP/CORS issues
        const response = await fetch(
          `/api/file/download-proxy?url=${encodeURIComponent(imageUrl)}`
        );
        if (!response.ok) throw new Error("Proxy download failed");
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }

      toast.success(t("Đã tải ảnh xuống"));
    } catch (error) {
      console.error("Download error:", error);
      toast.error(t("Không thể tải ảnh xuống"));
    }
  };

  const handleZoomImage = (imageUrl: string) => {
    setZoomedImage(imageUrl);
  };

  const handleTryOn = async () => {
    if (!uploadedImage) {
      fileInputRef.current?.click();
      return;
    }

    if (!productImage) {
      toast.error(t("Không tìm thấy ảnh sản phẩm"));
      return;
    }

    setIsProcessing(true);
    setResultImage("");
    toast.info(t("Đang xử lý thử đồ..."));

    try {
      const requestBody: any = {
        modelImageUrl: uploadedImage, // Use the uploaded link
        garmentImageUrl: productImage, // Use product image URL directly
        prompt: prompt,
        pose: pose,
        angle: angle,
        // Optional: Add customer/product tracking
        customerId: customer?._id,
        // productId: productId,
      };

      // Add optional fields
      if (backgroundImage) {
        requestBody.backgroundImageUrl = backgroundImage;
      }
      if (actualWeight && actualWeight > 0) {
        requestBody.actualWeight = actualWeight;
      }
      if (actualHeight && actualHeight > 0) {
        requestBody.actualHeight = actualHeight;
      }

      // Use URL-based approach instead of base64
      const response = await fetch("/api/file/try-on", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP Error: ${response.status}`);
      }

      const data = await response.json();
      setResultImage(data.resultImage);
      if (data.newLimit !== undefined) {
        setGuestLimit(data.newLimit);
      }
      toast.success(t("Thử đồ thành công!"));
    } catch (error: any) {
      console.error("Try-on error:", error);
      toast.error(t(`Lỗi: ${error.message || "Không thể thử đồ. Vui lòng thử lại."}`));
    } finally {
      setIsProcessing(false);
    }
  };

  // Auto-scroll to result image when it's available
  useEffect(() => {
    if (resultImage && resultImageRef.current) {
      resultImageRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [resultImage]);

 

  const handleClose = () => {
    setUploadedImage(null);
    setBackgroundImage(null);
    setResultImage("");
    setPrompt("");
    setPose("standing");
    setAngle("front");
    setActualWeight("");
    setActualHeight("");
    setZoomedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onClose();
  };

  const ImageResult = ({
    src,
    alt,
    onRemove,
    label,
  }: {
    src: string;
    alt: string;
    onRemove?: () => void;
    label: string;
  }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-gray-700">{label}</span>
        {isProcessing ? (
          <div className="relative flex flex-col items-center justify-center w-full min-h-[400px] border-2 border-primary/20 border-dashed rounded-lg bg-gray-50 overflow-hidden">
            <div className="absolute inset-0 z-0">
              <div
                className="w-full h-full bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-pulse"
                style={{ backgroundSize: "200% 100%" }}
              />
            </div>

            <div className="relative z-10 flex flex-col items-center justify-center gap-2">
              <div className="relative">
          
                <Spinner className="py-2"/>
              </div>
              <div className="flex items-center gap-1 text-lg font-semibold text-primary">
                {t("AI đang tạo ảnh")}
                <span className="flex gap-0.5">
                  <span className="animate-bounce" style={{ animationDelay: "0ms" }}>
                    .
                  </span>
                  <span className="animate-bounce" style={{ animationDelay: "150ms" }}>
                    .
                  </span>
                  <span className="animate-bounce" style={{ animationDelay: "300ms" }}>
                    .
                  </span>
                </span>
              </div>
              <p className="text-sm text-gray-400">{t("Mất khoảng 15-30 giây để hoàn thành")}</p>
            </div>
          </div>
        ) : src ? (
          <div
            className="relative w-full overflow-hidden border border-gray-200 rounded-lg group"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <Img
              showImageOnClick
              contain
              src={src}
              alt={alt}
              className="object-contain w-full h-full"
              imageClassName="w-full h-full object-contain"
            />
            {isHovered && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 transition-opacity bg-opacity-50 bg-black">
                <button
                  type="button"
                  onClick={() => handleZoomImage(src)}
                  className="p-2 transition-colors bg-white rounded-full shadow-lg hover:bg-gray-100"
                  title={t("Phóng to")}
                >
                  <HiOutlineZoomIn className="w-5 h-5 text-gray-700" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadImage(src, `${alt}.png`)}
                  className="p-2 transition-colors bg-white rounded-full shadow-lg hover:bg-gray-100"
                  title={t("Tải xuống")}
                >
                  <HiOutlineDownload className="w-5 h-5 text-gray-700" />
                </button>
                {onRemove && (
                  <button
                    type="button"
                    onClick={onRemove}
                    className="p-2 transition-colors bg-white rounded-full shadow-lg hover:bg-gray-100"
                    title={t("Xóa")}
                    disabled={isProcessing}
                  >
                    <HiOutlineX className="w-5 h-5 text-gray-700" />
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="relative flex items-center justify-center w-full min-h-[200px] transition-colors border-2 border-gray-300 border-dashed rounded-lg cursor-pointer ">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="py-1 text-sm font-semibold text-gray-500">{t("Chưa có kết quả ảnh")}</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Form
      dialog 
      isOpen={isOpen}
      onClose={handleClose}
      slideFromBottom="none"
      width="500px"
      title={t("Thử đồ ảo")}
      hasCloseIcon
      onSubmit={handleTryOn}
    >
     
        <div className="flex flex-col gap-4">
          <div className="text-sm text-gray-600">
            {t(
              "Tải ảnh của bạn lên để thử đồ. Hệ thống AI sẽ tự động áp dụng sản phẩm lên ảnh của bạn."
            )}
          </div>  
           <div ref={resultImageRef} className="col-span-12">
<ImageResult src={resultImage} alt="Result" label={`${t("Kết quả")}:`} />
            </div>
            {/* Product Image Preview */}
            <div className="grid grid-cols-12 gap-2">
              {productImage && (
                
                  <Field label={t("Ảnh sản phẩm:")}>
                    <Img
                      showImageOnClick
                      src={productImage}
                      alt="Product"
                      className="object-contain w-14 h-14"
                    />
                  </Field>
                
              )}
              <Field label={t("Ảnh của bạn:")} required>
                <ImageInput
                  onChange={handleChangeImage}
                  readOnly={isProcessing}
                  placeholder={t("Link ảnh hoặc tải ảnh lên")}
                />
              </Field>

              {/* Background Image */}
              {/* <Field label={t("Ảnh nền (Tùy chọn):")}>
                <ImageInput
                  onChange={setBackgroundImage}
                  readOnly={isProcessing}
                  placeholder={t("Link ảnh hoặc tải ảnh lên")}
                />
              </Field> */}
             
            <Form.Title title={t("Tùy chọn nâng cao")} /> 
          
              {/* Pose Selection */}
              <Field label={t("Tư thế:")} cols={6}>
                <Select
                  value={pose}
                  onChange={(value) => setPose(value)}
                  readOnly={isProcessing}
                  options={poseOptions}
                  placeholder={t("Chọn tư thế")}
                />
              </Field>

              {/* Angle Selection */}
              <Field label={t("Góc nhìn:")} cols={6}>
                <Select
                  value={angle}
                  onChange={(value) => setAngle(value)}
                  readOnly={isProcessing}
                  options={angleOptions}
                  placeholder={t("Chọn góc nhìn")}
                />
              </Field>

              {/* Weight Input */}
              <Field label={t("Cân nặng (kg):")} cols={6}>
                <Input
                  type="number"
                  placeholder={t("Ví dụ: 65")}
                  value={actualWeight}
                  onChange={(value) => setActualWeight(value ? Number(value) : "")}
                  readOnly={isProcessing}
                />
              </Field>

              {/* Height Input */}
              <Field label={t("Chiều cao (cm):")} cols={6}>
                <Input
                  type="number"
                  placeholder={t("Ví dụ: 170")}
                  value={actualHeight}
                  onChange={(value) => setActualHeight(value ? Number(value) : "")}
                  readOnly={isProcessing}
                />
              </Field>
           
            {/* Prompt Input */}
            <Field label={t("Mô tả chi tiết (Tùy chọn):")} className="mt-4">
              <Textarea 
                rows={2}
                placeholder={t("Ví dụ: Make the garment appear slightly oversized...")}
                value={prompt}
                onChange={(value) => setPrompt(value)}
                readOnly={isProcessing}
              />
            </Field>
 
            </div> 
          {/* Action Buttons */}
          <div className="flex gap-3 mt-4">
            <Form.Footer
              className="flex-1"
              submitText={
                isProcessing
                  ? t("Đang xử lý...")
                  : uploadedImage
                  ? `${t("Thử đồ ngay")} (${t("Còn")} ${guestLimit || 0} ${t("lượt")})`
                  : t("Tải ảnh lên")
              }
              cancelText=""
              submitProps={{
                disabled: isProcessing || !uploadedImage || guestLimit === 0,
              }}
            />
          </div>

          {/* Info */}
    {guestLimit ===0 && (
          <div className="p-3 rounded-lg bg-blue-50">
            <p className="text-xs text-warn-700">
              {customer ? (
                <>
                  {t("💡 Khi hết lượt thử, vui lòng")}{" "}
                  <span
                    className="font-bold underline cursor-pointer"
                    onClick={() => handleClose()}
                  >
                    {t("mua hàng")}
                  </span>{" "}
                  {t("để được thêm lượt thử.")}
                </>
              ) : (
                <>
                  {t("💡 Khi hết lượt thử, vui lòng")}{" "}
                  <span
                    className="font-bold underline cursor-pointer"
                    onClick={() => setOpenCustomerLoginDialog(true)}
                  >
                    {t("đăng nhập")}
                  </span>{" "}
                  {t("để có thêm lượt thử.")}
                </>
              )}
            </p>
          </div>
            )}  
            <div className="p-3 rounded-lg bg-blue-50">
            <p className="text-xs text-blue-700">
              {t("💡 Mẹo: Sử dụng ảnh rõ nét, đứng thẳng, ánh sáng tốt để có kết quả tốt nhất.")}
            </p>
          </div>
        </div>
      

      {/* Zoom Dialog */}
      {zoomedImage && (
        <Dialog
          isOpen={true}
          onClose={() => setZoomedImage(null)}
          width="90vw"
          maxWidth="1200px"
          title={t("Xem ảnh")}
          hasCloseIcon
          
        >
          <Dialog.Body>
            <div className="flex items-center justify-center p-4">
              <Img
                src={zoomedImage}
                alt="Zoomed"
                className="object-contain w-full h-auto max-h-[80vh]"
                imageClassName="w-full h-full object-contain"
              />
            </div>
            <div className="flex justify-center gap-3 mt-4">
              <Button
                primary
                text={t("Tải xuống")}
                icon={<HiOutlineDownload />}
                onClick={() => handleDownloadImage(zoomedImage, "image.png")}
              />
              <Button outline text={t("Đóng")} onClick={() => setZoomedImage(null)} />
            </div>
          </Dialog.Body>
        </Dialog>
      )}
    </Form>
  );
}
