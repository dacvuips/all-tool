import { gql } from "apollo-server-express";

import { TOKEN_ROLES } from "../../../constants/role.const";
import { t } from "../../../helpers/functions/string";
import { NotificationModel, NotificationTarget } from "../../../libs/dal/notification";
import { Context } from "../../../libs/graphql";
import { ActionType } from "../../../libs/shared";
import { NotificationBuilder } from "./notificationBuilder";

export default {
  schema: gql`
    extend type Mutation {
      sendNotification(
        id: ID!
        target: String!
        title: String!
        body: String!
        actionType: String!
        actionContext: String!
      ): String
    }
  `,
  resolver: {
    Mutation: {
      sendNotification: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.ADMIN_STAFF);
        const { id, target, title, body, actionType, actionContext } = args;
        // Get admin notification infomation by ID
        let action = {};

        switch (actionType) {
          case ActionType.WEBSITE: {
            action = { type: ActionType.WEBSITE, link: actionContext };
            break;
          }
          case ActionType.PRODUCT: {
            action = { type: ActionType.PRODUCT, productId: actionContext };
            break;
          }
          default: {
            throw new Error(t("Loại hành động không được hỗ trợ"));
          }
        }
        switch (target) {
          case NotificationTarget.CUSTOMER: {
            // Get all members

            // System will filter the action type and then it will send notification to all members
            const notifies = new NotificationBuilder(title, body)
              .action(action)
              .sendTo(NotificationTarget.CUSTOMER, id)
              .build();

            await NotificationModel.create(notifies);
            break;
          }
          case NotificationTarget.SHOP: {
            // Get all members

            // System will filter the action type and then it will send notification to all members
            const notifies = new NotificationBuilder(title, body)
              .action(action)
              .sendTo(NotificationTarget.SHOP, id)
              .build();

            await NotificationModel.create(notifies);
            break;
          }
          case NotificationTarget.USER: {
            // Get all members

            // System will filter the action type and then it will send notification to all members
            const notifies = new NotificationBuilder(title, body)
              .action(action)
              .sendTo(NotificationTarget.USER, id)
              .build();

            await NotificationModel.create(notifies);
            break;
          }

          default: {
            throw new Error(t("Loại người nhận không được hỗ trợ"));
          }
        }
        return "OK";
      },
    },
  },
};
