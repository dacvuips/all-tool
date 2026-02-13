import { useTranslation } from "react-i18next";
import { useAlert } from "../providers/alert-provider";
import { useAuth } from "../providers/auth-provider";
import { useGlobalContext } from "../providers/global-provider";
import { useToast } from "../providers/toast-provider";
import { ThreadService } from "../repo/thread/thread.repo";

export const useChatWithShop = () => {
  const { t } = useTranslation();
  const alert = useAlert();
  const toast = useToast();

  const { customer } = useAuth();
  const { setOpenCustomerLoginDialog } = useGlobalContext();
  function handleClick(targetId) {
    setTimeout(() => {
      document.getElementById(targetId).click();
    }, 500);
  }

  const handleChatCustomerToShop = ({ productId }: { productId: string }) => {
    if (customer) {
      alert.warn(
        t("Xác nhận liên hệ người bán"),
        t("Bạn lưu ý cảnh giác với mọi hành vi lừa đảo và giao dịch không an toàn"),
        t("Xác nhận"),
        async () => {
          await ThreadService.createThreadCustomerContactShop(customer._id, productId)
            .then((res) => {
              toast.success(t("Tạo liên hệ người bán thành công"));
              handleClick("chat-widget");
            })
            .catch((err) => {
              toast.error(`${t("Tạo liên hệ người bán thất bại")}, ${err}`);
            });
          return true;
        }
      );
    } else {
      setOpenCustomerLoginDialog(true);
    }
  };
  return { handleChatCustomerToShop };
};
