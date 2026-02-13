import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { HiOutlineClipboardList } from "react-icons/hi";
import { RiCloseLine } from "react-icons/ri";
import { useScreen } from "../../../lib/hooks/useScreen";
import { useHomeLayoutContext } from "../provider/home-layout-provider";

interface CategoryProps {
  onClose?: () => void;
}
export const Category = ({ onClose }: CategoryProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { categoryGlobalList, categoryGlobal } = useHomeLayoutContext();
  const lg = useScreen("lg");

  const Header = ({ gameType }: { gameType: string }) => {
    return lg ? (
      <div className="flex flex-row items-center justify-start w-full mt-3 mb-2 ">
        <span>
          <HiOutlineClipboardList className="text-xl" />
        </span>
        <div className="mr-3 text-base font-black">{`${t(
          "Dịch vụ"
        )} ${gameType.toLowerCase()}`}</div>
      </div>
    ) : (
      <div className="flex flex-row items-center gap-1 pl-1 my-3 ml-2 border-l-2 bg-primary-light border-primary">
        <i className="text-primary-dark text-18">
          <HiOutlineClipboardList />
        </i>
        <span className="font-semibold text-green-900">{`${t(
          "Dịch vụ"
        )} ${gameType.toLowerCase()}`}</span>
      </div>
    );
  };

  const handleSelectedGame = (gameId: string) => {
    router.replace({
      pathname: "/products",
      query: { gameId },
    });
    onClose && onClose();
  };

  return (
    <>
      {categoryGlobal &&
        categoryGlobalList?.map((type) => {
          return (
            <div key={type.type}>
              <Header gameType={type.type} />
              <div className={`grid gap-2 w-full ${!lg ? "px-2 mr-2 grid-cols-3" : "grid-cols-2"}`}>
                {type.items.map((game) => (
                  <div
                    onClick={() => handleSelectedGame(game.id)}
                    key={game.id}
                    style={{ width: "95px" }}
                    className={`col-span-1 p-1 relative border text-center hover:border-primary-dark hover:bg-gray-100 rounded-md cursor-pointer ${
                      router.query.gameId === game.id
                        ? "border-primary-dark border bg-primary-light"
                        : ""
                    }`}
                  >
                    {router.query.gameId === game.id && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        className="absolute top-0.5 right-0.5 font-bold text-white rounded-full bg-danger text-14"
                      >
                        <i>
                          <RiCloseLine />
                        </i>
                      </div>
                    )}
                    <img src={game.logoUrl} className="object-contain w-full h-10 mx-auto "></img>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
    </>
  );
};
