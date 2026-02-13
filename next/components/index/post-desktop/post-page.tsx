import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Post } from "../../../lib/repo/post/post.repo";
import { Topic, TopicService } from "../../../lib/repo/post/topic.repo";
import { BreadCrumbs } from "../../shared/utilities/misc";
import { TabGroup } from "../../shared/utilities/tab";
import { PostTab } from "./components/post-tab";

export function PostPage({
  setPostSeo,
  ...props
}: ReactProps & { setPostSeo?: (value: Post) => void }) {
  const { t } = useTranslation();
  const [topics, setTopics] = useState<Topic[]>([]);

  useEffect(() => {
    GetAllTopic();
  }, []);

  const GetAllTopic = async () => {
    await TopicService.getAll({}).then((res) => setTopics(res.data));
  };

  return (
    <>
      <div className="">
        <div className="bg-white rounded-full ">
          <BreadCrumbs
            textClassName="md:text-14 text-12"
            className="relative z-10 py-2 pl-4 my-5 "
            breadcrumbs={[
              {
                href: "/",
                label: t("Trang chủ"),
              },
              {
                href: `/post`,
                label: t("Bài viết"),
              },
            ]}
          />
        </div>
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
              <PostTab topicId={topic.id} />
            </TabGroup.Tab>
          ))}
        </TabGroup>
      </div>
    </>
  );
}
