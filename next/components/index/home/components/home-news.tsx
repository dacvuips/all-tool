import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiArrowRightSLine } from "react-icons/ri";
import { Pagination } from "../../../../lib/repo/crud.repo";
import { Post, PostService } from "../../../../lib/repo/post/post.repo";
import { Topic, TopicService } from "../../../../lib/repo/post/topic.repo";
import { SectionTitle } from "../../../shared/common/section-title";
import { Img, NotFound } from "../../../shared/utilities/misc";
import { TabGroup } from "../../../shared/utilities/tab";

export function HomeNews({ ...props }) {
  const { t } = useTranslation();
  const [firstPosts, setFirstPost] = useState<Post>(null);
  const [postSlices, setPostSlices] = useState<Post[]>([]);

  useEffect(() => {
    GetPost();
  }, []);

  const GetPost = async () => {
    await PostService.getAllPosts({ query: { limit: 4, order: { priority: 1 } } }).then((res) => {
      setFirstPost(res.data[0]);
      setPostSlices(res.data.slice(1, 6));
    });
  };

  const [topics, setTopics] = useState<Topic[]>([]);

  useEffect(() => {
    GetAllTopic();
  }, []);

  const GetAllTopic = async () => {
    await TopicService.getAll({}).then((res) => setTopics(res.data));
  };

  return (
    <div className="p-4 text-base bg-white rounded-md text-accent">
      <SectionTitle className="pl-3 border-l-4 border-primary-dark">
        {t("Tin tức mới nhất")}
      </SectionTitle>
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-full lg:col-span-7 ">
          <div className="justify-center w-full text-center">
            <Img
              style={{ maxWidth: "400px" }}
              imageClassName="rounded-md"
              className="mx-auto rounded-md"
              ratio169
              src={`${firstPosts?.featureImage || "/assets/default/default.png"}`}
            />
          </div>

          <Link href={`/post/${firstPosts?.slug}`}>
            <div className="flex items-center max-w-full pt-2 mt-2 font-semibold cursor-pointer hover:text-primary text-16 text-ellipsis-2">
              <span className="items-center px-1 pt-0 mt-1 mr-1 leading-3 text-red-700 rounded-lg bg-red-50">
                {t("Mới")}
              </span>
              {firstPosts?.title}
            </div>
          </Link>
          <span className="max-w-full mt-1 text-ellipsis-2 text-14 ">{firstPosts?.excerpt}</span>
          <div className="flex justify-end w-full text-sm text-gray-500">
            <Link href={`/post/${firstPosts?.slug}`}>
              <div className="flex items-center p-1 mt-2 text-green-700 rounded-full hover:bg-green-100 bg-green-50">
                <span className="ml-1 ">{t("Xem thêm")}</span>{" "}
                <i>
                  <RiArrowRightSLine />
                </i>
              </div>
            </Link>
          </div>
        </div>
        <div className="-mx-2 col-span-full lg:col-span-5 lg:border-l">
          <TabGroup
            inkbarClassName="absolute bottom-0 h-1 transition-all duration-300 ease-in-out bg-primary"
            activeClassName="text-primary bg-primary-light rounded-lg border"
            hasArrow
            hasInkBar={false}
            bodyClassName="py-2 mb-10 "
            tabClassName="p-1.5 my-1 "
          >
            {topics.map((topic, index) => (
              <TabGroup.Tab key={index} label={t(topic.name)}>
                <HomeNewPostTab topicId={topic.id} />
              </TabGroup.Tab>
            ))}
          </TabGroup>
          <div className="flex justify-end">
            <Link href={`/post`}>
              <div className="flex items-center justify-center p-1 mt-2 ml-auto text-green-700 rounded-full hover:bg-green-100 bg-green-50">
                {t("Xem các tin khác")}
                <i>
                  <RiArrowRightSLine />
                </i>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function HomeNewPostTab({ topicId }) {
  const { t } = useTranslation();
  const [posts, setPosts] = useState<any>(null);

  useEffect(() => {
    GetOnePostSlug();
  }, []);
  const GetOnePostSlug = async (page?: Pagination) => {
    await PostService.getAllPosts({
      query: { filter: { topicIds: { $in: topicId } } },
    })
      .then((res) => {
        setPosts(res);
      })
      .catch((err) => {
        setPosts(null);
      });
  };
  return (
    <>
      {posts?.data.length > 0 ? (
        posts?.data.map((item, index) => (
          <Link key={index} href={`/post/${item?.slug}`}>
            <div className="flex flex-row items-start gap-2 p-1 my-2 md:ml-2">
              <Img
                className="w-24 shadow"
                ratio169
                src={item.featureImage || "/assets/default/default.png"}
              />
              <div className="flex-1 ml-1">
                <div className="max-w-full font-semibold text-ellipsis-2 hover:text-primary ">
                  {item.title}
                </div>
              </div>
            </div>
          </Link>
        ))
      ) : (
        <NotFound text={t("Không tìm thấy nội dung")} />
      )}
    </>
  );
}
