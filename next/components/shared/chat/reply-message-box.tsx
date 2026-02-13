import { RiCloseLine } from "react-icons/ri";
import { Button } from "../utilities/form";
import DOMPurify from "dompurify";
export function ReplyMessage({ threadId, replyMessage, onClose }) {
  return (
    !!replyMessage &&
    replyMessage?.threadId == threadId && (
      <div className="absolute h-16 overflow-hidden bg-white border-l-4 rounded-sm shadow bottom-1 border-primary-dark left-1 right-1">
        <div className="relative p-1 pt-0 mx-2 mb-1 rounded-md ">
          <Button
            className="absolute h-5 px-0 top-1 right-1"
            hoverDanger
            icon={<RiCloseLine />}
            onClick={() => onClose()}
          />
          <span className={`text-xs font-semibold text-danger-dark`}>
            {replyMessage?.senderName}
          </span>

          <div
            className="h-9 ck-content v-scrollbar"
            dangerouslySetInnerHTML={{
              // __html: post.content,
              __html: DOMPurify.sanitize(replyMessage?.text),
            }}
          ></div>
        </div>
      </div>
    )
  );
}
