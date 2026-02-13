import DOMPurify from "dompurify";
import { useTranslation } from "react-i18next";
import { Dialog } from "../../../components/shared/utilities/dialog/dialog";
export function HomePageDeactiveDialog({ ...props }) {
  const { t } = useTranslation();
  return (
    <Dialog
      hasCloseIcon={false}
      width={600}
      slideFromBottom="none"
      title={t("Thông báo")}
      {...props}
    >
      <Dialog.Body>
        <div
          className="-mt-3 ck-content"
          dangerouslySetInnerHTML={{
            // __html: post.content,
            __html: DOMPurify.sanitize(props.pageDeactiveDialogValue),
          }}
        ></div>
      </Dialog.Body>
    </Dialog>
  );
}
