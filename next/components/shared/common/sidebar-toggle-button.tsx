import { HiChevronLeft, HiChevronRight } from "react-icons/hi";

interface SidebarToggleButtonProps {
  toggleSidebar?: boolean;
  setToggleSidebar: (value?: boolean) => void;
}
export const SidebarToggleButton = ({
  setToggleSidebar,
  toggleSidebar,
}: SidebarToggleButtonProps) => {
  return (
    <>
      <div className="absolute z-10 w-3 text-center bg-white shadow-sm cursor-pointer rounded-tr-md rounded-br-md h-18 -right-3 top-1/3"></div>
      <div
        style={{ right: "-14px" }}
        className="absolute z-10 py-6 cursor-pointer top-1/3"
        onClick={() => {
          setToggleSidebar(!toggleSidebar);
        }}
      >
        {toggleSidebar ? (
          <HiChevronLeft className="text-20 text-orange" />
        ) : (
          <HiChevronRight className="text-20 text-orange" />
        )}
      </div>
    </>
  );
};
