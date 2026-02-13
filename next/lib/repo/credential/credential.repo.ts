import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";

export interface CredentialField {
  value?: string;
  active?: boolean;
}

export interface Credential extends BaseModel {
  id?: string;

  ghnToken?: CredentialField;
  googleAIStudio?: CredentialField;
  giaoHangTietKiem?: CredentialField;
  chatGPT?: CredentialField;
  spx?: CredentialField;
  jtExpress?: CredentialField;
}

export class CredentialRepository extends CrudRepository<Credential> {
  apiName: string = "Credential";
  displayName: string = t("chứng chỉ");
  shortFragment: string = this.parseFragment(`
    id
     
    ghnToken {
      value
      active
    }
    googleAIStudio {
      value
      active
    }
    giaoHangTietKiem {
      value
      active
    }
    chatGPT {
      value
      active
    }
    spx {
      value
      active
    }
    jtExpress {
      value
      active
    }
    createdAt
    updatedAt
  `);
  fullFragment: string = this.parseFragment(`
    id
    
    ghnToken {
      value
      active
    }
    googleAIStudio {
      value
      active
    }
    giaoHangTietKiem {
      value
      active
    }
    chatGPT {
      value
      active
    }
    spx {
      value
      active
    }
    jtExpress {
      value
      active
    }
    createdAt
    updatedAt
  `);
  async getMyCredential(): Promise<Credential | null> {
    return await this.query({
      query: `getMyCredential {
      ${this.fullFragment}
    }`,
    }).then((res) => res.data["g0"]);
  }
}

export const credentialService = new CredentialRepository();
