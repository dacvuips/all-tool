import { Swiper, SwiperSlide } from "swiper/react";
// import { useScreen } from "../../../../lib/hooks/useScreen";
// import { ProductItem } from "../../../shared/common/product-item";
// import { SectionTitle } from "../../../shared/common/section-title";
// import { Button } from "../../../shared/utilities/form";
// import { Spinner } from "../../../shared/utilities/misc";
// import { useShopsContext } from "../../shops/providers/shops-provider";

type Props = {};

export function HomeSelling({}: Props) {
  // const screenSm = useScreen("sm");
  // const screenMd = useScreen("md");
  // const screenLg = useScreen("lg");
  // const { products } = useShopsContext();
  // return (
  //   <section className="main-container">
  //     <div className="flex flex-row items-center justify-between">
  //       <SectionTitle>Quan tâm nhiều</SectionTitle>
  //       <Button
  //         text="Xem thêm"
  //         href={"/products"}
  //         className="px-1 text-sm text-primary md:text-base"
  //       />
  //     </div>
  //     <div className="mt-1">
  //       {!products ? (
  //         <Spinner />
  //       ) : (
  //         <>
  //           {!screenLg ? (
  //             <Swiper
  //               slidesPerView={screenMd ? 4 : screenSm ? 3 : 2}
  //               spaceBetween={16}
  //               grabCursor
  //               loop
  //               autoplay={{ delay: 3000, disableOnInteraction: false }}
  //               freeMode={false}
  //             >
  //               <div className="grid auto-rows-fr auto-cols-fr">
  //                 {products.slice(0, 5).map((product, index) => (
  //                   <SwiperSlide className="h-auto" key={index}>
  //                     <ProductItem product={product} />
  //                   </SwiperSlide>
  //                 ))}
  //               </div>
  //             </Swiper>
  //           ) : (
  //             <div className="grid grid-cols-5 gap-5">
  //               {products.slice(0, 5).map((product, index) => (
  //                 <ProductItem product={product} key={index} />
  //               ))}
  //             </div>
  //           )}
  //           {}
  //         </>
  //       )}
  //     </div>
  //   </section>
  // );
}
