import Scrollbars from "react-custom-scrollbars";

import DOMPurify from "dompurify";
import { useTranslation } from "react-i18next";
import { RiCloseLine, RiSubtractLine } from "react-icons/ri";
import { useScreen } from "../../../lib/hooks/useScreen";
import { useAlert } from "../../../lib/providers/alert-provider";
import { useToast } from "../../../lib/providers/toast-provider";
import { Thread, ThreadRole, ThreadService } from "../../../lib/repo/thread/thread.repo";
import { Img, NotFound } from "../../shared/utilities/misc";
import { SidebarToggleButton } from "../common/sidebar-toggle-button";
import { Button } from "../utilities/form";
import { useChatContext } from "./chat-provider";
import { useThreadContext } from "./thread-provider";

export function ThreadList() {
  const { t } = useTranslation();
  const { threads, total, receiverRole, selectedThread, selectThread, loadMore, loadThread } =
    useThreadContext();
  const { setThreadId, isOpenMessageBoxStorage, setMessageBoxToggleStorage } = useChatContext();
  const sm = useScreen("sm");

  return (
    <div className="relative">
      {(isOpenMessageBoxStorage || sm) && <ThreadHeader />}
      {isOpenMessageBoxStorage && (
        <SidebarToggleButton
          setToggleSidebar={() => setMessageBoxToggleStorage()}
          toggleSidebar={!!isOpenMessageBoxStorage}
        />
      )}
      {sm || isOpenMessageBoxStorage ? (
        <div className={`h-full`}>
          <Scrollbars
            autoHide
            style={{
              width: `${isOpenMessageBoxStorage ? "300px" : "220px"}`,
              height: "calc(60vh - 3rem)",
            }}
          >
            {threads.length == 0 && <NotFound text={t("Không có liên hệ nào")} />}
            <ThreadMap
              threads={threads}
              selectedThread={selectedThread}
              setThreadId={setThreadId}
              selectThread={selectThread}
              receiverRole={receiverRole}
            />
            {threads.length < total && (
              <Button className="w-full h-12" text={t("Xem thêm")} onClick={loadMore} />
            )}
          </Scrollbars>
        </div>
      ) : (
        <div className="flex">
          <ThreadMap
            threads={threads}
            selectedThread={selectedThread}
            setThreadId={setThreadId}
            selectThread={selectThread}
            receiverRole={receiverRole}
          />
        </div>
      )}
    </div>
  );
}
const ThreadHeader = () => {
  const { t } = useTranslation();
  const { isOpenMessageBoxStorage } = useChatContext();
  // xử lý việc click một nút nhưng một nút khác vẫn có hành động click
  function handleClick(targetId) {
    document.getElementById(targetId).click();
  }
  return (
    <div className="flex justify-between items-center px-3 w-full h-12 border-b">
      <div className="text-lg font-semibold">{t("Chat box")}</div>
      {isOpenMessageBoxStorage && (
        <Button
          icon={<RiSubtractLine />}
          className="px-0 h-5 bg-gray-50 rounded-sm"
          outline
          iconClassName="text-16"
          placement="left"
          tooltip={t("Ẩn")}
          onClick={() => {
            handleClick("chat-widget");
          }}
        />
      )}
    </div>
  );
};
function ThreadMap({ threads, selectedThread, setThreadId, selectThread, receiverRole }) {
  const { loadThread, getActor } = useThreadContext();

  const { setMessageBoxToggleStorage, isOpenMessageBoxStorage } = useChatContext();

  return threads.map((thread, index) => {
    let unseen: boolean;
    const receiver = getActor({ thread });
    switch (receiverRole) {
      case "CUSTOMER":
        unseen = thread.seenShop;
        break;
    }

    return (
      <ThreadItem
        index={index}
        avatar={receiver.avatarUrl || thread.staff?.avatar}
        name={receiver.name}
        thread={thread}
        key={thread.id}
        selected={selectedThread?.id == thread.id}
        seen={!unseen}
        onClick={() => {
          setThreadId(thread.id);
          selectThread(thread);
          isOpenMessageBoxStorage && setMessageBoxToggleStorage();
          if (thread) {
            loadThread();
          }
        }}
        receiverRole={receiverRole}
      />
    );
  });
}
export function ThreadItem({
  index,
  avatar,
  thread,
  name,
  selected,
  seen,
  receiverRole,
  onClick,
}: {
  index: number;
  thread: Thread;
  avatar: string;
  name: string;
  selected: boolean;
  seen: boolean;
  receiverRole: ThreadRole;
  onClick: () => any;
}) {
  const { t } = useTranslation();
  const sm = useScreen("sm");
  const alert = useAlert();
  const toast = useToast();
  const { isOpenMessageBoxStorage, setReloadThread } = useChatContext();
  const { senderRole } = useThreadContext();
  const sanitizeAndExtractText = (htmlString) => {
    const sanitizedHTML = DOMPurify.sanitize(htmlString);
    const tempElement = document.createElement("div");
    tempElement.innerHTML = sanitizedHTML;
    return tempElement.textContent.trim();
  };
  const snippetText = sanitizeAndExtractText(`${thread.snippet}`);
  const cancelThread = async () => {
    alert.danger(
      t("Xác nhận đóng nhóm Chat này"),
      `${t("Bạn có chắc muốn đóng nhóm chat này, nhóm sẽ không thể phục hồi lại")} [${name}]`,
      t("Xác nhận"),
      async () => {
        await ThreadService.cancelThread(thread.id)
          .then((res) => {
            setReloadThread(true);
          })
          .catch((err) => {
            toast.error(`${t("Không thể đóng nhóm")}, ${err}`);
          });
        return true;
      }
    );
  };
  return (
    <div
      className={`relative flex w-full  items-start sm:px-3   sm:py-1 p-1 border-b sm:justify-start justify-center  border-gray-100 cursor-pointer ${
        selected ? "bg-bluegray-light" : "hover:bg-gray-50"
      } ${index == 0 ? (isOpenMessageBoxStorage ? "rounded-t-xl" : "rounded-tl-xl") : ""} ${
        !sm ? "rounded-t-xl" : ""
      }`}
      onClick={onClick}
    >
      {seen && (
        <>
          <span
            style={{ top: "0.4rem", left: "0.4rem" }}
            className="inline-flex absolute z-20 w-3 h-3 rounded-full opacity-50 animate-ping bg-danger-dark"
          ></span>

          <div
            style={{ top: "0.5rem", left: "0.47rem" }}
            className="inline-flex absolute z-20 w-2 h-2 bg-sky-500 bg-red-500 rounded-full"
          ></div>
        </>
      )}
      {senderRole == "CUSTOMER" && (
        <i
          onClick={(e) => {
            e.stopPropagation();
            cancelThread();
          }}
          data-tooltip={t("Đóng nhóm chat")}
          className="absolute right-1 top-3 z-10 text-gray-400 bg-white rounded-full border text-20 hover:text-red-500"
        >
          <RiCloseLine />
        </i>
      )}

      <Img
        src={avatar}
        className={`border-2 rounded-full sm:w-10 sm:h-10 w-9 h-9 ${
          selected ? "border-primary" : ""}`}
        avatar
      ></Img>
      {(sm || isOpenMessageBoxStorage) && (
        <>
          <div className="flex-1 pt-0.5 pl-2 overflow-ellipsis">
            <div className={`text-sm font-semibold text-ellipsis-2`}>
              <span className="font-semibold text-red-500">
                {((receiverRole == "CUSTOMER" && !thread.customer) || !thread.shop) &&
                  `[${t("Admin")}] `}
              </span>

              {name}
            </div>
            <div
              className={`truncate whitespace-nowrap max-w-4xs font-medium text-sm ${
                seen ? "text-gray-500" : "text-primary"
              }`}
            >
              {snippetText || `${t("Tin đa phương tiện")}...`}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
