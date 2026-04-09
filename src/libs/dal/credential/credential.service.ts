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

    return await super.create(encryptedData);
  }
}

const credentialService = new CredentialService();
export { credentialService };
