import { sanitizeCkEditorContent } from "../../../lib/helpers/ck-editor-content";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiTimeLine } from "react-icons/ri";
import { formatDate } from "../../../lib/helpers/parser";
import { useToast } from "../../../lib/providers/toast-provider";
import { PostService } from "../../../lib/repo/post/post.repo";
import { Dialog } from "../utilities/dialog/dialog";
export function PostGroupDialog({ ...props }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [post, setPost] = useState(null);

  useEffect(() => {
    GetOnePost();
  }, []);

  const GetOnePost = async () => {
    await PostService.getPostSlug("solution-group")
      .then((res) => {
        setPost(res);
      })
      .catch((err) => {
        toast.error(`Lấy thông tin bài viết thất bại, ${err}`);
      });
  };

  if (!post) return;
  return (
    <>
      <Dialog
        dialogClass="relative bg-white shadow-md rounded-2xl m-auto mx-5  "
        maxWidth="1080px"
        title={t("Bài viết")}
        bodyClass="v-scrollbar px-3 md:px-5"
        {...props}
      >
        <Dialog.Body>
          <div className="bg-white rounded-md ">
            <div className="">
              <div className="flex flex-row justify-between pb-16">
                <div className="w-full" style={{ height: "calc(100vh - 220px)" }}>
                  <div className="mb-4 font-semibold leading-6 text-accent text-20">
                    {post.title}
                  </div>
                  {post.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-4 mb-5">
                      {post.tags.map((tag, index) => (
                        <div
                          key={index}
                          className={`px-4 font-medium py-1 rounded-md border border-gray-100 bg-primary-light text-primary-dark`}
                        >
                          {tag?.slug}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex text-sm text-center text-gray-500">
                    <i className="text-base mt-0.5">
                      <RiTimeLine />
                    </i>
                    <span className="ml-1">{formatDate(post.createdAt, "HH:mm dd/MM/yyyy")}</span>
                  </div>

                  <div
                    className="ck-content"
                    dangerouslySetInnerHTML={{
                      // __html: post.content,
                      __html: sanitizeCkEditorContent(post.content),
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </Dialog.Body>
      </Dialog>
    </>
  );
}
