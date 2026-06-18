import { getYoutubePlayerConfig } from "../../../lib/helpers/ck-editor-content";
import cheerio from "cheerio";
import DOMPurify from "dompurify";
import { useRouter } from "next/router";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { CgSpinner } from "react-icons/cg";
import { RiHistoryLine, RiReplyLine, RiZoomInLine } from "react-icons/ri";
import ReactPlayer from "react-player";
import { formatDate } from "../../../lib/helpers/parser";
import { useScreen } from "../../../lib/hooks/useScreen";
import { useToggle } from "../../../lib/hooks/useToggle";
import { useAlert } from "../../../lib/providers/alert-provider";
import { useAuth } from "../../../lib/providers/auth-provider";
import { useToast } from "../../../lib/providers/toast-provider";
import { ThreadMessage, ThreadMessageService } from "../../../lib/repo/thread/thread-message.repo";
import { Button } from "../utilities/form";
import { Accordion, Img } from "../utilities/misc";
import { Popover } from "../utilities/popover/popover";
import { useChatContext } from "./chat-provider";
import { useMessageContext } from "./message-provider";

interface Props extends ReactProps {
  isSender: boolean;
  showDate?: boolean;
  threadMessage: ThreadMessage;
  avatar?: string;
  isPlaceholder?: boolean;
  ownerName?: string;
  hasActionButton?: boolean;
}
export function MessageItem({
  threadMessage,
  showDate,
  isSender,
  isPlaceholder,
  avatar,
  ownerName,
  hasActionButton = true,
  ...props
}: Props) {
  const { t } = useTranslation();
  const md = useScreen("md");
  const xs2 = useScreen("2xs");
  const [openTime, toggleOpenTime] = useToggle(false);
  const { setLoadReplyMessage } = useChatContext();
  const toast = useToast();
  const alert = useAlert();
  const { loadThreadMessages } = useMessageContext();
  const router = useRouter();
  const reTrieveRef = useRef();
  const { userPermission } = useAuth();
  const attachment = threadMessage.attachment;
  const $ = cheerio.load(threadMessage.text);
  const replacementElementsImgs = [];
  const replacementElementsVideos = [];
  $("img").each((index, element) => {
    const src = $(element).attr("src");
    const imgReplacement = (
      <div key={index} className="relative">
        <i
          style={{ padding: "1px" }}
          className="absolute z-10 font-bold text-white bg-black bg-opacity-50 rounded-sm text-xs top-0.5 right-0.5 "
        >
          <RiZoomInLine />
        </i>
        <Img
          src={src}
          className={`w-10 gap-x-0.5 rounded border ${
            threadMessage.text ? (isSender ? "rounded" : "rounded") : ""
          }`}
          imageDialogClassName="border-2 border-white rounded-md"
          showImageOnClick
          lazyload={false}
          scrollContainer={`#thread-${threadMessage.threadId}`}
        />
      </div>
    );

    replacementElementsImgs.push(imgReplacement);
  });
  $("figure.media oembed").each((index, element) => {
    const videoLink = $(element).attr("url");
    const reactPlayer = (
      <ReactPlayer
        key={index}
        url={videoLink}
        width="100%"
        height="150px"
        controls
        config={getYoutubePlayerConfig()}
      />
    );
    replacementElementsVideos.push(reactPlayer);
  });
  const retrieve = async (threadMessageId) => {
    alert.danger(
      t("Thu hồi tin nhắn"),
      t("Bạn có chắc chắn muốn thu hồi tin nhắn này không?, tin đã thu hồi không thể khôi phục"),
      t("Thu hồi"),
      async () => {
        await ThreadMessageService.retrieveThreadMessage(threadMessageId)
          .then(() => {
            toast.success(t(`Thu hồi tin nhắn thành công`));
            loadThreadMessages();
          })
          .catch((err) => {
            toast.error(`${t("Thu hồi tin nhắn thất bại")}, ${err}`);
          });
        return true;
      }
    );
  };

  const setReply = () => {
    // set sessionStorage reply
    const message = {
      senderName:
        threadMessage.sender.role == "STAFF" ||
        threadMessage.sender.role == "PARTNER" ||
        threadMessage.sender.role == "ADMIN"
          ? `[${t("Admin")}] ${threadMessage.sender.staff.name}`
          : threadMessage.sender.customer.name,
      role: threadMessage.sender.role,
      text: threadMessage.text,
      threadId: threadMessage.threadId,
    };
    sessionStorage.setItem(`reply-${threadMessage.threadId}`, JSON.stringify(message));
    setLoadReplyMessage(true);
  };

  return (
    <div>
      {showDate && (
        <div
          style={{ lineHeight: "0px" }}
          className="pt-2 pb-2 mx-auto my-2 text-sm font-semibold text-center rounded-full border max-w-4xs text-accent"
        >
          {formatDate(threadMessage.createdAt, "EEE, dd/MM/yyyy")}
        </div>
      )}

      <div
        id={threadMessage.id}
        className={`flex items-end gap-2 ${isSender ? "flex-row-reverse" : ""}`}
      >
        <Img
          lazyload={false}
          className="mb-1 w-8"
          imageClassName="border bg-white"
          src={avatar}
          avatar
          noImage={avatar === undefined}
        >
          {avatar === undefined && isPlaceholder && (
            <i className="absolute right-2 bottom-2 animate-spin text-primary">
              <CgSpinner />
            </i>
          )}
        </Img>
        <div
          ref={reTrieveRef}
          className={`flex flex-col ${isSender ? "items-end" : "items-start"}`}
        >
          {(threadMessage.text || !attachment?.payload) && (
            <div
              className={`py-2 px-3 max-w-2xs xs:max-w-xs md:max-w-sm min-h-10 min-w-8 break-words ${
                isSender ? "rounded-r rounded-l-xl" : "rounded-r-xl rounded-l"
              } ${attachment?.payload ? (isSender ? "rounded-br-none" : "rounded-bl-none") : ""} ${
                !threadMessage.isActive
                  ? "bg-danger-light text-accent"
                  : isSender
                  ? "bg-primary text-gray-50"
                  : "bg-gray-100 text-accent"
              }`}
              onClick={toggleOpenTime}
            >
              {" "}
              {!threadMessage.isActive && (
                <div className="italic text-12">{t("Tin nhắn bị thu hồi")}</div>
              )}
              {!isSender && (
                <div>
                  {(threadMessage.sender.role == "STAFF" ||
                    threadMessage.sender.role == "PARTNER" ||
                    threadMessage.sender.role == "ADMIN") && (
                    <span className="font-semibold text-danger">{`[${t("Admin")}] `}</span>
                  )}
                  <span className="font-semibold">{ownerName}</span>
                </div>
              )}
              <div className="font-medium leading-snug whitespace-pre-wrap">
                {/* {threadMessage.text} */}
                <div
                  className="ck-content"
                  dangerouslySetInnerHTML={{
                    // __html: post.content,
                    __html: DOMPurify.sanitize(threadMessage.text),
                  }}
                ></div>

                {replacementElementsVideos.length > 0 && (
                  <div className="flex gap-x-1 mb-1 flex-cols">{replacementElementsVideos}</div>
                )}
                {replacementElementsImgs.length > 0 && (
                  <div className="flex flex-row gap-x-1 mb-1">{replacementElementsImgs}</div>
                )}
              </div>
            </div>
          )}
          {!!attachment && (
            <div
              className={`py-2 px-3 max-w-2xs xs:max-w-xs md:max-w-sm min-h-10 min-w-8 break-words ${
                isSender ? "rounded-r rounded-l-xl" : "rounded-r-xl rounded-l"
              } ${attachment?.payload ? (isSender ? "rounded-br-none" : "rounded-bl-none") : ""} ${
                !threadMessage.isActive
                  ? "bg-danger-light text-accent"
                  : isSender
                  ? "bg-primary text-gray-50"
                  : "bg-gray-100 text-accent"
              }`}
              onClick={toggleOpenTime}
            >
              {attachment && attachment.type == "image" && (
                <Img
                  src={attachment?.payload?.url}
                  className={`w-24 rounded-xl border ${
                    threadMessage.text ? (isSender ? "rounded-tr-none" : "rounded-tl-none") : ""
                  }`}
                  imageDialogClassName="border-2 border-white rounded-md"
                  showImageOnClick
                  lazyload={false}
                  scrollContainer={`#thread-${threadMessage.threadId}`}
                />
              )}
              {attachment && attachment.type == "video" && (
                <ReactPlayer
                  url={attachment?.payload?.url}
                  width={`${md ? "258px" : "100%"}`}
                  height="150px"
                  controls
                  config={{
                    youtube: {
                      playerVars: { showinfo: 1, origin: "/" },
                    },
                    file: {
                      attributes: {
                        controlsList: "nodownload",
                      },
                    },
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>
      {threadMessage.createdAt && (
        <Accordion className={`${openTime ? "animate-emerge" : ""}`} isOpen={openTime}>
          <div
            className={`text-xs text-gray-500 font-medium pt-0.5 ${
              isSender ? "pr-11 text-right" : "pl-11"
            }`}
          >
            {formatDate(threadMessage.createdAt, "dd/MM/yyyy HH:mm")}
          </div>
        </Accordion>
      )}
      {threadMessage.isActive && hasActionButton && (
        <Popover
          reference={reTrieveRef}
          trigger="click"
          placement={`${!isSender ? "right-start" : "left-start"}`}
          arrow
        >
          <Button
            hoverDanger
            text={`${xs2 ? t("Trả lời") : ""}`}
            icon={<RiReplyLine />}
            iconClassName="text-15"
            className="px-0 py-3 h-2 text-12"
            onClick={() => {
              setReply();
            }}
          />{" "}
          {(router.pathname.startsWith("/partner") || router.pathname.startsWith("/admin")) &&
            userPermission("RETRIEVE_THREAD") && (
              <Button
                hoverDanger
                icon={<RiHistoryLine />}
                tooltip={t("Thu hồi tin nhắn")}
                className="px-0 py-3 pl-2 ml-2 h-2 border-l border-gray-300"
                onClick={() => {
                  retrieve(threadMessage.id);
                }}
              />
            )}
        </Popover>
      )}
    </div>
  );
}
