import { GraphRepository } from "../graph.repo";

export type YoutubePrivacyStatus = "private" | "public" | "unlisted";

export interface PostYoutubeVideoInput {
  videoUrl?: string;
  videoBase64?: string;
  title: string;
  description?: string;
  tags?: string[];
  categoryId?: string;
  privacyStatus?: YoutubePrivacyStatus;
  madeForKids?: boolean;
  /** Link affiliate — comment trên video sau upload */
  affiliateLink?: string;
}

export interface PostYoutubeVideoPayload {
  videoId: string;
  url: string;
  title: string;
  privacyStatus: string;
  channelId?: string | null;
  linkCommentId?: string | null;
  linkCommentWarning?: string | null;
}

class YoutubePostRepository extends GraphRepository {
  async postYoutubeVideo(data: PostYoutubeVideoInput): Promise<PostYoutubeVideoPayload> {
    const result = await this.apollo.mutate({
      mutation: this.gql`
        mutation postYoutubeVideo($data: PostYoutubeVideoInput!) {
          postYoutubeVideo(data: $data) {
            videoId
            url
            title
            privacyStatus
            channelId
            linkCommentId
            linkCommentWarning
          }
        }
      `,
      variables: { data },
      fetchPolicy: "no-cache",
    });
    return result.data.postYoutubeVideo as PostYoutubeVideoPayload;
  }
}

export const youtubePostRepository = new YoutubePostRepository();
