import { t } from "../../functions/i18n";
import { AiProviderKeyEnum } from "../ai-provider/ai-provider.repo";
import { BaseModel, CrudRepository } from "../crud.repo";

export interface Credential extends BaseModel {
  id?: string;

  key?: AiProviderKeyEnum;
  value?: string;
  active?: boolean;
  customerId?: string;
  isCustomerCredential?: boolean;
  isAdminCredential?: boolean;
}

export class CredentialRepository extends CrudRepository<Credential> {
  apiName: string = "Credential";
  displayName: string = t("chứng chỉ");
  shortFragment: string = this.parseFragment(`
    id
    key
    value
    active
    customerId
    isCustomerCredential
    isAdminCredential
    createdAt
    updatedAt
  `);

  fullFragment: string = this.parseFragment(`
    id
    key
    value
    active
    customerId
    isCustomerCredential
    isAdminCredential
    createdAt
    updatedAt
  `);

  fullFragmentCustomer: string = this.parseFragment(`
    id
    key
    value
    active
    isCustomerCredential
    createdAt
    updatedAt
  `);
  async getCredentialCustomer(): Promise<{
    data: Credential[];
    total: number;
    pagination: any;
  } | null> {
    return await this.query({
      query: `getAllCredentialCustomer(q: $q) {
      data {
        ${this.fullFragmentCustomer}
      }
      total
      pagination {
        limit
        page
        total
      }
    }`,
    }).then((res) => res.data["getAllCredentialCustomer"]);
  }
  async getCredentialCustomerById(id: string): Promise<Credential | null> {
    return await this.query({
      query: `getOneCredentialCustomer(id: $id) {
      ${this.fullFragmentCustomer}
    }`,
    }).then((res) => res.data["getOneCredentialCustomer"]);
  }
}

export const credentialService = new CredentialRepository();

/** Service dùng cho trang profile customer: getAll/getOne gọi API customer. */
export class CredentialCustomerRepository extends CrudRepository<Credential> {
  apiName: string = "CredentialCustomer";
  displayName: string = t("chứng chỉ");
  shortFragment: string = this.parseFragment(`
    id
    key
    value
    active
    isCustomerCredential
    createdAt
    updatedAt
  `);
  fullFragment: string = this.parseFragment(`
    id
    key
    value
    active
    isCustomerCredential
    createdAt
    updatedAt
  `);
}

export const credentialCustomerService = new CredentialCustomerRepository();
