import { TOKEN_ROLES } from "../../../constants/role.const";
import { Scope } from "../../../libs/dal/authority";
import { credentialService, ICredential } from "../../../libs/dal/credential";
import { Context } from "../../../libs/graphql";

const maskCredentialValue = (value?: string) => {
  if (!value) return "";
  return "****";
};

const maskCredential = (credential: ICredential) => {
  if (!credential) return null;

  return {
    ...credential,
    id: credential._id,
    ghnToken: credential.ghnToken
      ? {
          ...credential.ghnToken,
          active: credential.ghnToken.active,
          value: maskCredentialValue(credential.ghnToken.value),
        }
      : undefined,
    googleAIStudio: credential.googleAIStudio
      ? {
          ...credential.googleAIStudio,
          active: credential.googleAIStudio.active,
          value: maskCredentialValue(credential.googleAIStudio.value),
        }
      : undefined,
    giaoHangTietKiem: credential.giaoHangTietKiem
      ? {
          ...credential.giaoHangTietKiem,
          active: credential.giaoHangTietKiem.active,
          value: maskCredentialValue(credential.giaoHangTietKiem.value),
        }
      : undefined,
    chatGPT: credential.chatGPT
      ? {
          ...credential.chatGPT,
          active: credential.chatGPT.active,
          value: maskCredentialValue(credential.chatGPT.value),
        }
      : undefined,
    spx: credential.spx
      ? {
          ...credential.spx,
          active: credential.spx.active,
          value: maskCredentialValue(credential.spx.value),
        }
      : undefined,
    jtExpress: credential.jtExpress
      ? {
          ...credential.jtExpress,
          active: credential.jtExpress.active,
          value: maskCredentialValue(credential.jtExpress.value),
        }
      : undefined,
  };
};

const Query = {
  getAllCredential: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["CR-1-1"]]);
  },
  getOneCredential: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["CR-1-1"]]);
    const { id } = args;
    const credential = await credentialService.findOne({ _id: id });
    return maskCredential(credential);
  },
  getMyCredential: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["CR-1-1"]]);
    const result = await credentialService.fetch(args.q);
    // lấy credential đầu tiên
    const firstCredential = result.data.length > 0 ? result.data[0] : null;
    return maskCredential(firstCredential);
  },
};

const Mutation = {
  createCredential: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["CR-1-2"]]);
    const { data } = args;
    await credentialService.create(data);

    return { data: "success" };
  },
  updateCredential: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["CR-1-2"]]);
    const { id, data } = args;
    await credentialService.updateOne(id, data);
    return { data: "success" };
  },
  deleteOneCredential: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["CR-1-2"]]);
    const { id } = args;
    return await credentialService.deleteOne(id);
  },
};

const Credential = {};

export default {
  Query,
  Mutation,
  Credential,
};
