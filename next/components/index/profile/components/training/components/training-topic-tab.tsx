import { useEffect, useState } from "react";

import { useTranslation } from "react-i18next";
import { CgSpinner } from "react-icons/cg";
import { RiSearchLine, RiTimeLine } from "react-icons/ri";
import { formatDate } from "../../../../../../lib/helpers/parser";
import { useScreen } from "../../../../../../lib/hooks/useScreen";
import { Pagination } from "../../../../../../lib/repo/crud.repo";
import { PostService } from "../../../../../../lib/repo/post/post.repo";
import { Input } from "../../../../../shared/utilities/form";
import { Img, NotFound } from "../../../../../shared/utilities/misc";
import { TablePagination } from "../../../../../shared/utilities/table/table-pagination";
import { ProfilePostDetailDialog } from "./training-dialog";

export function TrainingTopicTab({ topicId }) {
  const { t } = useTranslation();
  const [posts, setPosts] = useState<any>(null);
  const md = useScreen("md");
  const [textSearch, setTextSearch] = useState<string>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [postId, setPostId] = useState<string>(null);
  useEffect(() => {
    GetOnePostSlug();
  }, [textSearch]);

  const GetOnePostSlug = async (page?: Pagination) => {
    setIsLoading(true);
    await PostService.getAllCustomerPost({
      query: { filter: { topicIds: { $in: topicId } }, page: page?.page, search: textSearch },
    })
      .then((res) => {
        setPosts(res);
        setIsLoading(false);
      })
      .catch((err) => {
        setPosts(null);
        setIsLoading(false);
      });
  };

  return (
    <>
      <div className="p-4 text-base bg-white rounded-md text-accent ">
        {/* <div className="my-5 text-lg font-semibold leading-7 text-accent">Hướng dẫn</div> */}
        <Input
          debounce
          clearable={md}
          className="ml-auto rounded-full w-80"
          placeholder={`${t("Tìm bài viết")}...`}
          prefix={
            <i className="text-xl">
              <RiSearchLine />
            </i>
          }
          suffix={
            isLoading && (
              <i className="transition -right-0 animate-spin">
                <CgSpinner />
              </i>
            )
          }
          onChange={(value) => setTextSearch(value || undefined)}
        />
        <div className="mt-3 bg-white rounded-md">
          <div className="">
            <div className="grid grid-cols-12 gap-5 pb-16">
              {posts?.data.length > 0 ? (
                posts?.data.map((item, index) => (
                  <div
                    key={index}
                    className="col-span-12 border rounded-md cursor-pointer group md:col-span-6 hover:border-primary hover:shadow"
                    onClick={() => setPostId(item.id)}
                  >
                    <div className="flex flex-row items-start gap-2 p-1 my-2 ml-2">
                      <Img
                        className="w-24 shadow"
                        ratio169
                        src={item.featureImage || "/assets/default/default.png"}
                      />
                      <div className="flex-1 ml-1 overflow-hidden">
                        <p className="font-semibold whitespace-nowrap  overflow-ellipsis truncate ... group-hover:text-primary ">
                          {item.title}
                        </p>
                        <div className="flex text-sm text-center text-gray-500">
                          <i className="text-base mt-0.5">
                            <RiTimeLine />
                          </i>
                          <span className="ml-1">
                            {formatDate(item.createdAt, "HH:mm dd/MM/yyyy")}
                          </span>
                        </div>
                        <span className="text-ellipsis-2 ">{item.excerpt}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <NotFound text={t("Không tìm thấy nội dung")} />
              )}
            </div>
          </div>
        </div>
        {posts && (
          <TablePagination
            pagination={posts?.pagination}
            setPagination={(page) => {
              GetOnePostSlug(page);
            }}
          />
        )}
      </div>
      <ProfilePostDetailDialog isOpen={!!postId} onClose={() => setPostId(null)} postId={postId} />
    </>
  );
}
