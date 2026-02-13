import { gql } from "apollo-server-express";
import { AuthorityModel } from "../../../libs/dal/authority";
import { AuthorityData } from "../../../libs/dal/authority/authorityData";
import { IUser } from "../../../libs/dal/user";
import { Context } from "../../../libs/graphql";

export default {
  schema: gql`
    extend type User {
      authority: UserAuthority
    }
    type UserAuthority {
      id: ID
      name: String
      data: [AuthorifyGroup]
    }
  `,
  resolver: {
    User: {
      authority: async (user: IUser, args: any, context: Context) => {
        if (!user.authorityId) return null;
        const authority = await AuthorityModel.findById(user.authorityId);
        return {
          id: authority.id,
          name: authority.name,
          data: AuthorityData.map((group: any) => {
            group.readOnly = true;
            group.checked = false;
            group.features = group.features.map((feature: any) => {
              feature.readOnly = true;
              feature.checked = false;
              feature.scopes = feature.scopes.map((scope: any) => {
                scope.readOnly = true;
                scope.checked = false;
                if (user.scopes.includes(scope.code)) {
                  scope.checked = true;
                  feature.checked = true;
                  group.checked = true;
                }
                if (authority.scopes.includes(scope.code)) {
                  scope.readOnly = false;
                  feature.readOnly = false;
                  group.readOnly = false;
                }
                return scope;
              });
              return feature;
            });
            return group;
          }),
        };
      },
    },
  },
};
