import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiSend } from "react-icons/fi";
import { RiCloseLine, RiImageAddLine } from "react-icons/ri";
import { useOnScreen } from "../../../../lib/hooks/useOnScreen";
import { Button } from "../../utilities/form";
import { Img } from "../../utilities/misc";
import { AvatarUploader } from "../../utilities/uploader/avatar-uploader";
import { useMessageContext } from "../message-provider";

export function ChatMessageInput() {
  const { t } = useTranslation();
  const [text, setText] = useState<string>("");
  const [attachment, setAttachment] = useState<any>();
  const { createThreadMessage, threadId, messages, senderId } = useMessageContext();
  const imgRef = useRef(null);
  const [imageUploading, setImageUploading] = useState(false);
  const ref = useRef<HTMLTextAreaElement>();
  const onScreen = useOnScreen(ref);

  useEffect(() => {
    if (onScreen) {
      ref.current.style.height = "0px";
      ref.current.style.height =
        (ref.current.scrollHeight > 24 ? ref.current.scrollHeight : 24) + "px";
    }
  }, [text, onScreen]);

  const send = () => {
    if (!text.trim() && !attachment) return;
    createThreadMessage({ text: text.trim(), attachment });
    setText("");
    setAttachment(null);
  };

  return (
    <div className="relative p-3 border-t border-gray-200 min-h-18 z-100">
      <div className="absolute left-0 right-0 flex items-start mx-2 bottom-3 rounded-3xl">
        <div className="rounded-inherit">
          {attachment?.payload?.url ? (
            <Img
              src={attachment?.payload?.url}
              className="w-10 group rounded-2xl"
              compress={50}
              showImageOnClick
            >
              <Button
                className="absolute w-6 h-6 px-0 bg-white border border-gray-300 rounded-full -top-3 -left-3"
                icon={<RiCloseLine />}
                hoverDanger
                disabled={!messages}
                onClick={() => setAttachment(null)}
              ></Button>
            </Img>
          ) : (
            <Button
              textPrimary
              icon={<RiImageAddLine />}
              iconClassName="text-2xl"
              className="w-10 h-10 rounded-2xl"
              onClick={() => {
                imgRef.current().onClick();
              }}
              disabled={!messages}
              isLoading={imageUploading}
            />
          )}

          <AvatarUploader
            onRef={(ref) => {
              imgRef.current = ref;
            }}
            onUploadingChange={setImageUploading}
            onImageUploaded={(val) => setAttachment({ type: "image", payload: { url: val } })}
          />
        </div>
        <div className="flex flex-1 bg-white border rounded">
          <textarea
            id="chat-widget-type-input"
            rows={1}
            ref={ref}
            style={{ minHeight: 24, maxHeight: 24 * 4 }}
            placeholder={`${t("Nhập tin nhắn")}...`}
            value={text}
            className="flex-1 h-full px-2 py-3 leading-snug bg-transparent border-none shadow-none outline-none resize-none no-scrollbar"
            onChange={(e) => setText(e.target.value)}
            disabled={!messages}
            onFocus={() => {
              const lastMessage = messages[messages?.length - 1];
              const lastMessageSenderId =
                lastMessage?.sender?.shopId ||
                lastMessage?.sender?.customerId ||
                lastMessage?.sender?.staffId;
              if (lastMessageSenderId != senderId) {
                // onThreadSeen(threadId);
              }
            }}
            onKeyPress={(e) => {
              if (e.code == "Enter" && !e.shiftKey) {
                send();
                e.preventDefault();
              }
            }}
          />
          <div>
            <Button
              icon={<FiSend />}
              textPrimary
              disabled={(!text.trim() && !attachment) || !messages}
              iconClassName="text-xl"
              className="w-10 h-10 rounded-2xl"
              onClick={send}
            ></Button>
          </div>
        </div>
      </div>
    </div>
  );
}
