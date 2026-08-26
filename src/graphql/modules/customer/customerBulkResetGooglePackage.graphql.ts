import { gql } from "apollo-server-express";

import { TOKEN_ROLES } from "../../../constants/role.const";
import { Scope } from "../../../libs/dal/authority";
import { Context } from "../../../libs/graphql";
import ResetGooglePackageJob from "../../../scheduler/jobs/resetGooglePackage.job";

export default {
  schema: gql`
    type CustomerBulkResetGooglePackageResult {
      processedCount: Int!
      resetCount: Int!
      downgradeCount: Int!
      skippedTrialCount: Int!
      errorCount: Int!
    }

    extend type Mutation {
      """
      Chạy thủ công job reset hạn mức gói Google cho toàn bộ customer
      (cùng logic cron 00:00: reset count gói còn hạn; Trial còn hạn bỏ qua; gói hết hạn → Free).
      """
      customerBulkResetGooglePackage: CustomerBulkResetGooglePackageResult
    }
  `,
  resolver: {
    Mutation: {
      customerBulkResetGooglePackage: async (_root: any, _args: any, context: Context) => {
        await context.auth([TOKEN_ROLES.ADMIN]).grant([Scope["QT-3-3"]]);
        return ResetGooglePackageJob.run(new Date());
      },
    },
  },
};
