import { ForbiddenError } from "apollo-server-express";
import _ from "lodash";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Scope } from "../../../libs/dal/authority";
import { CredentialModel, credentialService, ICredential } from "../../../libs/dal/credential";
import { Context } from "../../../libs/graphql";

const maskCredentialValue = (value?: string) => {
  if (!value) return "";
  return "****";
};

const maskCredential = (credential: ICredential | null) => {
  if (!credential) return null;
  const doc = credential as any;
  return {
    id: doc._id,
    key: doc.key,
    value: maskCredentialValue(doc.value),
    active: doc.active,
    customerId: doc.customerId,
    isCustomerCredential: doc.isCustomerCredential,
    isAdminCredential: doc.isAdminCredential,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

const Query = {
  getAllCredential: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["CR-1-1"]]);
    _.set(args.q, "filter.isAdminCredential", true);

    const result = await credentialService.fetch(args.q);
    return {
      ...result,
      data: result.data.map((item) => maskCredential(item)),
    };
  },
  getOneCredential: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["CR-1-1"]]);
    const { id } = args;
    const credential = await credentialService.findOne({ _id: id, isAdminCredential: true });
    return maskCredential(credential);
  },
  getAllCredentialCustomer: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.CUSTOMER]);
    _.set(args.q, "filter.isCustomerCredential", true);
    const result = await credentialService.fetch({ customerId: context.id, ...args.q });
    return {
      ...result,
      data: result.data.map((item) => maskCredential(item)),
    };
  },
  getOneCredentialCustomer: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.CUSTOMER]);
    const { id } = args;
    const credential = await credentialService.findOne({
      _id: id,
      customerId: context.id,
      isCustomerCredential: true,
    });
    if (!credential) {
      throw new ForbiddenError("Credential not found");
    }
    return maskCredential(credential);
  },
};

const Mutation = {
  createCredential: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["CR-1-2"]]);
    const { data } = args;
    // kiểm tra xem đã tồn tại key với adminId đã tồn tại chưa
    const existingCredential = await CredentialModel.findOne({
      key: data.key,
      isAdminCredential: true,
    });
    if (existingCredential) {
      throw new ForbiddenError("Credential already exists");
    }
    data.isAdminCredential = true;
    const created = await credentialService.create(data);
    return maskCredential(created);
  },
  updateCredential: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["CR-1-2"]]);
    const { id, data } = args;
    // kiểm tra xem đã tồn tại key với adminId đã tồn tại chưa
    //Update phải tìm loại bỏ chính id này
    const credential = await CredentialModel.findOne({
      _id: { $ne: id },
      key: data.key,
      isAdminCredential: true,
    });
    if (credential) {
      throw new ForbiddenError("Credential already exists");
    }

    const updated = await credentialService.updateOne(id, data);
    return maskCredential(updated);
  },
  deleteOneCredential: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["CR-1-2"]]);
    const { id } = args;
    const deleted = await credentialService.deleteOne(id);
    return maskCredential(deleted);
  },
  createCredentialCustomer: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.CUSTOMER]);
    const { data } = args;
    // kiểm tra xem đã tồn tại key với adminId đã tồn tại chưa
    const existingCredential = await CredentialModel.findOne({
      key: data.key,
      customerId: context.id,
      isCustomerCredential: true,
    });
    if (existingCredential) {
      throw new ForbiddenError("Credential already exists");
    }
    const created = await credentialService.create({
      key: data.key,
      value: data.value,
      active: data.active,
      customerId: context.id,
      isCustomerCredential: true,
      isAdminCredential: false,
    });
    if (!created) {
      throw new ForbiddenError("Failed to create credential");
    }
    return maskCredential(created);
  },
  updateCredentialCustomer: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.CUSTOMER]);
    const { id, data } = args;
    // kiểm tra xem đã tồn tại key với adminId đã tồn tại chưa
    //Update phải tìm loại bỏ chính id này
    const credential = await CredentialModel.findOne({
      _id: { $ne: id },
      key: data.key,
      customerId: context.id,
      isCustomerCredential: true,
    });
    if (credential) {
      throw new ForbiddenError("Credential already exists");
    }
    const credentialUpdated = await credentialService.updateOneCustomer(id, data, context);

    if (!credentialUpdated) {
      throw new ForbiddenError("Credential not found");
    }
    return maskCredential(credentialUpdated);
  },
  deleteOneCredentialCustomer: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.CUSTOMER]);
    const { id } = args;
    const credential = await CredentialModel.findOneAndDelete(
      {
        _id: id,
        customerId: context.id,
        isCustomerCredential: true,
      },
      { new: true }
    );
    if (!credential) {
      throw new ForbiddenError("Credential not found");
    }
    return maskCredential(credential);
  },
};

const Credential = {};

export default {
  Query,
  Mutation,
  Credential,
};
