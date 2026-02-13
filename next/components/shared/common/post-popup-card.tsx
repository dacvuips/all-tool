import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BsQuestion } from "react-icons/bs";
import { RiCloseCircleLine } from "react-icons/ri";
import { useScreen } from "../../../lib/hooks/useScreen";
import { Img } from "../utilities/misc";

export function PostPopupCard({ postPopup }) {
  const { t } = useTranslation();
  const screenXs = useScreen("xs");
  const [openPostPopupCard, setOpenPostPopupCard] = useState<boolean>(true);
  const [openPostPopupBigCard, setOpenPostPopupBigCard] = useState<boolean>(true);
  useEffect(() => {
    if (!screenXs) {
      setOpenPostPopupBigCard(false);
    } else setOpenPostPopupBigCard(true);
  }, [screenXs]);
  return (
    <>
      {!!postPopup &&
        openPostPopupCard &&
        (openPostPopupBigCard ? (
          <div className="absolute p-2 bg-white border rounded-lg cursor-pointer hover:bg-gray-50 left-3 bottom-8">
            <Link href={`/post/${postPopup.slug}`} onClick={() => setOpenPostPopupCard(false)}>
              <div className="flex flex-row items-start w-80">
                <Img
                  lazyload={false}
                  ratio169
                  contain
                  className="w-24"
                  src={postPopup?.featureImage}
                />
                <div className="flex-col flex-1 ml-2">
                  <span className="mb-1 font-semibold leading-4 max-w-80 text-ellipsis-2 text-14">
                    <span className="px-0.5 text-green-700 rounded-full text-10 font-semibold bg-primary-light">
                      {t("MẸO")}
                    </span>{" "}
                    {postPopup?.title}
                  </span>
                  <span className="leading-4 text-gray-600 text-12 max-w-80 text-ellipsis-2">
                    {postPopup?.excerpt}
                  </span>
                </div>
              </div>
            </Link>
            <i
              onClick={() => setOpenPostPopupCard(false)}
              className="absolute text-gray-600 bg-white rounded-full hover:text-red-500 -top-2 -left-2 text-24 "
            >
              <RiCloseCircleLine />
            </i>
          </div>
        ) : (
          <div className="absolute p-1 font-light text-white rounded-full cursor-pointer text-32 bg-primary left-4 bottom-4">
            <i
              onClick={() => {
                setOpenPostPopupBigCard(true);
              }}
            >
              <BsQuestion />
            </i>
            <i
              onClick={() => setOpenPostPopupCard(false)}
              className="absolute text-red-700 rounded-full bg-red-50 -top-3 -right-3 text-18 "
            >
              <RiCloseCircleLine />
            </i>
          </div>
        ))}
    </>
  );
}
