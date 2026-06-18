import { sanitizeCkEditorContent } from "../../../lib/helpers/ck-editor-content";
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
      onOverlayClick={() => {}}
      {...props}
    >
      <Dialog.Body>
        <div
          className="-mt-3 ck-content"
          dangerouslySetInnerHTML={{
            // __html: post.content,
            __html: sanitizeCkEditorContent(props.pageDeactiveDialogValue),
          }}
        ></div>
      </Dialog.Body>
    </Dialog>
  );
}
