import { useEffect, useRef, useState } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import ReactPlayer from "react-player";
import { Thumbs } from "swiper";
import SwiperCore, { Autoplay, Navigation, Pagination } from "swiper/core";
import { Swiper, SwiperSlide } from "swiper/react";
import { useScreen } from "../../../../lib/hooks/useScreen";
import { Img } from "../../../shared/utilities/misc";
import { useProductDetailContext } from "../provider/product-detail-provider";
import { ProductImageZoom } from "./product-image-zoom";

SwiperCore.use([Navigation, Pagination, Autoplay, Thumbs]);

export function ProductImgSlider() {
  const xs = useScreen("xs");
  const navigationPrevRef = useRef(null);
  const navigationNextRef = useRef(null);
  const paginationRef = useRef(null);
  const mainSwiperRef = useRef<any>(null);
  const { product, productMedia, registerScrollToImage } = useProductDetailContext();
  const [playing, setPlaying] = useState(false);
  const [thumbsSwiper, setThumbsSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const mediaItems = productMedia || [];

  // Expose method to scroll to image
  useEffect(() => {
    if (registerScrollToImage) {
      const scrollToImageFn = (imageUrl: string, optionCode?: string) => {
        // Wait for swiper to be ready
        if (!mainSwiperRef.current) {
          setTimeout(() => scrollToImageFn(imageUrl, optionCode), 100);
          return;
        }

        // Helper to normalize URLs for comparison
        const normalizeUrl = (url: string) => {
          if (!url) return "";
          try {
            const urlObj = new URL(url);
            return urlObj.origin + urlObj.pathname;
          } catch {
            // If URL parsing fails, just clean the string
            return url.split("?")[0].split("#")[0].replace(/\/$/, "").trim();
          }
        };

        // Find image - first try by optionCode if provided, then by URL
        let index = -1;

        if (optionCode) {
          index = mediaItems.findIndex((img) => img.optionCode === optionCode);
        }

        // If not found by optionCode, try by URL
        if (index === -1) {
          index = mediaItems.findIndex((img) => {
            // Exact match
            if (img.url === imageUrl) return true;
            // Normalized match
            if (normalizeUrl(img.url) === normalizeUrl(imageUrl)) return true;
            // Contains match (for cases where one URL is a subset of another)
            if (img.url.includes(imageUrl) || imageUrl?.includes(img.url)) return true;
            return false;
          });
        }

        if (index !== -1 && mainSwiperRef.current) {
          // Use slideTo with speed for smooth transition
          mainSwiperRef.current.slideTo(index + 1, 300);

          // Update active index after transition
          setTimeout(() => {
            if (mainSwiperRef.current) {
              const realIndex =
                mainSwiperRef.current.realIndex !== undefined
                  ? mainSwiperRef.current.realIndex
                  : index;
              setActiveIndex(realIndex);
            }
          }, 350);
        }
      };
      registerScrollToImage(scrollToImageFn);
    }
  }, [mediaItems, registerScrollToImage]);

  useEffect(() => {
    if (navigationPrevRef.current && navigationNextRef.current) {
      // Swiper needs refs to be set
    }
  }, []);

  // Reset active index when images change (but keep current position if possible)
  useEffect(() => {
    if (mainSwiperRef.current && mediaItems.length > 0) {
      // Don't reset if we're just updating images
      const currentIndex = mainSwiperRef.current.realIndex || 0;
      if (currentIndex < mediaItems.length) {
        setActiveIndex(currentIndex);
      } else {
        setActiveIndex(0);
        mainSwiperRef.current.slideTo(0);
      }
    }
  }, [mediaItems.length]);

  return (
    <div className="w-full h-full">
      <div className="relative overflow-hidden bg-white border border-gray-200 rounded-lg">
        <Swiper
          grabCursor
          loop={mediaItems.length > 1}
          slidesPerView={1}
          spaceBetween={20}
          className="product-main-slider"
          autoplay={
            playing || mediaItems.length <= 1
              ? false
              : {
                  delay: 5000,
                  disableOnInteraction: true,
                }
          }
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
          onSlideChange={(swiper) => {
            setPlaying(false);
            // Use realIndex to handle loop mode correctly
            const realIndex =
              swiper.realIndex !== undefined ? swiper.realIndex : swiper.activeIndex;
            setActiveIndex(realIndex);
          }}
          onSwiper={(swiper) => {
            mainSwiperRef.current = swiper;
            const realIndex =
              swiper.realIndex !== undefined ? swiper.realIndex : swiper.activeIndex;
            setActiveIndex(realIndex);
          }}
        >
          {mediaItems.length > 1 && (
            <>
              <div
                ref={navigationPrevRef}
                className="absolute z-10 flex items-center justify-center w-10 h-10 text-gray-600 transition-all transform -translate-y-1/2 bg-white border border-gray-300 rounded-full shadow-lg cursor-pointer left-2 top-1/2 bg-opacity-90 hover:bg-opacity-100 hover:text-primary hover:border-primary"
              >
                <FaChevronLeft className="w-4 h-4" />
              </div>
              <div
                ref={navigationNextRef}
                className="absolute z-10 flex items-center justify-center w-10 h-10 text-gray-600 transition-all transform -translate-y-1/2 bg-white border border-gray-300 rounded-full shadow-lg cursor-pointer right-2 top-1/2 bg-opacity-90 hover:bg-opacity-100 hover:text-primary hover:border-primary"
              >
                <FaChevronRight className="w-4 h-4" />
              </div>
            </>
          )}
          <div
            className="absolute z-20 w-full gap-1.5 flex items-center justify-center bottom-3"
            ref={paginationRef}
          ></div>

          {mediaItems && mediaItems.length === 0 ? (
            <SwiperSlide>
              <div className="flex items-center justify-center w-full bg-gray-100 aspect-square">
                <ProductImageZoom
                  src="/assets/default/default.png"
                  alt={product?.name || "Product"}
                  className="w-full h-full"
                />
              </div>
            </SwiperSlide>
          ) : (
            mediaItems.map((item, index) => (
              <SwiperSlide key={`${item.type}-${index}-${item.url}`}>
                <div className="flex items-center justify-center w-full h-full p-2">
                  {item.type === "video" ? (
                    <div className={`flex items-center justify-center  xs:mt-24 mt-0`}>
                      <ReactPlayer
                        url={item.url}
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
                    </div>
                  ) : (
                    <ProductImageZoom
                      src={item.url}
                      alt={`${product?.name || "Product"} - Image ${index + 1}`}
                      className="w-full h-full max-w-full max-h-full"
                    />
                  )}
                </div>
              </SwiperSlide>
            ))
          )}
        </Swiper>
      </div>
      {mediaItems.length > 1 && (
        <div className="mt-4">
          <Swiper
            onSwiper={setThumbsSwiper}
            spaceBetween={8}
            slidesPerView={xs ? 4 : 5}
            watchSlidesProgress={true}
            className="product-thumbs-slider"
            breakpoints={{
              640: {
                slidesPerView: 5,
              },
              768: {
                slidesPerView: 6,
              },
            }}
          >
            {mediaItems.map((item, index) => {
              // Calculate correct index for loop mode
              const isActive =
                activeIndex === index ||
                (mediaItems.length > 1 &&
                  mainSwiperRef.current &&
                  mainSwiperRef.current.realIndex === index);

              return (
                <SwiperSlide key={`thumb-${item.type}-${index}-${item.url}`}>
                  <div
                    className={`
                    relative cursor-pointer rounded-lg border-2 overflow-hidden transition-all
                    ${
                      isActive
                        ? "shadow-md border-primary"
                        : "border-gray-200 hover:border-gray-300"
                    }
                  `}
                    onClick={() => {
                      if (mainSwiperRef.current) {
                        mainSwiperRef.current.slideTo(index + 1);
                        // Force update active index
                        setTimeout(() => {
                          const realIndex =
                            mainSwiperRef.current?.realIndex !== undefined
                              ? mainSwiperRef.current.realIndex
                              : index;
                          setActiveIndex(realIndex);
                        }, 100);
                      }
                    }}
                  >
                    {item.type === "video" ? (
                      <div className="relative w-full aspect-square">
                        <Img
                          src={
                            item.url.includes("youtube")
                              ? `https://img.youtube.com/vi/${
                                  new URL(item.url).searchParams.get("v") ||
                                  item.url.split("/").pop()
                                }/hqdefault.jpg`
                              : "/assets/default/default.png"
                          }
                          alt="Video thumbnail"
                          className="object-cover w-full h-full"
                          imageClassName="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                          <div className="flex items-center justify-center w-12 h-12 bg-white rounded-full bg-opacity-90">
                            <svg
                              className="w-6 h-6 ml-1 text-primary"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <Img
                        src={item.url}
                        alt={`Thumbnail ${index + 1}`}
                        className="object-cover w-full aspect-square"
                        imageClassName="w-full h-full object-cover"
                      />
                    )}
                    {isActive && (
                      <div className="absolute inset-0 z-10 border-2 pointer-events-none border-primary" />
                    )}
                  </div>
                </SwiperSlide>
              );
            })}
          </Swiper>
        </div>
      )}
    </div>
  );
}
