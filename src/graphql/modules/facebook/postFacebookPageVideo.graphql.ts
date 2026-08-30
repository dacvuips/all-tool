/**
 * GraphQL: đăng video lên Fanpage Facebook (Graph API).
 *
 * Yêu cầu customer đã lưu credential `FACEBOOK_OAUTH_KEY`
 * (Page Access Token + page_id trong JSON).
 */
import { gql } from "apollo-server-express";
import { ErrorHelper } from "../../../base/error";
import { TOKEN_ROLES } from "../../../constants/role.const";
import {
  FacebookPrivacyStatus,
  postFacebookPageVideo,
} from "../../../facebook-video-upload";
import { Context } from "../../../libs/graphql";

export default {
  schema: gql`
    enum FacebookPrivacyStatus {
      private
      public
      unlisted
    }

    input PostFacebookPageVideoInput {
      """URL video (http/https/data URI) — ưu tiên dùng thay vì base64 lớn"""
      videoUrl: String
      """Base64 raw của file video (không kèm prefix data:)"""
      videoBase64: String
      title: String!
      description: String
      privacyStatus: FacebookPrivacyStatus = public
      """Link affiliate — nối vào mô tả và đăng comment trên video"""
      affiliateLink: String
      """Ghi đè page_id từ credential (tuỳ chọn)"""
      pageId: String
    }

    type PostFacebookPageVideoPayload {
      videoId: String!
      url: String!
      title: String!
      pageId: String!
      published: Boolean!
      linkCommentId: String
      linkCommentWarning: String
    }

    extend type Mutation {
      """
      Đăng / upload video lên Fanpage Facebook của customer (qua FACEBOOK_OAUTH_KEY).
      """
      postFacebookPageVideo(data: PostFacebookPageVideoInput!): PostFacebookPageVideoPayload!
    }
  `,
  resolver: {
    Mutation: {
      postFacebookPageVideo: async (_root: unknown, args: any, context: Context) => {
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

        const privacyStatus = (data.privacyStatus || "public") as FacebookPrivacyStatus;
        if (!["private", "public", "unlisted"].includes(privacyStatus)) {
          throw ErrorHelper.error("privacyStatus không hợp lệ");
        }

        try {
          return await postFacebookPageVideo({
            customerId,
            videoUrl: data.videoUrl ? String(data.videoUrl) : undefined,
            videoBase64: data.videoBase64 ? String(data.videoBase64) : undefined,
            title,
            description: data.description ? String(data.description) : "",
            privacyStatus,
            affiliateLink: data.affiliateLink ? String(data.affiliateLink).trim() : undefined,
            pageId: data.pageId ? String(data.pageId).trim() : undefined,
          });
        } catch (err: any) {
          throw ErrorHelper.error(err?.message || "Không thể đăng video lên Facebook Fanpage");
        }
      },
    },
  },
};
