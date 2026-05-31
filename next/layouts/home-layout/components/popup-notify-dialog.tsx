import DOMPurify from "dompurify";
import { PopupNotifyActionType, PopupNotifyTypeEnum } from "../../../lib/repo/types";

import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { HiOutlineX } from "react-icons/hi";
import { VideoDialog } from "../../../components/shared/common/video-dialog";
import { Dialog } from "../../../components/shared/utilities/dialog/dialog";
import { Img } from "../../../components/shared/utilities/misc";
import { useScreen } from "../../../lib/hooks/useScreen";
import { useHomeLayoutContext } from "../provider/home-layout-provider";

export function PopupNotifyDialog({ ...props }) {
  const { popupNotifys } = useHomeLayoutContext();
  const [itemId, setItemId] = useState<string>(null);
  const router = useRouter();

  if (popupNotifys?.length === 0 && itemId) {
    router.reload();
    return;
  }
  if (popupNotifys?.length === 0) return;
  return <PopupNotifyDialogItem item={popupNotifys[0]} setItemId={setItemId} />;
}

const PopupNotifyDialogItem = ({ item, ...props }) => {
  const { getPopupNotify } = useHomeLayoutContext();
  const md = useScreen("md");
  const setLoCalStorage = (id) => {
    props.setItemId(id);
    const localStoragePopupNotify = localStorage.getItem("popup-notify-adv");
    // set id of popupNotifys to localstorage array
    const popupNotifyIds = JSON.parse(localStoragePopupNotify) || [];
    popupNotifyIds.push(id);
    localStorage.setItem("popup-notify-adv", JSON.stringify(popupNotifyIds));
    getPopupNotify();
  };
  return (
    <>
      {item.type == PopupNotifyTypeEnum.VIDEO && (
        <VideoDialog
          videoUrl={item.data}
          onClose={() => setLoCalStorage(item.id)}
          isOpen={!!item.id}
          mobileSizeMode={false}
        ></VideoDialog>
      )}
      {item.type == PopupNotifyTypeEnum.HTML && (
        <Dialog
          bodyClass="p-2"
          width={700}
          isOpen={!!item.id}
          className="relative"
          slideFromBottom="none"
          onClose={() => ""}
          {...props}
        >
          <i
            onClick={() => setLoCalStorage(item.id)}
            className="absolute -right-2 -top-4 p-2 text-lg text-white bg-black bg-opacity-50 rounded-full border border-white cursor-pointer z-100 text-24"
          >
            <HiOutlineX />
          </i>
          <Dialog.Body>
            <PopupNotifyHTML item={item} />
          </Dialog.Body>
        </Dialog>
      )}
      {item.type == PopupNotifyTypeEnum.IMAGE && (
        <Dialog
          bodyClass="p-2"
          width={800}
          isOpen={!!item.id}
          className="relative"
          slideFromBottom="none"
          onClose={() => ""}
          {...props}
        >
          <i
            onClick={() => setLoCalStorage(item.id)}
            className="absolute -right-2 -top-4 p-2 text-lg text-white bg-black bg-opacity-50 rounded-full border border-white cursor-pointer z-100 text-24"
          >
            <HiOutlineX />
          </i>
          <Dialog.Body>
            {item.action == PopupNotifyActionType.WEBSITE ? (
              <Link href={item.link || ""} target="_blank">
                <Img contain className="m-0 rounded-xl" ratio169 src={item.data} />
              </Link>
            ) : (
              <Img
                showImageOnClick={!md}
                contain
                className="m-0 rounded-xl"
                ratio169
                src={item.data}
              />
            )}
          </Dialog.Body>
        </Dialog>
      )}
    </>
  );
};

function PopupNotifyHTML({ item }) {
  return (
    <>
      <div
        style={{ maxHeight: "600px" }}
        className="rounded-xl ck-content v-scrollbar"
        dangerouslySetInnerHTML={{
          // __html: post.content,
          __html: DOMPurify.sanitize(item.data),
        }}
      ></div>
    </>
  );
}
