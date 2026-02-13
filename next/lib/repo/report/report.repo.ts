import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";
import { Customer } from "../customer/customer.repo";

import { ReportStatusEnum, ReportTypeEnum } from "../types";

export interface Report extends BaseModel {
  customerId?: string;
  shopId?: string;
  productId?: string;
  threadId?: string;
  orderId?: string;
  content?: {
    title?: string;
    description?: string;
    imageUrls?: string[];
  };
  type?: ReportTypeEnum;
  status?: ReportStatusEnum;
  times?: {
    processingAt?: Date;
    doneAt?: Date;
  };
  note?: string;
  customer?: Customer;
}
export class ReportRepository extends CrudRepository<Report> {
  apiName: string = "Report";
  displayName: string = t("tố cáo");
  shortFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime

    customerId: String
    shopId: String
    orderId
    productId
    threadId
    content{ title description imageUrls }
    type: String
    status: String
    times {
      processingAt: DateTime
      doneAt: DateTime
    }
    shop{
    id
    name 
    info{
      logoUrl
      }
    }
    note: String
    customer{
    name
    avatarUrl
    id
    }

  `);
  fullFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime

    customerId: String
    shopId: String
    orderId
    productId
    threadId
    content{ title description imageUrls }
    type: String
    status: String
    times {
      processingAt: DateTime
      doneAt: DateTime
    }
    note: String
    customer{
    name
    avatarUrl
    id
    }
    shop{
    id
    name 
    info{
      logoUrl
      }
    }
   
  `);

  async createReportCustomer(data: {
    productId?: string;
    threadId?: string;
    content: {
      title: string;
      description: string;
    };
    type: ReportTypeEnum;
  }) {
    return await this.mutate({
      mutation: `createReportCustomer(input: $input) `,
      variablesParams: "($input: CreateReportInput!)",
      options: {
        variables: {
          input: data,
        },
      },
    }).then((res) => res.data.g0);
  }

  async createReportShop(data: {
    productId?: string;
    threadId?: string;
    content: {
      title: string;
      description: string;
    };
    type: ReportTypeEnum;
  }) {
    return await this.mutate({
      mutation: `createReportShop(input: $input) `,
      variablesParams: "($input: CreateReportInput!)",
      options: {
        variables: {
          input: data,
        },
      },
    }).then((res) => res.data.g0);
  }

  async doneReportAffiliateOrder(data: {
    orderId: string;
    reason: string;
    isCompleted: boolean;
    reportId: string;
  }) {
    return await this.mutate({
      mutation: `doneReportAffiliateOrder(input: $input) `,
      variablesParams: "($input: DoneReportAffiliateOrderInput!)",
      options: {
        variables: {
          input: data,
        },
      },
    }).then((res) => res.data.g0);
  }
}

export const ReportService = new ReportRepository();
