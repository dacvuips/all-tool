import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository, GetAllOptions, GetListData } from "../crud.repo";
import { Topic, TopicService } from "./topic.repo";

export interface Post extends BaseModel {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  excerpt: string;
  slug: string;
  status: string;
  publishedAt: string;
  featureImage: string;
  metaDescription: string;
  metaTitle: string;
  content: string;
  ogDescription: string;
  ogImage: string;
  ogTitle: string;
  twitterDescription: string;
  twitterImage: string;
  twitterTitle: string;
  priority: number;
  view: number;
  topicIds: string[];
  topics: Topic[];
  seen: boolean;
  roleGroup: string[];
}
export class PostRepository extends CrudRepository<Post> {
  apiName: string = "Post";
  displayName: string = t("bài viết");
  shortFragment: string = this.parseFragment(`
  id: String
  createdAt: DateTime
  updatedAt: DateTime
  title: String
  excerpt: String
  slug: String
  status: String
  publishedAt: DateTime
  featureImage: String
  metaDescription: String
  metaTitle: String
  content: String
  tagIds: [ID]
  priority: Int
  view: Int
  topicIds: [ID]
  topics{
    ${TopicService.shortFragment}
  }: [Topic]
  roleGroup:[String]
  `);
  fullFragment: string = this.parseFragment(`
  id: String
  createdAt: DateTime
  updatedAt: DateTime
  title: String
  excerpt: String
  slug: String
  status: String
  publishedAt: DateTime
  featureImage: String
  metaDescription: String
  metaTitle: String
  content: String
  tagIds: [ID]
  tags{
    id
    slug
    description
  }
  priority: Int
  view: Int
  topicIds: [ID]
  topics{
    ${TopicService.shortFragment}
  }: [Topic]
  roleGroup:[String]
  `);
  async getPostSlug(slug: string) {
    return await this.query({
      query: `getPostSlug(slug:"${slug}"){
        ${this.fullFragment}
      }`,
    }).then((res) => res.data["g0"] as Post);
  }
  async getPostPopup() {
    return await this.query({
      query: `getPostPopup`,
    }).then((res) => res.data["g0"] as Post);
  }
  async getPostPopupShop() {
    return await this.query({
      query: `getPostPopupShop`,
    }).then((res) => res.data["g0"] as Post);
  }
  async getAllCustomerPost(options: GetAllOptions): Promise<GetListData<Post>> {
    return this.getAll({
      ...options,
      apiName: "getAllCustomerPost",
    });
  }
  async getAllPartnerPost(options: GetAllOptions): Promise<GetListData<Post>> {
    return this.getAll({
      ...options,
      apiName: "getAllPartnerPost",
    });
  }
  async getAllShopPost(options: GetAllOptions): Promise<GetListData<Post>> {
    return this.getAll({
      ...options,
      apiName: "getAllShopPost",
    });
  }
  async getAllStaffPost(options: GetAllOptions): Promise<GetListData<Post>> {
    return this.getAll({
      ...options,
      apiName: "getAllStaffPost",
    });
  }
  async getAllPosts(options: GetAllOptions): Promise<GetListData<Post>> {
    return this.getAll({
      ...options,
      apiName: "getAllPosts",
    });
  }
}

export const PostService = new PostRepository();
