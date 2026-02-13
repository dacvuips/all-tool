import { t } from "../../functions/i18n";
import { GraphRepository } from "../graph.repo";
export class AddressRepository extends GraphRepository {
  shortFragment: string = "id province district ward";
  fullFragment: string = "id province district ward";
  apiName: string = "Address";
  displayName: string = t("địa chỉ");

  async getProvinces() {
    const api = "getProvince";
    const result = await this.apollo.query({
      query: this.gql`
        query {
          ${api} {
            id
            name
            code
          }
        }
      `,
    });
    this.handleError(result);
    return result.data[api] as any[];
  }
  async getDistricts(provinceName: string) {
    const api = "getDistrict";
    const result = await this.apollo.query({
      query: this.gql`
        query {
          ${api}(provinceName: "${provinceName}") {
            id
            name
            provinceId
            code
          }
        }
      `,
    });
    this.handleError(result);
    return result.data[api] as any[];
  }
  async getWards(districtName: string) {
    const api = "getWard";
    const result = await this.apollo.query({
      query: this.gql`
        query {
          ${api}(districtName: "${districtName}") {
            id
            name
            districtId
          }
        }
      `,
    });
    this.handleError(result);
    return result.data[api] as any[];
  }
}

export const AddressService = new AddressRepository();
