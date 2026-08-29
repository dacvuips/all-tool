import { TOKEN_ROLES } from "../constants/role.const";
import { CredentialModel } from "../libs/dal/credential/credential.model";
import { credentialService } from "../libs/dal/credential";
import { AiProviderKeyEnum } from "../libs/dal/product";
import { Context } from "../libs/graphql";

function customerIdFromContext(context: Context): string {
  const id = String(context.customerId || context.id || "").trim();
  if (!id || context.token?.role !== TOKEN_ROLES.CUSTOMER) {
    const err: any = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
  return id;
}

/** Lưu Page Access Token — chỉ cần token thuần, backend tự resolve page_id khi upload. */
export async function saveFacebookPageCredential(
  context: Context,
  pageAccessToken: string
): Promise<void> {
  const customerId = customerIdFromContext(context);
  const value = String(pageAccessToken || "").trim();
  if (!value) {
    const err: any = new Error("Thiếu Page Access Token");
    err.statusCode = 400;
    throw err;
  }

  const existing = await CredentialModel.findOne({
    key: AiProviderKeyEnum.FACEBOOK_OAUTH_KEY,
    customerId,
    isCustomerCredential: true,
  });

  if (existing?._id) {
    await credentialService.updateOne(String(existing._id), {
      key: AiProviderKeyEnum.FACEBOOK_OAUTH_KEY,
      value,
      active: true,
    });
    return;
  }

  await credentialService.create({
    key: AiProviderKeyEnum.FACEBOOK_OAUTH_KEY,
    value,
    active: true,
    customerId,
    isCustomerCredential: true,
    isAdminCredential: false,
  });
}
