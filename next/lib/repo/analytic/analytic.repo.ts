import { GraphRepository } from "../graph.repo";
import { GameOrderStatusEnum } from "../types";

export interface Overview {
  title: string;
  data: string;
  unit: string;
  growth: number;
}
export interface ReportData {
  shopProductAnalytic: Overview[];
}

export class AnalyticRepository extends GraphRepository {
  async getOverviewAnalytic(): Promise<ReportData> {
    return this.query({
      query: "getOverviewAnalytic",
    }).then((res) => res.data.g0);
  }
  async getAnalyticGameOrderShop(): Promise<ReportData> {
    return this.query({
      query: "getAnalyticGameOrderShop",
    }).then((res) => res.data.g0);
  }
  async getAnalyticGameOrderPartner(startDate?: Date, endDate?: Date): Promise<ReportData> {
    return this.query({
      query: `getAnalyticGameOrderPartner(startDate:"${startDate}",endDate:"${endDate}")`,
    }).then((res) => res.data.g0);
  }
  async getTopTransactionUser(status?: GameOrderStatusEnum, startTime?: Date, endTime?: Date) {
    return this.query({
      query: `getTopTransactionUser(status:"${status}",startTime:"${startTime}",endTime:"${endTime}")`,
    }).then((res) => res.data.g0);
  }

  async getTopTransactionAllUser(
    staffId?: string,
    status?: GameOrderStatusEnum,
    startTime?: Date,
    endTime?: Date
  ) {
    return this.query({
      query: `getTopTransactionAllUser(${
        staffId ? `staffId: "${staffId}"` : ""
      },status:"${status}",startTime:"${startTime}",endTime:"${endTime}")`,
    }).then((res) => res.data.g0);
  }
  async getTopTransactionFeeUser(startTime?: Date, endTime?: Date) {
    return this.query({
      query: `getTopTransactionFeeUser( startTime:"${startTime}",endTime:"${endTime}")`,
    }).then((res) => res.data.g0);
  }
  async getCummulativePartnerFeeChartReport() {
    return this.query({
      query: "getCummulativePartnerFeeChartReport",
    }).then((res) => res.data.g0);
  }
  async getAmountBuyProductShopChartReport() {
    return this.query({
      query: "getAmountBuyProductShopChartReport",
    }).then((res) => res.data.g0);
  }
  async getAmountSellProductShopChartReport() {
    return this.query({
      query: "getAmountSellProductShopChartReport",
    }).then((res) => res.data.g0);
  }
}

export const AnalyticService = new AnalyticRepository();
