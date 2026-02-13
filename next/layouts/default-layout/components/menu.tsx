import { HiOutlineX } from "react-icons/hi";
import { DialogProps } from "../../../components/shared/utilities/dialog/dialog";
import { Slideout } from "../../../components/shared/utilities/dialog/slideout";
// import { useShopContext } from "../../../lib/providers/shop-provider";
import { Footer } from "../../default-layout/components/footer";

interface Propstype extends DialogProps {}
export function Menu({ ...props }: Propstype) {
  return (
    <>
      <Slideout
        {...props}
        minWidth="84vw"
        maxWidth={300}
        placement="right"
        hasCloseButton={false}
        mobileSizeMode
      >
        <div className="flex flex-col h-full px-3 py-4 ml-auto overflow-y-auto text-white bg-primary max-w-2xs sm:max-w-xs">
          <div className="flex items-center justify-between h-14">
            <span className="text-lg font-bold text-gray-100">Menu</span>
            <button
              className="w-10 h-10 px-0 text-2xl text-gray-100 transform translate-x-3 btn hover:text-white hover:bg-primary-dark"
              onClick={() => props.onClose()}
            >
              <i className="">
                <HiOutlineX />
              </i>
            </button>
          </div>
          <div className="flex-1"></div>
          <Footer className="text-xs text-center text-gray-100 sm:text-base" />
        </div>
      </Slideout>
    </>
  );
}
