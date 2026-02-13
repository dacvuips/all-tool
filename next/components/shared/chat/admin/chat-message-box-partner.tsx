import isSameDay from "date-fns/isSameDay";
import { useEffect, useRef, useState } from "react";
import Scrollbars from "react-custom-scrollbars";
import { useTranslation } from "react-i18next";
import { CgSpinner } from "react-icons/cg";
import { FaArrowDown } from "react-icons/fa";
import { RiGroupLine, RiInboxLine, RiQuestionLine } from "react-icons/ri";
import { useOnScreen } from "../../../../lib/hooks/useOnScreen";
import { useScreen } from "../../../../lib/hooks/useScreen";
import { useToggle } from "../../../../lib/hooks/useToggle";
import { Button } from "../../utilities/form";
import { Img, NotFound } from "../../utilities/misc";
import { Popover } from "../../utilities/popover/popover";
import { MessageItem } from "../message-item";
import { useMessageContext } from "../message-provider";
import { ReplyMessage } from "../reply-message-box";
import { useReplyMessageContext } from "../reply-message-hook";

interface Props extends ReactProps {
  id?: string;
  height: number | string;
  hasActionButton?: boolean;
}
export function ChatMessageBoxPartner({
  id,
  className = "",
  height,
  hasActionButton,
  ...props
}: Props) {
  const {
    threadId,
    thread,
    messages,
    placeholderMessages,
    loadThreadMessages,
    loadingOlderMessages,
    total,
    senderId,
    sender,
    receiver,
    senderRole,
    receiverRole,
    latestMessageId,
    hasLoadedMessages,
    loading,
  } = useMessageContext();

  const { t } = useTranslation();
  const membersRef = useRef(null);
  const xs = useScreen("xs");
  const [scrollingMode, setScrollingMode] = useState(false);
  const [openProduct, toggleOpenProduct] = useToggle(false);
  const { replyMessage, replyMessageOnClose } = useReplyMessageContext(threadId);
  let [scrollPosition, setScrollPosition] = useState<{
    scrollTop: number;
    scrollHeight: number;
  }>();
  const scrollbarRef = useRef<Scrollbars>();
  const ref = useRef();
  const onScreen = useOnScreen(ref);

  const scrollToBottom = (smooth?: boolean) => {
    (scrollbarRef.current as any).view.scroll({
      top: scrollbarRef.current.getScrollHeight(),
      behavior: smooth ? "smooth" : "auto",
    });
  };

  useEffect(() => {
    if (placeholderMessages.length) {
      scrollToBottom(true);
    }
  }, [placeholderMessages]);

  useEffect(() => {
    if (scrollPosition) {
      const scrollHeight = scrollbarRef.current.getScrollHeight();
      scrollbarRef.current.scrollTop(
        scrollPosition.scrollTop + scrollHeight - scrollPosition.scrollHeight
      );
      setScrollPosition(null);
    }
  }, [messages]);

  useEffect(() => {
    if (loadingOlderMessages) {
      const scrollTop = scrollbarRef.current.getScrollTop();
      const scrollHeight = scrollbarRef.current.getScrollHeight();
      setScrollPosition({
        scrollTop,
        scrollHeight,
      });
    }
  }, [loadingOlderMessages]);

  useEffect(() => {
    if (hasLoadedMessages) {
      scrollToBottom(false);
      if (onScreen) {
        onScroll();
        const lastMessage = messages[messages?.length - 1];
        const lastMessageSenderId =
          lastMessage?.sender?.shopId ||
          lastMessage?.sender?.customerId ||
          lastMessage?.sender?.staffId;
        if (lastMessageSenderId != senderId) {
          // onThreadSeen(threadId);
        }
      }
    }
  }, [onScreen, hasLoadedMessages]);

  useEffect(() => {
    setScrollPosition(null);
  }, [threadId]);

  useEffect(() => {
    if (latestMessageId && !scrollingMode) {
      scrollToBottom(true);
    }
  }, [latestMessageId]);

  const onScroll = () => {
    const scrollTop = scrollbarRef.current.getScrollTop();
    const scrollHeight = scrollbarRef.current.getScrollHeight();
    const clientHeight = scrollbarRef.current.getClientHeight();
    setScrollingMode(scrollHeight - clientHeight - scrollTop > clientHeight);
    //load more
    if (scrollTop < 50 && messages && messages.length < total && !loadingOlderMessages) {
      loadThreadMessages(true);
    }

    if (loadingOlderMessages) {
      setScrollPosition({
        scrollTop,
        scrollHeight,
      });
    }
  };

  const senderAvatar = senderRole == "CUSTOMER" ? sender?.avatarUrl : sender?.avatar || "";

  return (
    <div
      className={`relative flex flex-col items-center ${!!replyMessage ? "pb-16" : ""}`}
      ref={ref}
    >
      <div className="flex items-center w-full px-4 py-2 truncate ... whitespace-nowrap  border-b  overflow-ellipsis">
        <Img
          className="flex-grow-0 flex-shrink-0 w-10 rounded-full border"
          src={thread?.shopProduct?.imageUrls[0] || receiver?.info?.logoUrl || receiver?.avatarUrl}
          avatar
        />
        <div className="flex justify-between items-end w-full">
          <div className="pl-3">
            <div className="text-lg font-bold max-w-2xs text-accent text-ellipsis">
              {thread?.shopProduct?.name || receiver?.name}
            </div>
            {receiver?.role == "STAFF" ? (
              <div className="text-red-500">{t("Admin")}</div>
            ) : (
              <div>{senderRole == "CUSTOMER" && t("Nhóm giao dịch")}</div>
            )}
          </div>
          <div className="flex flex-col">
            <Button
              textDanger
              icon={<RiQuestionLine />}
              className="px-0 h-5"
              iconClassName="text-18"
              placement={xs ? "left" : "top"}
              tooltip={t(
                "Vì trên web tin nhắn không thể rung chuông thông báo khi có tin mới như zalo,Facebook. Nên khách hàng cần thường xuyên để ý đến Chatbox này nhé để không bỏ lỡ tin nhắn mới nhất."
              )}
            />
            <Button
              innerRef={membersRef}
              icon={<RiGroupLine />}
              className="px-0 h-5"
              iconClassName="text-16"
              placement="left"
              tooltip={t("Thành viên")}
            />
            <Popover reference={membersRef} trigger="click" placement="bottom-end">
              <>
                <span className="font-semibold text-primary-dark text-16">
                  {t("Thành viên nhóm")}
                </span>
                <div className="flex gap-1 items-center">
                  <div className="font-semibold text-11">{`${t("Mã nhóm chat")}: `}</div>
                  <div>{thread?.id.slice(-10)}</div>
                </div>
                {thread?.customer && (
                  <div className="flex items-center p-1">
                    <Img
                      className="w-8 h-8 rounded-full border"
                      src={thread?.customer?.avatarUrl}
                      avatar
                    />
                    <div className="pl-2">
                      <div className="text-sm font-semibold">{thread?.customer?.name}</div>
                      <div className="text-xs text-gray-500">{t("Khách hàng")}</div>
                    </div>
                  </div>
                )}
                {thread?.shop && (
                  <div className="flex items-center p-1">
                    <Img
                      className="w-8 h-8 rounded-full border"
                      src={thread?.shop?.info?.logoUrl}
                      avatar
                    />
                    <div className="pl-2">
                      <div className="text-sm font-semibold">{thread?.shop?.name}</div>
                      <div className="text-xs text-gray-500">{t("Cửa hàng")}</div>
                    </div>
                  </div>
                )}
                {thread?.staff && (
                  <div className="flex items-center p-1">
                    <Img
                      className="w-8 h-8 rounded-full border"
                      src={thread?.staff?.avatar}
                      avatar
                    />
                    <div className="pl-2">
                      <div className="text-sm font-semibold">{thread?.staff?.name}</div>
                      <div className="text-xs text-danger-dark">{t("Admin")}</div>
                    </div>
                  </div>
                )}
              </>
            </Popover>
          </div>
        </div>
      </div>

      {loadingOlderMessages && (
        <div className="absolute top-3 left-1/2 w-7 h-7 text-sm text-gray-400 bg-white rounded-full border shadow-lg transform -translate-x-1/2 flex-center z-100">
          <i className="animate-spin">
            <CgSpinner />
          </i>
        </div>
      )}
      <Scrollbars
        id={`thread-${threadId}`}
        ref={scrollbarRef}
        style={{ height }}
        onScroll={onScroll}
      >
        {/* {!!thread?.shopProductId && (
          <ProductInfo
            thread={thread}
            openProduct={openProduct}
            toggleOpenProduct={toggleOpenProduct}
          />
        )} */}
        {messages?.length > 0 && !loading ? (
          <div className="flex relative flex-col gap-1 p-3 max-w-full">
            {messages.map((item, index) => {
              const isSender =
                senderId ==
                (senderRole == "ADMIN" || senderRole == "STAFF" || senderRole == "PARTNER"
                  ? item.sender.staff?.id
                  : item.sender.customer?.id);
              const showAvatar =
                index == messages.length - 1 || messages[index + 1].sender.role != item.sender.role;
              const showDate =
                index == 0 ||
                !isSameDay(new Date(messages[index - 1].createdAt), new Date(item.createdAt));
              const messageAvatar =
                item.sender.role == "CUSTOMER"
                  ? item.sender?.customer?.avatarUrl
                  : item.sender.staff.avatar;
              const ownerName =
                item.sender.role == "CUSTOMER"
                  ? item.sender?.customer?.name
                  : item.sender.staff.name;
              return (
                <MessageItem
                  hasActionButton={hasActionButton}
                  key={item.id + index}
                  isSender={isSender}
                  avatar={showAvatar ? (isSender ? senderAvatar : messageAvatar) : undefined}
                  showDate={showDate}
                  threadMessage={item}
                  ownerName={ownerName}
                />
              );
            })}
            {/* {placeholderMessages.map((item, index) => {
              return <MessageItem key={index} isSender={true} isPlaceholder threadMessage={item} />;
            })} */}
            {!messages.length && (
              <NotFound text={t("Không có tin nhắn nào")} icon={<RiInboxLine />} />
            )}
          </div>
        ) : (
          <NotFound text={t("Không có tin nhắn nào")} icon={<RiInboxLine />} />
        )}
      </Scrollbars>
      {scrollingMode && (
        <Button
          small
          style={{ backgroundColor: "rgba(0, 0, 0, 0.65)" }}
          hoverWhite
          className={`absolute rounded-full shadow z-100 animate-emerge-up text-gray-50  ${
            replyMessage ? "bottom-20" : "bottom-3"
          }`}
          icon={<FaArrowDown />}
          onClick={() => {
            scrollToBottom(true);
          }}
        />
      )}
      <ReplyMessage threadId={threadId} replyMessage={replyMessage} onClose={replyMessageOnClose} />
    </div>
  );
}
