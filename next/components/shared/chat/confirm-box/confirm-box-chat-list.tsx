import { useRef } from "react";
import Scrollbars from "react-custom-scrollbars";

import DOMPurify from "dompurify";
import { RiArrowDownSFill, RiCloseLine } from "react-icons/ri";
import { useAlert } from "../../../../lib/providers/alert-provider";
import { useToast } from "../../../../lib/providers/toast-provider";
import { Thread, ThreadService } from "../../../../lib/repo/thread/thread.repo";
import { Button } from "../../utilities/form";
import { Img, NotFound } from "../../utilities/misc";
import { Popover } from "../../utilities/popover/popover";
import { useChatContext } from "../chat-provider";
import { useThreadContext } from "../thread-provider";

import _ from "lodash";
import { useTranslation } from "react-i18next";
import { FaRegCommentDots } from "react-icons/fa";
import { useScreen } from "../../../../lib/hooks/useScreen";
import { useConfirmBoxThreadContext } from "./confirm-box-thread-provider";
export function ConfirmBoxChatList({ hasActionButton }: { hasActionButton?: boolean }) {
  const { t } = useTranslation();
  const { threads, total, loadMore } = useConfirmBoxThreadContext();

  const lg = useScreen("lg");
  return (
    <>
      {lg ? (
        <div className="h-full border-r">
          <Scrollbars autoHide className="h-20" style={{ width: "290px", height: "calc(66vh)" }}>
            {threads.length == 0 && <NotFound text={t("Không có liên hệ nào")} />}
            <ThreadMap hasActionButton={hasActionButton} />
            {threads?.length < total && (
              <Button className="w-full h-12" text={t("Xem thêm")} onClick={loadMore} />
            )}
          </Scrollbars>
        </div>
      ) : (
        <div className="flex justify-around">
          <ThreadMap hasActionButton={hasActionButton} />
        </div>
      )}
    </>
  );
}

function ThreadMap({ hasActionButton }) {
  const { threads, receiverRole, selectedThread, selectThread, loadMore, loadThread } =
    useConfirmBoxThreadContext();
  const { setThreadId, threadCount } = useChatContext();
  return (
    <>
      {threads.map((thread, index) => {
        return (
          <ThreadItem
            hasActionButton={hasActionButton}
            avatar={
              (!!thread.shop && !!thread.customer && thread.shopProduct?.imageUrls[0]) ||
              thread.shop?.info.logoUrl ||
              thread.customer?.avatarUrl
            }
            name={
              (!!thread.shop && !!thread.customer && thread.shopProduct?.name) ||
              thread.shop?.name ||
              thread.customer?.name
            }
            thread={thread}
            key={thread.id}
            selected={selectedThread?.id == thread.id}
            seen={!thread.seenStaff}
            onClick={() => {
              setThreadId(thread.id);
              selectThread(thread);
              if (thread) {
                loadThread();
              }
            }}
            receiverRole={receiverRole}
          />
        );
      })}
    </>
  );
}
export function ThreadItem({
  hasActionButton,
  avatar,
  thread,
  name,
  selected,
  seen,
  receiverRole,
  onClick,
}: {
  hasActionButton?: boolean;
  thread: Thread;
  avatar: string;
  name: string;
  selected: boolean;
  seen: boolean;
  receiverRole: string;
  onClick: () => any;
}) {
  const { t } = useTranslation();
  const alert = useAlert();
  const toast = useToast();
  const createThreadRef = useRef();
  const lg = useScreen("lg");

  const { setReloadThread, setThreadId } = useChatContext();
  const { loadThread, selectThread } = useThreadContext();

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

  const createThreadCustomer = async (role: string, id: string) => {
    await ThreadService.createThreadStaff(
      role == "SHOP" ? id : undefined,
      role == "CUSTOMER" ? id : undefined
    )
      .then((res) => {
        _.set(res.thread, "id", res.thread._id);
        const threadId = res.thread.id.slice(-10);
        localStorage.setItem("threadId", threadId);
        setThreadId(thread.id);
        selectThread(res.thread);
        loadThread();
      })
      .catch((err) => {
        toast.error(`${t("Không thể tạo chat mới")}, ${err}`);
      });
  };

  const sanitizeAndExtractText = (htmlString) => {
    const sanitizedHTML = DOMPurify.sanitize(htmlString);
    const tempElement = document.createElement("div");
    tempElement.innerHTML = sanitizedHTML;
    return tempElement.textContent.trim();
  };
  const snippetText = sanitizeAndExtractText(`${thread.snippet}`);
  return (
    <div
      className={`relative flex w-full  items-start lg:px-3   lg:py-2 p-1 border-b lg:justify-start justify-center  border-gray-100 cursor-pointer ${
        selected ? "bg-bluegray-light" : "hover:bg-gray-50"
      } ${!lg ? "rounded-t-xl" : ""}`}
      onClick={onClick}
    >
      {seen && (
        <>
          <span
            style={{ top: "0.4rem", left: "0.4rem" }}
            className="absolute inline-flex w-3 h-3 rounded-full opacity-50 bg-danger-dark animate-ping"
          ></span>

          <div
            style={{ top: "0.5rem", left: "0.47rem" }}
            className="absolute inline-flex w-2 h-2 bg-red-500 rounded-full bg-sky-500"
          ></div>
        </>
      )}
      {!hasActionButton && (
        <i
          onClick={(e) => {
            e.stopPropagation();
            cancelThread();
          }}
          data-tooltip={t("Đóng nhóm chat")}
          className="absolute text-gray-400 bg-white border rounded-full top-1 right-2 text-20 hover:text-red-500"
        >
          <RiCloseLine />
        </i>
      )}
      {!!thread.customer?.id && !!thread.shop?.id && !hasActionButton && (
        <i
          ref={createThreadRef}
          className="absolute text-gray-500 bg-white border rounded-full top-7 right-2 text-20 hover:text-primary-dark"
        >
          <RiArrowDownSFill />
        </i>
      )}

      <Popover reference={createThreadRef} trigger="hover" placement="bottom-end">
        {thread?.customer && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              createThreadCustomer("CUSTOMER", thread.customer.id);
            }}
            className="flex items-center p-1 cursor-pointer hover:bg-gray-100"
          >
            <Img className="w-8 h-8 rounded-full" src={thread?.customer?.avatarUrl} avatar />
            <div className="flex items-center justify-between w-full">
              <div className="pl-2">
                <div className="text-sm font-semibold">{thread?.customer?.name}</div>
                <div className="text-xs text-gray-500">{t("Khách hàng")}</div>
              </div>
              <Button className="pr-0" tooltip={t("Tán gẫu ngay")} icon={<FaRegCommentDots />} />
            </div>
          </div>
        )}
        {thread?.shop && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              createThreadCustomer("SHOP", thread.shop.id);
            }}
            className="flex items-center p-1 cursor-pointer hover:bg-gray-100"
          >
            <Img className="w-8 h-8 rounded-full" src={thread?.shop?.info?.logoUrl} avatar />
            <div className="flex items-center justify-between w-full">
              <div className="pl-2">
                <div className="text-sm font-semibold">{thread?.shop?.name}</div>
                <div className="text-xs text-gray-500">{t("Cửa hàng")}</div>
              </div>
              <Button className="pr-0" tooltip={t("Tán gẫu ngay")} icon={<FaRegCommentDots />} />
            </div>
          </div>
        )}
      </Popover>
      <Img src={avatar} className="w-12 h-12 border rounded-full" avatar></Img>
      {lg && (
        <div className="flex-1 pt-0.5 pl-2 overflow-ellipsis cursor-pointer">
          <div className={`text-ellipsis-2 font-semibold `}>
            <span className="font-semibold text-red-500">
              {((receiverRole == "CUSTOMER" && !thread.customer) ||
                (receiverRole == "SHOP" && !thread.shop)) &&
                t("Admin")}
            </span>
            <span>{name}</span>
          </div>
          <div
            className={`text-ellipsis-2 font-medium text-sm ${
              seen ? "text-gray-500" : " text-primary"
            }`}
          >
            {snippetText || `${t("Tin đa phương tiện")}...`}
          </div>
        </div>
      )}
    </div>
  );
}
