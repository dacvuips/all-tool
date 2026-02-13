import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import { useTranslation } from "react-i18next";
import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { Post, PostService } from "../../../../../lib/repo/post/post.repo";
import { Topic, TopicService } from "../../../../../lib/repo/post/topic.repo";
import { DatePicker, Field, ImageInput, Input, Select } from "../../../../shared/utilities/form";
import { List } from "../../../../shared/utilities/list";
import { Card } from "../../../../shared/utilities/misc";
import { DataTable } from "../../../../shared/utilities/table/data-table";
import { PostSlideout } from "./components/post-slideout";

export function PostsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { userPermission } = useAuth();

  const [postId, setPostId] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic>();
  const [filter, setFilter] = useState<any>({});
  const [timeRange, setTimeRange] = useState<any>(null);
  const { POST_STATUSES } = useOptionsTranslation();

  useEffect(() => {
    if (router.query["create"]) {
      setPostId("");
    } else if (router.query["id"]) {
      setPostId(router.query["id"]);
    } else {
      setPostId(null);
    }
  }, [router.query]);
  useEffect(() => {
    setFilter({
      ...(timeRange ? { createdAt: { $gte: timeRange.startDate, $lte: timeRange.endDate } } : {}),
    });
  }, [timeRange]);

  return (
    <Card>
      <DataTable<Post>
        crudService={PostService}
        order={{ createdAt: -1 }}
        filter={{ topicIds: selectedTopic?.id, ...filter }}
        createItem={() => router.replace({ pathname: location.pathname, query: { create: true } })}
        updateItem={(item) =>
          router.replace({ pathname: location.pathname, query: { id: item.id } })
        }
      >
        <div className="flex gap-x-3">
          <DataTable.Consumer>
            {({ loadAll }) => (
              <List<Topic>
                className="w-56"
                crudService={TopicService}
                selectedItem={selectedTopic}
                onSelect={(item) => setSelectedTopic(item)}
                onChange={() => {
                  loadAll(true);
                }}
                dialogProps={{ slideFromBottom: "none" }}
                renderItem={(item, selected) => (
                  <>
                    <div
                      className={`font-semibold text-sm ${
                        selected ? "text-primary" : "text-gray-700 group-hover:text-primary"
                      }`}
                    >
                      {t(item.name) || t("Tất cả")}
                    </div>
                    <div className="text-xs text-gray-600">
                      {item.slug || t("Lọc theo tất cả chủ đề")}
                    </div>
                  </>
                )}
                deleteDisabled={!userPermission("EDIT_POST")}
                saveDisabled={!userPermission("EDIT_POST")}
              >
                <List.Form>
                  <Field name="name" label={t("Tên chủ đề")} required cols={6}>
                    <Input autoFocus />
                  </Field>
                  <Field
                    name="slug"
                    label={t("Slug")}
                    required
                    cols={6}
                    validation={{ slug: true }}
                  >
                    <Input />
                  </Field>
                  <Field name="image" label={t("Hình")}>
                    <ImageInput />
                  </Field>
                  <Field name="group" label={t("Mã nhóm")}>
                    <Input />
                  </Field>
                </List.Form>
              </List>
            )}
          </DataTable.Consumer>

          <div className="flex-1">
            <DataTable.Header>
              <DataTable.Toolbar>
                <DataTable.Search />
                <DataTable.Filter>
                  <Field noError>
                    <DatePicker
                      className="w-40"
                      value={timeRange}
                      onChange={setTimeRange}
                      selectsRange
                      fullHeader
                      placeholder={t("Lọc thời gian")}
                      clearable
                    />
                  </Field>
                  <Field name="status" noError>
                    <Select
                      className="w-40"
                      placeholder={t("Lọc trạng thái")}
                      clearable
                      autosize
                      options={POST_STATUSES}
                    />
                  </Field>
                </DataTable.Filter>
              </DataTable.Toolbar>
              <div className="flex gap-x-2">
                <DataTable.Button outline isRefreshButton refreshAfterTask className="bg-white" />
                <DataTable.Button primary isAddButton disabled={!userPermission("CREATE_POST")} />
              </div>
            </DataTable.Header>
            <DataTable.Table className="mt-4 bg-white">
              <DataTable.Column
                label={t("Tiêu đề bài đăng")}
                render={(item: Post) => (
                  <DataTable.CellText
                    image={item.featureImage}
                    imageClassName="w-16"
                    value={item.title}
                    className="max-w-xs min-w-xs text-ellipsis-2"
                  />
                )}
              />
              <DataTable.Column
                label={t("Nhóm vai trò hiển thị")}
                center
                className="whitespace-nowrap"
                render={(item: Post) => (
                  <DataTable.CellText value={item.roleGroup?.map((item) => item).join(", ")} />
                )}
              />
              <DataTable.Column
                label={t("Chủ đề")}
                center
                render={(item: Post) => (
                  <DataTable.CellText value={item.topics?.map((item) => item?.name).join(", ")} />
                )}
              />
              <DataTable.Column
                label={t("Trạng thái")}
                center
                render={(item: Post) => (
                  <DataTable.CellStatus value={item.status} options={POST_STATUSES} />
                )}
              />
              <DataTable.Column
                label={t("Ngày tạo")}
                center
                className="whitespace-nowrap"
                render={(item: Post) => <DataTable.CellDate value={item.createdAt} />}
              />
              <DataTable.Column
                right
                className="whitespace-nowrap"
                render={(item: Post) => (
                  <>
                    <DataTable.CellButton
                      value={item}
                      isEditButton
                      disabled={!userPermission("EDIT_POST")}
                    />
                    <DataTable.CellButton
                      value={item}
                      isDeleteButton
                      disabled={!userPermission("DELETE_POST")}
                    />
                  </>
                )}
              />
            </DataTable.Table>
            <DataTable.Pagination />
          </div>
        </div>
        <DataTable.Consumer>
          {({ formItem, loadAll }) => (
            <>
              <PostSlideout loadAll={loadAll} postId={postId} />
            </>
          )}
        </DataTable.Consumer>
      </DataTable>
    </Card>
  );
}
