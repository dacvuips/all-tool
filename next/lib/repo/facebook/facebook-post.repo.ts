import { GraphRepository } from "../graph.repo";

export type FacebookPrivacyStatus = "private" | "public" | "unlisted";

export interface PostFacebookPageVideoInput {
  videoUrl?: string;
  videoBase64?: string;
  title: string;
  description?: string;
  privacyStatus?: FacebookPrivacyStatus;
  /** Link affiliate — comment trên video sau upload */
  affiliateLink?: string;
  pageId?: string;
}

export interface PostFacebookPageVideoPayload {
  videoId: string;
  url: string;
  title: string;
  pageId: string;
  published: boolean;
  linkCommentId?: string | null;
  linkCommentWarning?: string | null;
}

class FacebookPostRepository extends GraphRepository {
  async postFacebookPageVideo(
    data: PostFacebookPageVideoInput
  ): Promise<PostFacebookPageVideoPayload> {
    const result = await this.apollo.mutate({
      mutation: this.gql`
        mutation postFacebookPageVideo($data: PostFacebookPageVideoInput!) {
          postFacebookPageVideo(data: $data) {
            videoId
            url
            title
            pageId
            published
            linkCommentId
            linkCommentWarning
          }
        }
      `,
      variables: { data },
      fetchPolicy: "no-cache",
    });
    return result.data.postFacebookPageVideo as PostFacebookPageVideoPayload;
  }
}

export const facebookPostRepository = new FacebookPostRepository();
