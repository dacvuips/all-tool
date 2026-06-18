import { useEffect, useState } from "react";
import { RiFileForbidLine, RiTimeLine } from "react-icons/ri";

import { sanitizeCkEditorContent } from "../../../../lib/helpers/ck-editor-content";

import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { formatDate } from "../../../../lib/helpers/parser";
import { Post, PostService } from "../../../../lib/repo/post/post.repo";
import { Button } from "../../../shared/utilities/form";
import { BreadCrumbs, NotFound, Spinner } from "../../../shared/utilities/misc";

export function PostDetail({ ...props }: ReactProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const [post, setPost] = useState<Post>(undefined);

  const slug = router.query.slug;

  useEffect(() => {
    slug && GetOnePostSlug();
  }, [post]);

  const GetOnePostSlug = async () => {
    await PostService.getPostSlug(slug as string)
      .then((res) => {
        setPost(res);
      })
      .catch((err) => {
        setPost(null);
      });
  };

  if (post === undefined) return <Spinner />;

  if (post === null)
    return (
      <>
        <NotFound icon={<RiFileForbidLine />} text={t("Không tìm thấy nội dung")} />
        <Button
          className="mx-auto w-44"
          primary
          text={t("Về trang chủ")}
          onClick={() => router.replace("/")}
        />
      </>
    );
  return (
    <>
      <div className="">
        <div className="bg-white rounded-full ">
          <BreadCrumbs
            textClassName="md:text-14 text-12"
            className="relative z-10 py-2 pl-4 mt-2 mb-5 "
            breadcrumbs={[
              {
                href: "/",
                label: t("Trang chủ"),
              },
              {
                href: `/post`,
                label: t("Bài viết"),
              },
              {
                label: `${post.title?.slice(0, 60)}`,
              },
            ]}
          />
        </div>
      </div>
      <div className="bg-white rounded-md ">
        <div className="pt-4 main-container">
          <div className="flex flex-row justify-between pb-16">
            <div className="flex-1 min-h-screen ">
              <div className="mb-4 font-semibold leading-10 text-accent text-28">{post.title}</div>
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
              {/* <div className="my-8 font-semibold text-accent text-28">Tin tức liên quan</div>
              <div className="grid grid-cols-2 gap-4">
                {posts.map((item, index) => (
                  <div key={index} className="p-4 bg-white rounded-md shadow-md">
                    <Link href={`/post/${item.slug}`}>
                      <a className="">
                        <div className="flex flex-row items-center justify-between ">
                          <div>
                            <div className="font-semibold text-accent text-ellipsis-2">
                              {item?.title}
                            </div>
                            <p className="my-3 text-accent text-ellipsis-3">
                              {item?.excerpt ? item?.excerpt : "mô tả ..."}
                            </p>
                          </div>
                          <Img src={item?.featureImage} className="ml-3 rounded-md w-52" />
                        </div>
                      </a>
                    </Link>
                    <div className="flex flex-row items-center justify-between mt-1 border-t-2">
                      <div className="flex flex-row items-center">
                        <span className="mr-1 text-gray-400">Thanh Hằng </span> -{" "}
                        <span className="ml-2 text-gray-400">
                          {formatDate(item?.createdAt, "HH:mm dd-MM")}
                        </span>
                      </div>
                      <Button
                        href={{
                          pathname: "https://www.facebook.com/sharer/sharer.php",
                          query: { u: `${location.pathname}/post/${item.slug}` },
                        }}
                        text="Chia sẻ"
                        tooltip="Chia sẻ lên facebook"
                        icon={<RiShareForwardLine />}
                        iconClassName="text-primary"
                        iconPosition="start"
                        textPrimary
                        className="whitespace-nowrap"
                        // onClick={() => {
                        //   toast.info("Tính năng đang hoàn thiện");
                        // }}
                      />
                    </div>
                  </div>
                ))}
              </div> */}
            </div>
            {/* <div className="w-1/6">
              <PostProductAds />
            </div> */}
          </div>
        </div>
      </div>
    </>
  );
}
