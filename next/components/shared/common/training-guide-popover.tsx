import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CgSpinner } from "react-icons/cg";
import { RiBookOpenLine } from "react-icons/ri";

import { useDevice } from "../../../lib/hooks/useDevice";
import { Post, PostService } from "../../../lib/repo/post/post.repo";
import { TopicService } from "../../../lib/repo/post/topic.repo";
import { ProfilePostDetailDialog } from "../../index/profile/components/training/components/training-dialog";
import { Button, Label } from "../utilities/form";
import { Img } from "../utilities/misc";
import { Popover } from "../utilities/popover/popover";

interface TrainingGuidePopoverProps {
  className?: string;
  /** Slug chủ đề (Topic.slug) — chỉ lấy bài viết thuộc chủ đề này */
  topicSlug?: TrainingTopicSlug;
}

export enum TrainingTopicSlug {
  TRENDING_PROMPT = "trending-prompt",
  APP_PROMPT = "app-prompt",
  SINGLE_PROMPT = "single-prompt",
  BATCH_PROMPT = "batch-prompt",
  COPY_PROMPT = "copy-prompt",
  ELEMENT = "element",
  REVIEW_PRODUCT = "review-product",
  STORYBOARD = "storyboard",
  MAKE_FILM = "make-film",
}

export function TrainingGuidePopover({ className = "", topicSlug }: TrainingGuidePopoverProps) {
  const { t } = useTranslation();
  const { isMobile } = useDevice();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [postId, setPostId] = useState<string | null>(null);

  const loadGuidePosts = useCallback(async () => {
    setLoading(true);
    try {
      const topicsRes = await TopicService.getAll({});
      const topics = topicSlug
        ? topicsRes.data.filter((topic) => topic.slug === topicSlug)
        : topicsRes.data;
      const topicIds = topics.map((topic) => topic.id);
      if (!topicIds.length) {
        setPosts([]);
        return;
      }

      const postsRes = await PostService.getAllCustomerPost({
        query: {
          filter: { topicIds: { $in: topicIds.length === 1 ? topicIds[0] : topicIds } },
          limit: 50,
          order: { createdAt: -1 },
        },
      });
      setPosts(postsRes.data ?? []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [topicSlug]);

  useEffect(() => {
    setLoaded(false);
    setPosts([]);
  }, [topicSlug]);

  const handleShown = useCallback(() => {
    if (!loaded) {
      loadGuidePosts();
    }
  }, [loaded, loadGuidePosts]);

  const handleSelectPost = (id: string) => {
    (triggerRef.current as HTMLButtonElement & { _tippy?: { hide: () => void } })?._tippy?.hide();
    setPostId(id);
  };

  return (
    <>
      <Button
        innerRef={triggerRef}
        aria-label={t("Xem hướng dẫn")}
        className={`flex justify-center items-center w-6 h-6 rounded-full px-0 py-0 border-0 bg-blue-100 text-blue-600 cursor-pointer transition-colors hover:bg-blue-200 ${className}`}
        icon={<RiBookOpenLine className="text-sm text-blue-600" />}
      />

      <Popover
        reference={triggerRef}
        trigger={isMobile ? "click" : "hover"}
        placement="bottom-start"
        arrow={false}
        maxWidth={360}
        delay={0}
        zIndex={10050}
        onShown={handleShown}
        className="bg-white rounded-lg "
      >
        <Label text={t("Hướng dẫn")} />
        <div className="py-1 max-h-80 overflow-y-auto v-scrollbar min-w-80">
          {loading ? (
            <div className="flex justify-center items-center py-6 text-gray-400">
              <CgSpinner className="text-xl animate-spin" />
            </div>
          ) : posts.length > 0 ? (
            posts.map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex gap-2 items-start px-3 py-2 w-full text-left border-0 bg-transparent cursor-pointer transition-colors hover:bg-gray-50"
                onClick={() => handleSelectPost(item.id)}
              >
                <Img
                  className="flex-shrink-0 w-14 shadow"
                  ratio169
                  src={item.featureImage || "/assets/default/default.png"}
                />
                <div className="flex-1 min-w-0">
                  <p className="m-0 text-sm font-semibold text-gray-800 truncate">{item.title}</p>
                  <p className="m-0 mt-0.5 text-xs text-gray-500 truncate">{item.excerpt}</p>
                </div>
              </button>
            ))
          ) : (
            <p className="px-3 py-4 m-0 text-sm text-center text-gray-400">
              {t("Không tìm thấy nội dung")}
            </p>
          )}
        </div>
      </Popover>

      <ProfilePostDetailDialog isOpen={!!postId} onClose={() => setPostId(null)} postId={postId} />
    </>
  );
}
