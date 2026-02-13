import { ReactNode, memo, useEffect, useRef, useState } from "react";
import { getRandomNumberByRange, square, sum } from "./tool";

interface VertifyType {
  spliced: boolean;
  verified: boolean;
  left: number;
  destX: number;
}
export interface IVertifyProp {
  /**
   * @description
   * @default       320
   */
  width?: number;
  /**
   * @description
   * @default       160
   */
  height?: number;
  /**
   * @description
   * @default       42
   */
  l?: number;
  /**
   * @description
   * @default       9
   */
  r?: number;
  /**
   * @description
   * @default       true
   */
  visible?: boolean;
  /**
   * @description
   * @default
   */
  text?: string | ReactNode;
  /**
   * @description
   * @default       -
   */
  refreshIcon?: string;
  /**
   * @description
   * @default       https://picsum.photos/${id}/${width}/${height},
   */
  imgUrl?: any[];
  /**
   * @description
   * @default       ():void => {}
   */
  onSuccess?: VoidFunction;
  /**
   * @description
   * @default       ():void => {}
   */
  onFail?: VoidFunction;
  /**
   * @description
   * @default       ():void => {}
   */
  onRefresh?: VoidFunction;
  /**
   * @description
   * @default       (l: number):void => {}
   */
  onDraw?: (l: number) => {};
  /**
   * @description
   * @default       (arg: VertifyType) => VertifyType
   */
  onCustomVertify?: (arg: VertifyType) => VertifyType;

  loadingText?: string; // Chữ phần loading lại hình khác
  canvasAreaStyle?: any; //Style cho phần khung canvas
  sliderTextStyle?: any; // Style cho phần chữ dưới slider
  sliderIconColor?: string; // Màu cho phần icon slider
  sliderColor?: string; // màu cho phần slider
  backgroundLinearGradientGlass?: string; //linear-gradient(90deg, rgba(2,0,36,0) 0%, rgba(247,4,4,1) 0%, rgba(255,253,253,0) 0%, rgba(156,158,156,0.7903536414565826) 100%)
  slideGlassSpeed?: number; // Tốc độ chạy của phần slide
  slideGlassBorderRadius?: string; // Viền border cho phần gương vậy
  sliderWidth?: number; //Chiều dài phanaf slider
  resultSliderStyle?: any; // style cho phần kết quả slider
  resultSuccessText?: string; // Chữ phần kết quả thành công
  resultFailText?: string; // Chữ phần kết quả thất bại
}

export default memo(
  ({
    width = 320,
    height = 160,
    l = 42,
    r = 9,
    imgUrl,
    text,
    refreshIcon = "https://i.imgur.com/43Im71N.png",
    visible = true,
    sliderWidth,
    slideGlassBorderRadius,
    backgroundLinearGradientGlass,
    slideGlassSpeed,
    sliderColor,
    sliderIconColor,
    sliderTextStyle,
    loadingText,
    resultSliderStyle,
    resultSuccessText,
    resultFailText,
    canvasAreaStyle,
    onDraw,
    onCustomVertify,
    onSuccess,
    onFail,
    onRefresh,
  }: IVertifyProp) => {
    const [isLoading, setLoading] = useState(false);
    const [sliderLeft, setSliderLeft] = useState(0);
    const [sliderClass, setSliderClass] = useState("sliderContainer");
    const [textTip, setTextTip] = useState(text);
    const [resultText, setResultText] = useState<string>("");
    const [result, setResult] = useState<string>("result");
    const canvasRef = useRef<any>(null);
    const blockRef = useRef<HTMLCanvasElement | null>(null);
    const imgRef = useRef<any>(null);
    const isMouseDownRef = useRef<boolean>(false);
    const trailRef = useRef<number[]>([]);
    const originXRef = useRef<number>(0);
    const originYRef = useRef<number>(0);
    const xRef = useRef<number>(0);
    const yRef = useRef<number>(0);
    const PI = Math.PI;
    const L = l + r * 2 + 3;

    const drawPath = (ctx: any, x: number, y: number, operation: "fill" | "clip") => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x + l / 2, y - r + 2, r, 0.72 * PI, 2.26 * PI);
      ctx.lineTo(x + l, y);
      ctx.arc(x + l + r - 2, y + l / 2, r, 1.21 * PI, 2.78 * PI);
      ctx.lineTo(x + l, y + l);
      ctx.lineTo(x, y + l);
      ctx.arc(x + r - 2, y + l / 2, r + 0.4, 2.76 * PI, 1.24 * PI, true);
      ctx.lineTo(x, y);
      ctx.lineWidth = 2;
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      ctx.stroke();
      ctx.globalCompositeOperation = "destination-over";
      operation === "fill" ? ctx.fill() : ctx.clip();
    };

    const getRandomImgSrc = () => {
      const random = Math.floor(Math.random() * imgUrl.length);
      const imageRandom = imgUrl[random];
      return (
        imageRandom ||
        `https://picsum.photos/id/${getRandomNumberByRange(0, 1084)}/${width}/${height}`
      );
    };

    const createImg = (onload: VoidFunction) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = onload;
      img.onerror = () => {
        (img as any).setSrc(getRandomImgSrc());
      };

      (img as any).setSrc = (src: string) => {
        const isIE = window.navigator.userAgent.indexOf("Trident") > -1;
        if (isIE) {
          const xhr = new XMLHttpRequest();
          xhr.onloadend = function (e: any) {
            const file = new FileReader(); //
            file.readAsDataURL(e.target.response);
            file.onloadend = function (e) {
              img.src = e?.target?.result as string;
            };
          };
          xhr.open("GET", src);
          xhr.responseType = "blob";
          xhr.send();
        } else img.src = src;
      };

      (img as any).setSrc(getRandomImgSrc());
      return img;
    };

    const draw = (img: HTMLImageElement) => {
      const canvasCtx = canvasRef.current?.getContext("2d");
      const blockCtx = blockRef.current?.getContext("2d");

      xRef.current = getRandomNumberByRange(L + 10, width - (L + 10));
      yRef.current = getRandomNumberByRange(10 + r * 2, height - (L + 10));
      canvasCtx && drawPath(canvasCtx, xRef.current, yRef.current, "fill");
      blockCtx && drawPath(blockCtx, xRef.current, yRef.current, "clip");

      canvasCtx?.drawImage(img, 0, 0, width, height);
      blockCtx?.drawImage(img, 0, 0, width, height);

      const y1 = yRef.current - r * 2 - 1;
      const ImageData = blockCtx.getImageData(xRef.current - 3, y1, L, L);
      blockRef.current.width = L;
      blockCtx.putImageData(ImageData, 0, y1);
    };

    const initImg = () => {
      const img = createImg(() => {
        setLoading(false);
        draw(img);
      });
      imgRef.current = img;
    };

    const reset = () => {
      const canvasCtx = canvasRef.current?.getContext("2d");
      const blockCtx = blockRef.current?.getContext("2d");

      setSliderLeft(0);
      setResult("result");
      setSliderClass("sliderContainer");
      blockRef.current.width = width;
      blockRef.current.style.left = 0 + "px";

      canvasCtx.clearRect(0, 0, width, height);
      blockCtx.clearRect(0, 0, width, height);

      setLoading(true);
      imgRef.current.setSrc(getRandomImgSrc());
    };

    const handleRefresh = () => {
      reset();
      typeof onRefresh === "function" && onRefresh();
    };

    const verify = () => {
      const arr = trailRef.current;
      const average = arr.reduce(sum) / arr.length;
      const deviations = arr.map((x) => x - average);
      const stddev = Math.sqrt(deviations.map(square).reduce(sum) / arr.length);
      const left = parseInt(blockRef.current.style.left);
      const percent = ((left / xRef.current) * 100).toFixed(1);
      setResultText(percent);
      return {
        spliced: +percent < 105 && +percent > 95,
        verified: stddev !== 0,
        left,
        destX: xRef.current,
      };
    };

    const handleDragStart = function (e: any) {
      originXRef.current = e.clientX || e.touches[0].clientX;
      originYRef.current = e.clientY || e.touches[0].clientY;
      isMouseDownRef.current = true;
    };

    const handleDragMove = (e: any) => {
      if (!isMouseDownRef.current) return false;
      e.preventDefault();
      const eventX = e.clientX || e.touches[0].clientX;
      const eventY = e.clientY || e.touches[0].clientY;
      const moveX = eventX - originXRef.current;
      const moveY = eventY - originYRef.current;
      if (moveX < 0 || moveX + (sliderWidth || 60) + 2 >= width) return false;
      setSliderLeft(moveX);
      const blockLeft = ((width - 40) / (width - (sliderWidth || 60) + 2)) * moveX;
      blockRef.current.style.left = blockLeft + "px";

      setSliderClass("sliderContainer sliderContainer_active");
      trailRef.current.push(moveY);
      onDraw && onDraw(blockLeft);
    };

    const handleDragEnd = (e: any) => {
      if (!isMouseDownRef.current) return false;
      isMouseDownRef.current = false;
      const eventX = e.clientX || e.changedTouches[0].clientX;
      if (eventX === originXRef.current) return false;
      setSliderClass("sliderContainer");
      setResult("result");
      const { spliced, verified } = onCustomVertify ? onCustomVertify(verify()) : verify();
      if (spliced) {
        if (verified) {
          setSliderClass("sliderContainer sliderContainer_success");
          setResult("result result_success");
          typeof onSuccess === "function" && onSuccess();
        } else {
          setSliderClass("sliderContainer sliderContainer_fail");

          setTextTip("Vuốt sang phải");
          reset();
        }
      } else {
        setSliderClass("sliderContainer sliderContainer_fail");
        setResult("result result_fail");
        typeof onFail === "function" && onFail();
        setTimeout(reset.bind(this), 1000);
      }
    };

    useEffect(() => {
      if (visible) {
        imgRef.current ? reset() : initImg();
      }
    }, [visible]);

    return (
      <div
        className="overflow-hidden vertifyWrap"
        style={{
          width: width + "px",
          margin: "0 auto",
          display: visible ? "" : "none",
        }}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
      >
        <div className=" canvasArea">
          <canvas
            className="canvasArea_item"
            ref={canvasRef}
            width={width}
            height={height}
            style={canvasAreaStyle}
          ></canvas>
          <canvas
            ref={blockRef}
            className="block"
            width={width}
            height={height}
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
          ></canvas>
        </div>
        <div className={result}>
          <div className={"resultSlider"} style={resultSliderStyle}>
            {result &&
              (result.includes("result_success") == true
                ? resultSuccessText || "Success "
                : resultFailText || "Fail ") +
                resultText +
                "%"}
          </div>
        </div>
        <div
          className={sliderClass}
          style={{
            pointerEvents: isLoading ? "none" : "auto",
            width: width + "px",
            borderRadius: 50 + "px",
            overflow: "hidden",
          }}
        >
          <div
            className="glass"
            style={{
              borderRadius: slideGlassBorderRadius,
              background: backgroundLinearGradientGlass,
              animation: `slide-glass ${slideGlassSpeed || 2}s linear infinite`,
            }}
          ></div>
          <div
            className="sliderMask"
            style={{ width: sliderLeft + 40 + "px", borderRadius: 50 + "px" }}
          >
            <div
              className="slider"
              style={{
                left: sliderLeft + "px",
                borderRadius: 50 + "px",
                width: sliderWidth + "px",
                backgroundColor: sliderColor,
              }}
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
            >
              <div
                className="sliderIcon"
                style={{ color: sliderIconColor, borderRadius: 50 + "px" }}
              >
                {"\u27A4"}
              </div>
            </div>
          </div>
          <div className="sliderText" style={sliderTextStyle}>
            {textTip}
          </div>
        </div>
        <div
          className="refreshIcon"
          onClick={handleRefresh}
          style={{ backgroundImage: `url(${refreshIcon})` }}
        ></div>
        <div
          className="loadingContainer"
          style={{
            width: width + "px",
            height: height + "px",
            display: isLoading ? "" : "none",
          }}
        >
          <div className="loadingIcon"></div>
          <span>{loadingText || "Loading..."}</span>
        </div>
      </div>
    );
  }
);
