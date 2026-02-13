import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { FaRegComments } from "react-icons/fa";
import { Button } from "../../utilities/form";
import { useChatContext } from "../chat-provider";

export function MessageStaff() {
  const { t } = useTranslation();
  const { threadCount } = useChatContext();
  const router = useRouter();
  return (
    <div className="relative">
      <Button
        icon={<FaRegComments />}
        iconClassName="text-xl"
        tooltip={t("Tán gẫu")}
        href={`${
          router.pathname.startsWith("/admin")
            ? "/admin/management/chats"
            : router.pathname.startsWith("/partner")
            ? "/partner/management/chats"
            : ""
        }`}
        className={`h-14 hover:bg-gray-100 `}
      ></Button>
      {threadCount > 0 && (
        <div className="absolute w-auto h-4 px-1 font-bold text-white bg-red-500 rounded-full top-1 animate-emerge left-8 min-w-4 flex-center text-10">
          {threadCount}
        </div>
      )}
    </div>
  );
}
