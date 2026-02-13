import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Topic, TopicService } from "../../../../../lib/repo/post/topic.repo";
import { TabGroup } from "../../../../shared/utilities/tab";
import { TrainingTopicTab } from "./components/training-topic-tab";

export function ProfileTrainingPage(props) {
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
            <TrainingTopicTab topicId={topic.id} />
          </TabGroup.Tab>
        ))}
      </TabGroup>
    </>
  );
}
