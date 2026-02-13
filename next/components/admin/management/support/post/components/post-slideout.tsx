import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useOptionsTranslation } from "../../../../../../lib/hooks/useOptionsTranslate";
import { useScreen } from "../../../../../../lib/hooks/useScreen";
import { useAuth } from "../../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../../lib/providers/toast-provider";
import { PostTagService } from "../../../../../../lib/repo/post/post-tag.repo";
import { Post, PostService } from "../../../../../../lib/repo/post/post.repo";
import { TopicService } from "../../../../../../lib/repo/post/topic.repo";
import {} from "../../../../../../lib/repo/types";
import { Slideout, SlideoutProps } from "../../../../../shared/utilities/dialog/slideout";
import {
  Button,
  Editor,
  Field,
  Form,
  ImageInput,
  Input,
  Select,
  Textarea,
} from "../../../../../shared/utilities/form";
import { Spinner } from "../../../../../shared/utilities/misc";

interface PostSlideoutPropsType extends SlideoutProps {
  postId: string;
  loadAll: () => Promise<any>;
}

export function PostSlideout({ postId, loadAll, ...props }: PostSlideoutPropsType) {
  const { t } = useTranslation();
  const router = useRouter();

  const toast = useToast();
  const lg = useScreen("lg");
  const xs = useScreen("xs");
  const [post, setPost] = useState<Partial<Post>>(null);
  const [selectedLocale, setSelectedLocale] = useState("vi");
  const { userPermission } = useAuth();
  const { POST_STATUSES, ROLE_GROUP } = useOptionsTranslation();

  useEffect(() => {
    if (postId !== null) {
      if (postId) {
        PostService.getOne({ id: postId }).then((res) => {
          setPost(res);
        });
      } else {
        setPost({});
      }
    } else {
      setPost(null);
    }
  }, [postId]);

  const onSubmit = async (data) => {
    if (!data.title) {
      toast.info(t("Bắt buộc nhập tiêu đề bài viết."));
      return;
    }
    await PostService.createOrUpdate({ id: post.id, data: { ...data } })
      .then((res) => {
        toast.success(`${post.id ? t("Cập nhật") : t("Tạo")} ${t("bài viết thành công")}`);
        loadAll();
        onClose();
      })
      .catch((err) => {
        console.error(err);
        toast.error(
          `${post.id ? t("Cập nhật") : t("Tạo")} ${t("bài viết thất bại")}. ${err.message}`
        );
      });
  };

  const onClose = () => router.replace({ pathname: location.pathname, query: {} });

  return (
    <Slideout width="86vw" isOpen={postId !== null} onClose={onClose}>
      {!post ? (
        <Spinner />
      ) : (
        <Form
          className={`flex flex-col-reverse h-full lg:flex-row lg:pb-0 pb-14 ${
            !lg ? "v-scrollbar" : ""
          }`}
          defaultValues={post}
          onSubmit={onSubmit}
        >
          <div className={`flex-1   ${lg ? "v-scrollbar p-10 w-screen max-w-screen-lg" : ""}`}>
            <Field name="title" noError locale={selectedLocale}>
              <Textarea
                controlClassName=""
                rows={1}
                className="text-3xl font-semibold text-gray-700 border-0 shadow-none resize-none no-scrollbar"
                placeholder={`${t("Tiêu đề bài viết")}`}
              />
            </Field>
            <Field name="content" noError locale={selectedLocale}>
              <Editor
                minHeight="calc(100vh - 150px)"
                noBorder
                controlClassName=""
                className="bg-transparent border-0"
                maxWidth="none"
                placeholder={t("Nội dung bài viết")}
              />
            </Field>
          </div>
          <div className="border-gray-300 lg:flex lg:flex-col lg:w-full lg:max-w-xs lg:border-l bg-gray-50">
            <div className="grid grid-cols-12 gap-3 p-4 v-scrollbar">
              <Field
                name="featureImage"
                label={t("Hình đại diện")}
                readOnly={!userPermission("EDIT_POST")}
                required
                cols={lg || !xs ? 12 : 6}
              >
                <ImageInput largeImage ratio169 placeholder={t("Tỉ lệ 16/9")} />
              </Field>
              <Field
                name="excerpt"
                label={t("Mô tả ngắn bài viết")}
                locale={selectedLocale}
                cols={lg || !xs ? 12 : 6}
                required
              >
                <Textarea placeholder={t("Nên để khoảng 280 ký tự")} />
              </Field>
              <Field
                name="slug"
                label={t("Slug bài viết")}
                tooltip={t(
                  "Chỉ cho phép chữ, số và dấu gạch ngang, không có khoảng trắng. Ví dụ bai-viet-123"
                )}
                cols={lg || !xs ? 12 : 6}
                validation={{ code: true }}
              >
                <Input placeholder={`(${t("Tự tạo nếu để trống")})`} />
              </Field>
              <Field name="priority" label={t("Ưu tiên bài viết")} cols={lg || !xs ? 12 : 6}>
                <Input number placeholder={t("Ưu tiên cao sẽ hiện lên đầu.")} />
              </Field>
              <Field name="tagIds" label={t("Tag bài viết")} cols={lg || !xs ? 12 : 6}>
                <Select
                  multi
                  clearable={false}
                  placeholder={t("Chọn tag đã có hoặc nhập tag mới")}
                  createablePromise={(inputValue) =>
                    PostTagService.getAllCreatablePromise({ inputValue })
                  }
                />
              </Field>
              <Field
                name="roleGroup"
                label={t("Nhóm vai trò hiển thị")}
                cols={lg || !xs ? 12 : 4!}
                required
              >
                <Select
                  placeholder={t("Chọn nhóm vai trò")}
                  menuPlacement="top"
                  options={ROLE_GROUP}
                  multi
                  defaultValue="ALL"
                />
              </Field>
              <Field name="status" label={t("Trạng thái")} cols={lg || !xs ? 12 : 6}>
                <Select
                  placeholder={t("Chọn trạng thái")}
                  options={POST_STATUSES}
                  defaultValue="DRAFT"
                />
              </Field>
              <Field name="topicIds" label={t("Chọn chủ đề")} cols={lg || !xs ? 12 : 6}>
                <Select
                  multi
                  clearable={false}
                  placeholder={t("Chọn chủ đề")}
                  createablePromise={(inputValue) =>
                    TopicService.getAllCreatablePromise({ inputValue })
                  }
                />
              </Field>
            </div>
            <FooterButtons onClose={onClose} post={post} />
          </div>
        </Form>
      )}
    </Slideout>
  );
}

function FooterButtons({ onClose, post }) {
  const { t } = useTranslation();
  const { userPermission } = useAuth();
  const {
    formState: { isSubmitting },
  } = useFormContext();
  return (
    <>
      <div className="flex items-center h-16 px-4 mt-auto border-t border-gray-300 gap-x-2">
        <Button outline text={t("Đóng")} onClick={onClose} />
        <Button
          submit
          className="flex-1 whitespace-nowrap"
          primary
          isLoading={isSubmitting}
          text={`${post.id ? t("Cập nhật") : t("Tạo")} ${t("bài viết")}`}
          disabled={post.id ? !userPermission("EDIT_POST") : !userPermission("CREATE_POST")}
        />
      </div>
    </>
  );
}
