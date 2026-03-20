import { CRUDService } from "../../../base/crudService";
import { encryptProviderSecret } from "../../../packages/encryption/encrypt-provider";
import { Context } from "../../graphql";
import { ICredential } from "./credential.interface";
import { CredentialModel } from "./credential.model";

const shouldEncryptValue = (value: string | undefined | null): boolean => {
  if (value === "****" || value === undefined || value === null || value === "") {
    return false;
  }
  return true;
};

class CredentialService extends CRUDService(CredentialModel) {
  async updateOne(id: string, data: Partial<ICredential>) {
    const encryptedData = { ...data };
    const credential = await this.findOne({ _id: id });

    if (data.value !== undefined) {
      encryptedData.value = shouldEncryptValue(data.value)
        ? encryptProviderSecret(data.value)
        : credential?.value;
    }
    if (data.oauthClientId !== undefined) {
      encryptedData.oauthClientId = shouldEncryptValue(data.oauthClientId)
        ? encryptProviderSecret(data.oauthClientId)
        : credential?.oauthClientId;
    }
    if (data.oauthClientSecret !== undefined) {
      encryptedData.oauthClientSecret = shouldEncryptValue(data.oauthClientSecret)
        ? encryptProviderSecret(data.oauthClientSecret)
        : credential?.oauthClientSecret;
    }
    if (data.oauthRefreshToken !== undefined) {
      encryptedData.oauthRefreshToken = shouldEncryptValue(data.oauthRefreshToken)
        ? encryptProviderSecret(data.oauthRefreshToken)
        : credential?.oauthRefreshToken;
    }

    return await super.updateOne(id, encryptedData);
  }
  async updateOneCustomer(id: string, data: Partial<ICredential>, context: Context) {
    const encryptedData = { ...data };
    const credential = await this.findOne({
      _id: id,
      customerId: context.id,
      isCustomerCredential: true,
    });

    if (data.value !== undefined) {
      encryptedData.value = shouldEncryptValue(data.value)
        ? encryptProviderSecret(data.value)
        : credential?.value;
    }
    return await super.updateOne(id, encryptedData);
  }

  async create(data: Partial<ICredential>) {
    const encryptedData = { ...data };

    if (data.value) {
      encryptedData.value = encryptProviderSecret(data.value);
    }
    if (data.oauthClientId) {
      encryptedData.oauthClientId = encryptProviderSecret(data.oauthClientId);
    }
    if (data.oauthClientSecret) {
      encryptedData.oauthClientSecret = encryptProviderSecret(data.oauthClientSecret);
    }
    if (data.oauthRefreshToken) {
      encryptedData.oauthRefreshToken = encryptProviderSecret(data.oauthRefreshToken);
    }

    return await super.create(encryptedData);
  }
}

const credentialService = new CredentialService();
export { credentialService };
