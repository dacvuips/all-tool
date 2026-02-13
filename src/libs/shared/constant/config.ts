import config from "config";
export const IS_DEBUG = config.util.getEnv("NODE_ENV") === "development";
export const DOMAIN = config.get<string>("domain");

export const EMAIL_CONFIG = config.get<{ from: string }>("email");

export const LOGO_URL = DOMAIN + "/assets/img/logo.png";
export const SHOP_URL = DOMAIN + "/shop";

export const PARTNER_FEE_CONFIG = config.get<
  {
    from: number;
    to?: number;
    unit: "percent" | "fixed";
    value: number;
  }[]
>("partnerFee");

export const EXCHANGE_FEE_CONFIG = config.get<
  {
    from: number;
    to?: number;
    unit: "percent" | "fixed";
    value: number;
  }[]
>("exchangeFee");

export const SECURITY_CONFIG = config.get<{
  auth: {
    useSession: boolean;
  };
}>("security");

export const CONSTANTS = {
  pwSlice: -8,
};
