import { t } from "../../functions/i18n";

import { BaseModel, CrudRepository } from "../crud.repo";
import { AiProviderKeyEnum } from "../product";

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
  displayName: string = t("API Key");
  shortFragment: string = this.parseFragment(`
    id
    key
    value
    active
    customerId
    isCustomerCredential
    isAdminCredential
    oauthClientId
    oauthClientSecret
    oauthRefreshToken
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
    oauthClientId
    oauthClientSecret
    oauthRefreshToken
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
  async getCredentialByCustomerAndKey(key: string): Promise<Credential | null> {
    return await this.query({
      query: `getCredentialByCustomerAndKey(key: $key) {
      ${this.fullFragmentCustomer}
    }`,
    }).then((res) => res.data["getCredentialByCustomerAndKey"]);
  }
  async checkCredentialExist(key: string): Promise<boolean> {
    return await this.query({
      query: `checkCredentialExist(key: $key) {
      ${this.fullFragmentCustomer}
    }`,
    }).then((res) => res.data["checkCredentialExist"]);
  }
}

export const credentialService = new CredentialRepository();

/** Service dùng cho trang profile customer: getAll/getOne gọi API customer. */
export class CredentialCustomerRepository extends CrudRepository<Credential> {
  apiName: string = "CredentialCustomer";
  displayName: string = t("API Key");
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
