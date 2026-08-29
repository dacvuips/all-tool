/**
 * GraphQL: đăng video lên YouTube (Data API v3 resumable upload).
 *
 * Yêu cầu customer đã lưu credential `YOUTUBE_OAUTH_KEY`
 * (access_token hoặc JSON OAuth có refresh_token).
 */
import { gql } from "apollo-server-express";
import { ErrorHelper } from "../../../base/error";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Context } from "../../../libs/graphql";
import {
  postYoutubeVideo,
  YoutubePrivacyStatus,
} from "../../../youtube-video-upload";

export default {
  schema: gql`
    enum YoutubePrivacyStatus {
      private
      public
      unlisted
    }

    input PostYoutubeVideoInput {
      """URL video (http/https/data URI) — ưu tiên dùng thay vì base64 lớn"""
      videoUrl: String
      """Base64 raw của file video (không kèm prefix data:)"""
      videoBase64: String
      title: String!
      description: String
      tags: [String!]
      """YouTube categoryId — mặc định 22 (People & Blogs)"""
      categoryId: String
      privacyStatus: YoutubePrivacyStatus = private
      madeForKids: Boolean = false
      """Link affiliate — đăng thêm comment trên video sau upload"""
      affiliateLink: String
    }

    type PostYoutubeVideoPayload {
      videoId: String!
      url: String!
      title: String!
      privacyStatus: String!
      channelId: String
      linkCommentId: String
      linkCommentWarning: String
    }

    extend type Mutation {
      """
      Đăng / upload video lên kênh YouTube của customer (qua YOUTUBE_OAUTH_KEY).
      """
      postYoutubeVideo(data: PostYoutubeVideoInput!): PostYoutubeVideoPayload!
    }
  `,
  resolver: {
    Mutation: {
      postYoutubeVideo: async (_root: unknown, args: any, context: Context) => {
        await context.auth([TOKEN_ROLES.CUSTOMER]);

        const customerId = String(context.customerId || context.id || "").trim();
        if (!customerId) {
          throw ErrorHelper.unauthorized();
        }

        const data = args?.data || {};
        const title = String(data.title || "").trim();
        if (!title) {
          throw ErrorHelper.error("Thiếu title");
        }
        if (!data.videoUrl && !data.videoBase64) {
          throw ErrorHelper.error("Thiếu videoUrl hoặc videoBase64");
        }

        const privacyStatus = (data.privacyStatus ||
          "private") as YoutubePrivacyStatus;
        if (!["private", "public", "unlisted"].includes(privacyStatus)) {
          throw ErrorHelper.error("privacyStatus không hợp lệ");
        }

        try {
          return await postYoutubeVideo({
            customerId,
            videoUrl: data.videoUrl ? String(data.videoUrl) : undefined,
            videoBase64: data.videoBase64 ? String(data.videoBase64) : undefined,
            title,
            description: data.description ? String(data.description) : "",
            tags: Array.isArray(data.tags)
              ? data.tags.map((t: unknown) => String(t))
              : [],
            categoryId: data.categoryId ? String(data.categoryId) : "22",
            privacyStatus,
            madeForKids: !!data.madeForKids,
            affiliateLink: data.affiliateLink ? String(data.affiliateLink).trim() : undefined,
          });
        } catch (err: any) {
          throw ErrorHelper.error(err?.message || "Không thể đăng video lên YouTube");
        }
      },
    },
  },
};
