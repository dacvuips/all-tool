import { set } from "lodash";
import { CRUDService } from "../../../base/crudService";
import { encryptProviderSecret } from "../../../packages/encryption/encrypt-provider";
import { ICredential } from "./credential.interface";
import { CredentialModel } from "./credential.model";

class CredentialService extends CRUDService(CredentialModel) {
  async updateOne(id: string, data: Partial<ICredential>) {
    // Encrypt credential values before saving
    const encryptedData = { ...data };
    const credential = await credentialService.findOne({ _id: id });
    const checkValueChanged = (value: string) => {
      // check value "***" thì lấy lại giá trị cũ
      if (value === "****" || value === undefined || value === null || value === "") {
        return false;
      }
      return true;
    };
    set(
      encryptedData,
      "ghnToken.value",
      checkValueChanged(data.ghnToken!.value!)
        ? encryptProviderSecret(data.ghnToken!.value!)
        : credential?.ghnToken?.value
    );
    set(
      encryptedData,
      "googleAIStudio.value",
      checkValueChanged(data.googleAIStudio!.value!)
        ? encryptProviderSecret(data.googleAIStudio!.value!)
        : credential?.googleAIStudio?.value
    );
    set(
      encryptedData,
      "giaoHangTietKiem.value",
      checkValueChanged(data.giaoHangTietKiem!.value!)
        ? encryptProviderSecret(data.giaoHangTietKiem!.value!)
        : credential?.giaoHangTietKiem?.value
    );
    set(
      encryptedData,
      "chatGPT.value",
      checkValueChanged(data.chatGPT!.value!)
        ? encryptProviderSecret(data.chatGPT!.value!)
        : credential?.chatGPT?.value
    );
    set(
      encryptedData,
      "spx.value",
      checkValueChanged(data.spx!.value!)
        ? encryptProviderSecret(data.spx!.value!)
        : credential?.spx?.value
    );
    set(
      encryptedData,
      "jtExpress.value",
      checkValueChanged(data.jtExpress!.value!)
        ? encryptProviderSecret(data.jtExpress!.value!)
        : credential?.jtExpress?.value
    );

    return await super.updateOne(id, encryptedData);
  }

  async create(data: Partial<ICredential>) {
    // Encrypt credential values before creating
    const encryptedData = { ...data };

    if (data.ghnToken?.value) {
      encryptedData.ghnToken = {
        ...data.ghnToken,
        value: encryptProviderSecret(data.ghnToken.value),
      };
    }
    if (data.googleAIStudio?.value) {
      encryptedData.googleAIStudio = {
        ...data.googleAIStudio,
        value: encryptProviderSecret(data.googleAIStudio.value),
      };
    }

    if (data.giaoHangTietKiem?.value) {
      encryptedData.giaoHangTietKiem = {
        ...data.giaoHangTietKiem,
        value: encryptProviderSecret(data.giaoHangTietKiem.value),
      };
    }

    if (data.chatGPT?.value) {
      encryptedData.chatGPT = {
        ...data.chatGPT,
        value: encryptProviderSecret(data.chatGPT.value),
      };
    }

    return await super.create(encryptedData);
  }
}

const credentialService = new CredentialService();
export { credentialService };
