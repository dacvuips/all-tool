import copy from "copy-to-clipboard";
import isSameDay from "date-fns/isSameDay";
import { useEffect, useRef, useState } from "react";
import Scrollbars from "react-custom-scrollbars";
import { CgSpinner } from "react-icons/cg";
import { FaArrowDown } from "react-icons/fa";
import {
  RiErrorWarningLine,
  RiFileCopyFill,
  RiGroupLine,
  RiInboxLine,
  RiQuestionLine,
  RiSubtractLine,
} from "react-icons/ri";
import { useOnScreen } from "../../../lib/hooks/useOnScreen";
import { useToggle } from "../../../lib/hooks/useToggle";
import { NotifyText } from "../common/notify-text";
import { Button } from "../utilities/form";
import { Accordion, Img, NotFound } from "../utilities/misc";
import { MessageItem } from "./message-item";
import { useMessageContext } from "./message-provider";

import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { HiOutlineChevronDown, HiOutlineChevronUp } from "react-icons/hi";
import { useDevice } from "../../../lib/hooks/useDevice";
import { useScreen } from "../../../lib/hooks/useScreen";
import { useSettingPublic } from "../../../lib/hooks/useSettingPublic";
import { useToast } from "../../../lib/providers/toast-provider";
import { IconPhoneVolume } from "../../../lib/svg";
import { SidebarToggleButton } from "../common/sidebar-toggle-button";
import { Popover } from "../utilities/popover/popover";
import { useChatContext } from "./chat-provider";
import { ReplyMessage } from "./reply-message-box";
import { useReplyMessageContext } from "./reply-message-hook";
interface Props extends ReactProps {
  id?: string;
  height: number | string;
}
export function MessageBox({ id, className = "", height, ...props }: Props) {
  const { threadId, thread, loadingOlderMessages, receiver, senderRole } = useMessageContext();

  // const { onThreadSeen } = useChatContext();
  const ref = useRef();
  const scrollbarRef = useRef<Scrollbars>();
  const sm = useScreen("sm");
  const [scrollingMode, setScrollingMode] = useState(false);
  const [openProduct, toggleOpenProduct] = useToggle(false);
  const { isOpenMessageBoxStorage, setMessageBoxToggleStorage } = useChatContext();
  const { replyMessage, replyMessageOnClose } = useReplyMessageContext(threadId);
  const isPageExchangeStream = useSettingPublic("pa-p-order");
  const scrollToBottom = (smooth?: boolean) => {
    (scrollbarRef.current as any).view.scroll({
      top: scrollbarRef.current.getScrollHeight(),
      behavior: smooth ? "smooth" : "auto",
    });
  };

  return (
    <div
      className={`relative flex flex-col items-center  ${!!replyMessage ? "pb-20" : ""}`}
      ref={ref}
    >
      {sm && (
        <SidebarToggleButton
          setToggleSidebar={() => setMessageBoxToggleStorage()}
          toggleSidebar={!!isOpenMessageBoxStorage}
        />
      )}
      <ThreadMessageBoxHeader thread={thread} receiver={receiver} senderRole={senderRole} />
      {!isPageExchangeStream && !!thread && <MidManList thread={thread} />}
      {loadingOlderMessages && (
        <div className="overflow-y-hidden absolute top-3 left-1/2 w-7 h-7 text-sm text-gray-400 bg-white rounded-full border shadow-lg transform -translate-x-1/2 flex-center z-100">
          <i className="animate-spin">
            <CgSpinner />
          </i>
        </div>
      )}
      <MessageBoxBody
        scrollToBottom={scrollToBottom}
        scrollbarRef={scrollbarRef}
        ref={ref}
        scrollingMode={scrollingMode}
        setScrollingMode={setScrollingMode}
        height={height}
        openProduct={openProduct}
        toggleOpenProduct={toggleOpenProduct}
      />

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

const ThreadMessageBoxHeader = ({ thread, receiver, senderRole }) => {
  const { t } = useTranslation();
  const membersRef = useRef(null);
  const xs = useScreen("xs");
  const [openReport, setOpenReport] = useState(false);
  const { setOpenThread } = useChatContext();

  // xử lý việc click một nút nhưng một nút khác vẫn có hành động click
  function handleClick(targetId) {
    document.getElementById(targetId).click();
  }

  const reportContentTemplate = [
    { title: t("Có hành vi lừa đảo, gian lận") },
    { title: t("Nội dung chat không phù hợp") },
    { title: t("Spam, quảng cáo, rao vặt") },
    { title: t("Chat buôn bán không đúng sản phẩm") },
    {
      title: t("Khác"),
    },
  ];

  return (
    <div className="flex items-center px-2 py-1 w-full h-12 whitespace-nowrap border-b">
      {!!thread && (
        <Img
          lazyload
          className="flex-grow-0 flex-shrink-0 w-10 rounded-full border"
          src={receiver?.avatarUrl}
          avatar
        />
      )}
      <div className="flex items-center justify-between w-full overflow-ellipsis truncate ...">
        <div className="pl-3  sm:max-w-2xs md:max-w-xs overflow-ellipsis truncate ...">
          <span className="text-sm font-bold text-accent text-ellipsis">{receiver?.name}</span>
          {receiver?.role == "STAFF" ? (
            <div className="text-xs text-red-500">{` [${t("Admin")}]`}</div>
          ) : (
            <div className="text-xs overflow-ellipsis truncate ...">
              {!!thread && (senderRole == "SHOP" || senderRole == "CUSTOMER") && (
                <span>
                  {t("Nhóm giao dịch ")}
                  {!!thread?.staffId && (
                    <span className={`text-success-dark`}>{`[${t("Admin đã vào!")}]`}</span>
                  )}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 py-0.5 pl-1 bg-gray-100 rounded-l-full">
          <Button
            textDanger
            icon={<RiErrorWarningLine />}
            className="px-0 h-5"
            iconClassName="text-18"
            placement={xs ? "left" : "bottom"}
            tooltip={t("Tố cáo vi phạm")}
            onClick={() => setOpenReport(true)}
          />
          <Button
            textInfo
            icon={<RiQuestionLine />}
            className="px-0 h-5"
            iconClassName="text-18"
            placement={xs ? "left" : "bottom"}
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
          <Button
            icon={<RiSubtractLine />}
            className="px-0 h-5 bg-gray-50 rounded-sm"
            outline
            iconClassName="text-16"
            placement="left"
            tooltip={t("Ẩn chat box")}
            onClick={() => {
              handleClick("chat-widget");
              setOpenThread(false);
            }}
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
                  <Img className="w-8 h-8 rounded-full border" src={thread?.staff?.avatar} avatar />
                  <div className="pl-2">
                    <div className="text-sm font-semibold">{thread?.staff?.name}</div>
                    <div className="text-xs text-danger-dark">{` [${t("Admin")}]`}</div>
                  </div>
                </div>
              )}
            </>
          </Popover>
        </div>
      </div>
    </div>
  );
};
const MidManList = ({ thread }) => {
  const { t } = useTranslation();
  const midManRef = useRef(null);
  const { isMobile } = useDevice();
  const router = useRouter();
  const toast = useToast();
  function copyToClipboard(text) {
    copy(text);
    toast.success(t("Đã sao chép"));
  }

  return (
    <>
      {/* <Button
        innerRef={midManRef}
        className={`flex flex-row justify-between items-center px-2 mx-2 w-full h-7 rounded-none bg-bluegray-50`}
      >
         
        <p className={`text-bluegray-700 lg:text-16 text-12`}>
          {t("Danh sách trung gian cho game này")}
        </p>
        <i className="text-20">
          <HiOutlineChevronDown />
        </i>
      </Button> */}
      <Popover reference={midManRef} trigger="click" placement="bottom">
        <div className="max-w-sm">
          <NotifyBoxAccordion />

          <span className="inline-block mt-2 font-semibold">
            {t("Danh sách trung gian uy tín")}
          </span>
          {thread?.shopProduct?.game.midMans.length > 0 ? (
            thread?.shopProduct.game.midMans.map((item, index) => (
              <div
                key={index}
                className="flex gap-5 justify-between items-center p-1 rounded-md hover:bg-primary-light"
              >
                <div
                  onClick={() => copyToClipboard(item.phoneNumber)}
                  className="flex items-center cursor-pointer"
                >
                  <Img className="w-8 h-8 rounded-full border" src={item.avatarUrl} avatar />
                  <div className="pl-2">
                    <div className="text-sm font-semibold">{item.name}</div>
                    <div className="text-xs text-gray-500">
                      {item.phoneNumber}
                      <i className="inline-block ml-1 text-13" data-tooltip={t("Copy")}>
                        <RiFileCopyFill />
                      </i>
                    </div>
                  </div>
                </div>

                {item.phoneNumber && (
                  <div className="flex flex-row gap-4 items-center">
                    <div className="flex relative w-7 h-7">
                      <span className="inline-flex absolute top-1 left-1 w-5 h-5 rounded-full opacity-75 animate-ping bg-success-dark"></span>
                      <i
                        onClick={() => {
                          if (isMobile) {
                            router.replace(`tel:${item.phoneNumber}`);
                          } else {
                            copyToClipboard(item.phoneNumber);
                          }
                        }}
                        className="relative  px-1.5 py-2 text-white rounded-full cursor-pointer w-7 h-7 text-14 bg-success"
                      >
                        <IconPhoneVolume />
                      </i>
                    </div>
                    <Link
                      href={
                        isMobile
                          ? `https://zalo.me/${item.phoneNumber}`
                          : `https://chat.zalo.me/?phone=${item.phoneNumber}`
                      }
                      target="_blank"
                    >
                      <Img className="w-7 h-7" src="/assets/img/zalo.png"></Img>
                    </Link>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="py-4 text-sm text-center text-gray-500">
              {t("Không có trung gian nào")}
            </div>
          )}
        </div>
      </Popover>
    </>
  );
};
const NotifyBoxAccordion = () => {
  const { t } = useTranslation();
  const [isOpen, toggleOpen] = useToggle(false);
  return (
    <div onClick={toggleOpen} className="flex flex-col p-1 rounded-lg border border-red-400">
      <Button className={`flex flex-row justify-between items-center w-full h-7 rounded-none`}>
        {/* <i className={`mr-1 text-bluegray-700 text-20`}>{icon}</i> */}
        <p className={`text-red-500 lg:text-16 text-12`}>{t("Lưu ý quý khách cần đọc kỹ")}</p>
        <i className="text-20">{isOpen ? <HiOutlineChevronUp /> : <HiOutlineChevronDown />}</i>
      </Button>
      <Accordion isOpen={isOpen} className="bg-gray-50">
        <div className="flex flex-col gap-y-1">
          <NotifyText
            color="red"
            textClassName="text-12 inline-block"
            text={t(
              "Giao dịch phải qua trung gian để đảm bảo an toàn, tránh lừa đảo cho cả 2 bên!"
            )}
          />
          <NotifyText
            color="blue"
            textClassName="text-12 inline-block"
            text={t(
              "Đây là phiên bản 1 (bên mua/bán tự liên hệ trung gian), phiên bản 2 trung gian sẽ vào nhóm chat này để giao dịch, an toàn 100%, không qua bất kỳ nền tảng chat nào khác"
            )}
          />
          <NotifyText
            color="blue"
            textClassName="text-12 inline-block"
            text={t("Phiên bản 2 đã có, sàn sẽ chọn thời gian áp dụng!")}
          />
        </div>
      </Accordion>
    </div>
  );
};

const MessageBoxBody = ({
  scrollToBottom,
  scrollbarRef,
  ref,
  scrollingMode,
  setScrollingMode,
  height,
  openProduct,
  toggleOpenProduct,
}) => {
  const { t } = useTranslation();
  const isPageExchangeStream = useSettingPublic("pa-p-order");

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
    senderRole,
    latestMessageId,
    hasLoadedMessages,
    loading,
  } = useMessageContext();
  let [scrollPosition, setScrollPosition] = useState<{
    scrollTop: number;
    scrollHeight: number;
  }>();

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

  const onScreen = ref && useOnScreen(ref);

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
    <Scrollbars
      id={`thread-${threadId}`}
      className="border-l"
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
              item.sender.role == "CUSTOMER" ? item.sender?.customer?.name : item.sender.staff.name;
            return (
              <MessageItem
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
  );
};
