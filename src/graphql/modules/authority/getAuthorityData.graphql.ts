import { gql } from "apollo-server-express";

import { TOKEN_ROLES } from "../../../constants/role.const";
import { AuthorityModel } from "../../../libs/dal/authority";
import { IAuthority } from "../../../libs/dal/authority/authority.interface";
import { AuthorityData } from "../../../libs/dal/authority/authorityData";
import { Context } from "../../../libs/graphql";

export default {
  schema: gql`
    extend type Authority {
      data: [AuthorifyGroup]
    }
    type AuthorifyGroup {
      code: String
      name: String
      readOnly: Boolean
      checked: Boolean
      features: [AuthorityFeature]
    }
    type AuthorityFeature {
      code: String
      name: String
      readOnly: Boolean
      checked: Boolean
      scopes: [AuthorityScope]
    }
    type AuthorityScope {
      code: String
      name: String
      checked: Boolean
      readOnly: Boolean
    }
  `,
  resolver: {
    Authority: {
      data: async (root: IAuthority, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.ADMIN_STAFF);
        // const user = await context.getUser({});
        // const userAuthorityId = user.authorityIds[0].toString();
        // const parentAuthorityIds = root.parentIds.map((id) => id.toString());
        // if (
        //   root._id.toString() != userAuthorityId &&
        //   !parentAuthorityIds.includes(userAuthorityId)
        // ) {
        //   throw authErrorPermissionDeny;
        // }
        let parentAuthority: IAuthority;
        if (!root.root) {
          parentAuthority = await AuthorityModel.findById(root.parentIds[0]);
        }
        return AuthorityData.map((group: any) => {
          group.readOnly = true;
          group.checked = false;
          if (root.root) {
            group.readOnly = true;
            group.checked = true;
          }
          group.features = group.features.map((feature: any) => {
            feature.readOnly = true;
            feature.checked = false;
            if (root.root) {
              feature.readOnly = true;
              feature.checked = true;
            }
            feature.scopes = feature.scopes.map((scope: any) => {
              scope.readOnly = true;
              scope.checked = false;
              if (root.root) {
                scope.readOnly = true;
                scope.checked = true;
              } else {
                if (root.scopes.includes(scope.code)) {
                  scope.checked = true;
                  feature.checked = true;
                  group.checked = true;
                }
                if (parentAuthority.scopes.includes(scope.code)) {
                  scope.readOnly = false;
                  feature.readOnly = false;
                  group.readOnly = false;
                }
              }
              return scope;
            });
            return feature;
          });
          return group;
        });
      },
    },
  },
};
