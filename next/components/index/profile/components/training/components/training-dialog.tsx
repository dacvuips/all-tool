import { useEffect, useState } from "react";

import { useTranslation } from "react-i18next";
import { useToast } from "../../../../../../lib/providers/toast-provider";
import { PostService } from "../../../../../../lib/repo/post/post.repo";
import { PostDialogBody } from "../../../../../shared/common/post-dialog-body";
import { Dialog } from "../../../../../shared/utilities/dialog/dialog";
export function ProfilePostDetailDialog({ postId, ...props }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [post, setPost] = useState(null);

  useEffect(() => {
    postId && GetOnePost();
  }, [postId]);

  const GetOnePost = async () => {
    await PostService.getOne({ id: postId })
      .then((res) => {
        setPost(res);
      })
      .catch((err) => {
        toast.error(`${t("Lấy thông tin bài viết thất bại")}, ${err}`);
      });
  };

  if (!post) return;

  return (
    <>
      <Dialog width={1000} slideFromBottom="none" title={t("Bài viết")} {...props}>
        <PostDialogBody post={post} />
      </Dialog>
    </>
  );
}
