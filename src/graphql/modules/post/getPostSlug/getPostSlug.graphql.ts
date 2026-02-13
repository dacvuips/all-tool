import { gql } from "apollo-server-express";
import { Context } from "../../../../libs/graphql";
import { GetPostSlug } from "../../../../libs/usecases/post/get/getPostSlug.usecases";

export default {
  schema: gql`
    extend type Query {
      getPostSlug(slug: String!): Post
    }
  `,
  resolver: {
    Query: {
      getPostSlug: async (root: any, args: any, context: Context) => {
        const { slug } = args;
        const post = await GetPostSlug.usecase.execute({ slug });
        return post.post;
      },
    },
  },
};
