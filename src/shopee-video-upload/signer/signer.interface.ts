/**
 * Interface signer — tương thích API credit.toolshopee.vn.
 * Adapter stub / native plug-in qua SHOPEE_SIGNER_ADAPTER.
 */

export type SignerSignRequest = {
  /** URL Shopee đang cần ký (precheck / createPost) */
  url: string;
  /** Body JSON gửi lên Shopee */
  body: unknown;
  cookie?: string;
  country?: string;
  proxy?: string;
};

export type SignerSignResult = {
  code: number;
  message?: string;
  data?: {
    /** Header ký gắn vào request Shopee (vd af-ac-enc-sz-token) */
    headers: Record<string, string>;
  };
};

export type SignerTokenResult = {
  code: number;
  message?: string;
  data?: {
    token: string;
  };
};

export type SignerMeResult = {
  code: number;
  message?: string;
  data?: {
    username: string;
    credits: number;
    is_active: boolean;
  };
};

export interface ISignerAdapter {
  readonly name: string;
  sign(req: SignerSignRequest): Promise<SignerSignResult>;
  generateToken(opts?: { cookie?: string; country?: string }): Promise<SignerTokenResult>;
  me(): Promise<SignerMeResult>;
}
