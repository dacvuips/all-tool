import Link from "next/link";
import SwiperCore, { Autoplay, Navigation } from "swiper/core";
import { Swiper, SwiperSlide } from "swiper/react";
import { useScreen } from "../../../lib/hooks/useScreen";
import { Img } from "../utilities/misc";
SwiperCore.use([Autoplay, Navigation]);

interface Props extends ReactProps {
  items: { image: string; name: string; href: string }[];
}
export function CircleSwiper({ items, ...props }: Props) {
  const screenXs = useScreen("sm");
  const screenMd = useScreen("md");
  const screenLg = useScreen("lg");

  return (
    <Swiper
      slidesPerView={screenLg ? 8 : screenMd ? 6 : screenXs ? 4 : 3}
      grabCursor={true}
      loop
      autoplay={{
        delay: 5000,
        disableOnInteraction: false,
      }}
    >
      {items?.map((item) => (
        <SwiperSlide key={item.name} className="w-24">
          <Link
            href={item.href}
            shallow={true}
            {...(item.href.startsWith("http") ? { target: "_blank" } : {})}
            className="flex flex-col items-center p-3 text-xs cursor-pointer sm:text-sm group"
          >
            <Img
              src={item?.image}
              className="w-20 bg-white border border-gray-100 rounded-full shadow-md xl:w-24"
            />
            <div className="mt-2.5 font-semibold text-center whitespace-pre-wrap text-accent group-hover:text-primary">
              {item?.name}
            </div>
          </Link>
        </SwiperSlide>
      ))}
    </Swiper>
  );
}
