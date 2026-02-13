import { useEffect, useRef, useState } from "react";
import { FiSend } from "react-icons/fi";

import { RiCloseLine, RiImageAddLine, RiMovieLine } from "react-icons/ri";
import { useOnScreen } from "../../../lib/hooks/useOnScreen";
import { Button } from "../../shared/utilities/form/button";
import { Img } from "../../shared/utilities/misc";

import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import ReactPlayer from "react-player";
import { useScreen } from "../../../lib/hooks/useScreen";
import { useAlert } from "../../../lib/providers/alert-provider";
import { useToast } from "../../../lib/providers/toast-provider";

import { Editor, Input } from "../utilities/form";
import { Popover } from "../utilities/popover/popover";
import { AvatarUploader } from "../utilities/uploader/avatar-uploader";
import { useMessageContext } from "./message-provider";
import { useReplyMessageContext } from "./reply-message-hook";

export function MessageInput({ ...props }) {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const alert = useAlert();
  const videoRef = useRef(null);
  const videoButtonRef = useRef(null);
  const imgRef = useRef(null);
  const imgButtonRef = useRef(null);
  const confirmRef = useRef(null);
  const sm = useScreen("sm");
  const ref = useRef<HTMLTextAreaElement>();
  const onScreen = useOnScreen(ref);
  const [text, setText] = useState<string>("");
  const [attachment, setAttachment] = useState<any>();
  const [imageUploading, setImageUploading] = useState(false);
  const [videoLink, setVideoLink] = useState<string>(null);
  const [eventEnter, setEventEnter] = useState<boolean>();
  const [onSend, setOnSend] = useState<boolean>();
  // const { onThreadSeen } = useChatContext();

  const { createThreadMessage, thread, threadId, messages, senderRole, confirmGameOrderOnThread } =
    useMessageContext();

  const { replyMessage, replyMessageOnClose } = useReplyMessageContext(threadId);

  useEffect(() => {
    if (onScreen) {
      ref.current.style.height = "0px";
      ref.current.style.height =
        (ref.current.scrollHeight > 24 ? ref.current.scrollHeight : 24) + "px";
    }
  }, [text, onScreen]);

  const send = () => {
    if (!text?.trim() && !attachment) return;
    // if (!text?.trim()) return;

    let modifiedText = "";

    // Xóa vị trí cuối cùng của <p>&nbsp;</p>
    modifiedText = text.trim().replace(/<p>|<\/p>|<br>&nbsp;/g, "");

    // add reply message to text message if exist reply message and add <br> tag

    if (replyMessage) {
      modifiedText = ` <blockquote style="border-radius: 0px 10px 0px 10px; margin-top: 0px;padding-left: 0.5em;background-color: rgb(204 204 204 / 20%)">❝<strong> ${replyMessage?.senderName}</strong>❞<br>${replyMessage?.text}</blockquote>${modifiedText}`;
    }

    //Gửi tin nhắn
    createThreadMessage({ text: modifiedText.trim(), attachment });
    //Xóa tin nhắn trả lời
    replyMessageOnClose();
    setText("");
    setAttachment(null);
  };

  useEffect(() => {
    if (eventEnter) {
      send();
      setEventEnter(false);
    }
  }, [eventEnter]);

  useEffect(() => {
    if (onSend && !!text) {
      send();
      setOnSend(false);
    }
  }, [onSend]);

  const isValidLink = (inputString) => {
    var pattern = /^(http|https):\/\/[^\s/$.?#].[^\s]*$/;
    return pattern.test(inputString);
  };

  const confirmGameOrder = async () => {
    alert.danger(
      props.senderRole == "CUSTOMER"
        ? t("XÁC NHẬN ĐÃ NHẬN TIỀN-ĐỒ-ACCOUNT")
        : t("XÁC NHẬN HOÀN THÀNH"),
      `${
        props.senderRole == "CUSTOMER"
          ? t(
              "Bạn có chắc chắn đã nhận được tiền, đồ hoặc thông tin account chưa?. Nếu chưa nhận được vui lòng không xác nhận. Nếu bạn xác nhận xem như bạn đã nhận và nhiễm khách nhiệm người gửi cho bạn"
            )
          : t(
              "Bạn có chắc chắn đơn hàng này người mua và bán đã nhận được tiền và hàng tương ứng không, hệ thống sẽ lưu lại quá trình giao dịch của bạn. Khi xác nhận thành công thì tất cả các cửa sổ chat liên quan tới đơn hàng này sẽ bị đóng lại."
            )
      }`,
      `${props.senderRole == "CUSTOMER" ? t("Tôi đã nhận") : t("Xác nhận")}`,
      async () => {
        confirmGameOrderOnThread();
        return true;
      }
    );
  };
  return (
    <div
      className={`relative pt-1 pb-2 border-t border-gray-200 min-h-20 z-100 ${props.className}`}
    >
      <div className="flex bottom-3 flex-col items-start mx-2 rounded-3xl">
        <div className="flex justify-end items-center w-full">
          <div className="flex gap-2 justify-end items-center mb-1 w-full">
            <div className="h-5" ref={videoButtonRef}>
              <Button
                textPrimary
                icon={<RiMovieLine />}
                iconClassName="text-2xl"
                placement="left"
                className="px-0 h-5 rounded-2xl"
                innerRef={videoRef}
                disabled={!messages}
                tooltip={t("Thêm video youtube/Facebook")}
                // isLoading={imageUploading}
              />
            </div>
            <Popover
              reference={videoButtonRef}
              trigger="hover"
              theme="light"
              placement={`top`}
              arrow
            >
              {t("Thêm video youtube/Facebook")}
            </Popover>
            <Popover reference={videoRef} trigger="click" placement={`top`} arrow>
              {videoLink && (
                <ReactPlayer
                  url={videoLink}
                  width="258px"
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
              <Input
                onChange={(value) => {
                  if (isValidLink(value)) {
                    setVideoLink(value);
                    setAttachment({ type: "video", payload: { url: value } });
                  } else {
                    toast.error(t("Không phải định dạng link http/https"));
                  }
                }}
                value={videoLink}
                className="mb-2 w-64"
                placeholder={t("Nhập link video Youtube/FB")}
                debounce={2000}
                suffix={
                  <div
                    onClick={() => {
                      if (videoLink) {
                        send();
                        setVideoLink(null);
                      }
                    }}
                  >
                    <FiSend
                      className={`${videoLink ? "text-white cursor-pointer" : "text-gray-500"}`}
                    />
                  </div>
                }
                suffixClassName={`${videoLink ? "bg-primary cursor-pointer" : "text-gray-200"}`}
              />
            </Popover>
            <div className="h-5 rounded-inherit">
              {attachment?.type == "image" && attachment?.payload?.url ? (
                <Img
                  src={attachment?.payload?.url}
                  className="w-10 rounded-2xl group"
                  compress={50}
                  showImageOnClick
                >
                  <Button
                    className="absolute top-0 -left-2 px-0 w-5 h-5 bg-white rounded-full border border-gray-300 z-100"
                    icon={<RiCloseLine />}
                    hoverDanger
                    disabled={!messages}
                    onClick={() => setAttachment(null)}
                  ></Button>
                </Img>
              ) : (
                <>
                  <Button
                    textPrimary
                    icon={<RiImageAddLine />}
                    iconClassName="text-2xl"
                    className="px-0 h-5 rounded-2xl"
                    onClick={() => {
                      imgRef.current().onClick();
                    }}
                    innerRef={imgButtonRef}
                    placement="left"
                    disabled={!messages}
                    isLoading={imageUploading}
                    // isLoading={imageUploading}
                  />
                  <Popover
                    reference={imgButtonRef}
                    trigger="hover"
                    theme="light"
                    placement={`top`}
                    arrow
                  >
                    {t("Thêm ảnh")}
                  </Popover>
                </>
              )}

              <AvatarUploader
                onRef={(ref) => {
                  imgRef.current = ref;
                }}
                onUploadingChange={setImageUploading}
                onImageUploaded={(val) => setAttachment({ type: "image", payload: { url: val } })}
              />
            </div>
          </div>
        </div>
        <div className="flex gap-2 items-center w-full">
          <div className="flex flex-1 items-center w-full bg-white rounded border">
            <Editor
              noBorder
              // controlClassName=""
              className="bg-transparent border-0"
              maxWidth="none"
              maxHeight={`${
                router.pathname.startsWith("/admin") || router.pathname.startsWith("/partner")
                  ? "200px"
                  : "96px"
              }`}
              minHeight="24px"
              value={text}
              onChange={(value) => {
                setText(value);
              }}
              hiddenToolbar={senderRole != "CUSTOMER" ? false : true}
              onKeyPress={(e: any) => {
                if (e.code == "Enter" && !e.shiftKey) {
                  setEventEnter(true);
                }
              }}
              placeholder={`${t("Nhập tin nhắn")}...`}
              compressUpload
            />

            <div className="flex items-center">
              <Button
                icon={<FiSend />}
                textPrimary
                disabled={(!text?.trim() && !attachment) || !messages}
                iconClassName="text-xl"
                className="w-10 h-10 rounded-2xl"
                onClick={() => {
                  setEventEnter(true);
                }}
                tooltip={t("Gửi")}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
