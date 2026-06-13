import Link from "next/link";
import { useRef } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import SwiperCore, { Autoplay, Navigation, Pagination } from "swiper/core";
import { Swiper, SwiperSlide } from "swiper/react";
import { useCrud } from "../../../../lib/hooks/useCrud";
import { useScreen } from "../../../../lib/hooks/useScreen";
import { Banner, BannerService } from "../../../../lib/repo/list/banner.repo";

SwiperCore.use([Pagination, Autoplay, Navigation]);
export function HomeBanners({ ...props }) {
  const lg = useScreen("lg");
  const xl = useScreen("xl");
  const xs = useScreen("xs");

  const bannerCrud = useCrud(BannerService, {
    limit: 100,
    filter: { isPublic: true, position: { $in: ["Top", "TopRight"] } },

    order: { priority: -1 },
  });

  const navigationPrevRef = useRef(null);
  const navigationNextRef = useRef(null);
  const paginationRef = useRef(null);

  if (!bannerCrud.items?.length) return <></>;
  const topBanners = bannerCrud.items.filter((item) => item.position === "Top");

  // filter top right banners and limit to 2
  const topRighBanners = bannerCrud.items
    .filter((item) => item.position === "TopRight")
    .slice(0, 2);

  if (!topBanners) return <></>;
  return (
    <section>
      <div
        style={{ maxWidth: "1800px" }}
        className={`grid grid-cols-2 gap-2  grid-row-3  w-full  ${!xs ? "-mx-1" : ""}`}
      >
        <div className="col-span-2 row-span-2 lg:col-span-2">
          <Swiper
            className={`relative w-full`}
            slidesPerView={1}
            spaceBetween={28}
            // grabCursor
            loop={true}
            autoplay={{
              delay: 5000,
              disableOnInteraction: false,
            }}
            pagination={{
              el: paginationRef.current,
              clickable: true,
              type: "bullets",
              bulletActiveClass: `bg-primary hover:bg-primary-dark ${xl && "w-4"}`,
              bulletClass: `inline-block w-2 h-2 bg-gray-100 hover:bg-white rounded-full transition-all cursor-pointer`,
              renderBullet: function (index, className) {
                return `<span class="${className}"></span>`;
              },
            }}
            // freeMode={false}
            navigation={{
              prevEl: navigationPrevRef.current,
              nextEl: navigationNextRef.current,
            }}
          >
            {lg && (
              <>
                <div
                  ref={navigationPrevRef}
                  className="absolute left-2 top-1/2 pl-0 w-8 h-9 text-white transform -translate-y-1/2 cursor-pointer flex-center z-100"
                >
                  <i className="text-lg">
                    <FaChevronLeft />
                  </i>
                </div>
                <div
                  ref={navigationNextRef}
                  className="absolute right-2 top-1/2 pr-0 w-8 h-9 text-white transform -translate-y-1/2 cursor-pointer flex-center z-100"
                >
                  <i className="text-lg">
                    <FaChevronRight />
                  </i>
                </div>
              </>
            )}
            <div
              className={`absolute z-50 w-full gap-1.5 flex-center ${
                !lg ? "bottom-2" : "bottom-4"
              }`}
              ref={paginationRef}
            />
            {topBanners.map((item: Banner, index) => (
              <SwiperSlide className={`w-full   ${xs ? "rounded-md" : ""}`} key={index}>
                <Link
                  href={getBannerHref(item)}
                  {...(item.actionType == "WEBSITE" ? { target: "_blank" } : {})}
                >
                  <img src={item.image} className={`w-full    ${xs ? "rounded-md" : ""}`}></img>
                </Link>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>

        {/* <div
          className="hidden rounded-md shadow-sm sm:block"
          style={{
            minHeight: "auto",
            width: "100%",
            backgroundImage: `url("https://honglinhhatinh.com/wp-content/uploads/2021/04/banner-quang-cao-cua-lazada.jpg")`,
            backgroundSize: "cover",
          }}
        ></div> */}
      </div>{" "}
    </section>
  );
}

export const getBannerHref = (item: Banner) => {
  switch (item.actionType) {
    case "NORMAL":
      return ``;
    case "WEBSITE":
      return item.link;
  }
};
