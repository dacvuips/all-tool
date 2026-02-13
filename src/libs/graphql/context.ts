import { Request, Response } from "express";
import { TokenExpiredError } from "jsonwebtoken";
import _, { get } from "lodash";
import sift from "sift";

import { BaseErrorHelper } from "../../base/error";
import { TOKEN_ROLES } from "../../constants/role.const";
import cache from "../../helpers/cache";
import logger from "../../helpers/logger";
import Token, { TokenType } from "../../helpers/token";
import { authErrorPermissionDeny, authErrorTokenExpired, authErrorUnauthorized } from "../core";
import { ActivityModel } from "../dal/activity";
import { UserLoader, UserStatus } from "../dal/user";
import { SECURITY_CONFIG } from "../shared";

export class Context {
  public meta: any = {};
  public req: Request;
  public res: Response;
  public connection: any;
  public isAuth: boolean = false;
  public isTokenExpired: boolean = false;
  public token: Token;
  public xToken: string;
  constructor(props: { req?: Request; res?: Response; connection?: any }) {
    this.req = props.req;
    this.res = props.res;
    this.connection = props.connection;
    this.parseToken(props);
  }

  get id() {
    return this.token?._id;
  }
  get isAdmin() {
    return this.token?.role == TOKEN_ROLES.ADMIN;
  }
  get isStaff() {
    return this.token?.role == TOKEN_ROLES.STAFF;
  }
  get isPartner() {
    return this.token?.role == TOKEN_ROLES.PARTNER;
  }
  get isCustomer() {
    return this.token?.role == TOKEN_ROLES.CUSTOMER;
  }
  get isShop() {
    return this.token?.role == TOKEN_ROLES.SHOP || this.token?.role == TOKEN_ROLES.SHOP_STAFF;
  }
  get username() {
    return this.token ? get(this.token.payload, "username", this.id) : null;
  }

  get isShopOwner() {
    return this.token ? get(this.token.payload, "isOwner", null) : null;
  }

  get shopOwnerId() {
    return this.token ? get(this.token.payload, "customerId", null) : null;
  }

  get shopStaffId() {
    return this.token ? get(this.token.payload, "shopStaffId", null) : null;
  }

  get customerId() {
    return this.token?.role == TOKEN_ROLES.SHOP ? this.shopOwnerId : this.id;
  }

  parseToken(params: any) {
    try {
      const { req, connection } = params;
      let token;

      if (req) {
        token =
          _.get(req, "cookies.x-token") ||
          _.get(req, "headers.x-token") ||
          _.get(req, "query.x-token");
      }

      // console.log("token", token);

      if (connection && connection.context) {
        // logger.debug(`connection.context`, connection.context);
        // console.log(req);
        token = connection.context["x-token"];
        // parse cookie from req headers
        const headers = req.headers;
        const cookie = headers.cookie;
        // console.log("cookie", cookie);
        if (cookie) {
          const cookies = cookie.split(";");
          for (let i = 0; i < cookies.length; i++) {
            const pair = cookies[i].split("=");

            if (pair[0].trim() == "x-token") {
              token = pair[1];
              break;
            }
          }
        }
        // logger.debug("token", { token });
      }

      if (token === "null") token = null;
      if (token) {
        if (token.startsWith("AK:") == false) {
          this.token = Token.decode(token);
          if (SECURITY_CONFIG.auth.useSession) {
            const sessionId = _.get(this.token.payload, "sessionId");
            if (!sessionId) {
              this.isTokenExpired = true;
              throw authErrorTokenExpired;
            }
          }
          this.isAuth = true;
        }
      }

      this.xToken = token;
    } catch (err) {
      // console.log("parse token error", err);
      if (err instanceof TokenExpiredError) {
        this.isTokenExpired = true;
      }
      this.isAuth = false;
      // clear token from cookie
      this.unsetCookie("x-token");
    } finally {
      return this;
    }
  }

  // auth(roles: string[]) {
  //   if (!this.isAuth) throw new BaseError("auth-error", "Chưa xác thực", 401);
  //   if (roles.indexOf(this.token.role) !== -1) {
  //     return;
  //   } else {
  //     if (this.isTokenExpired) throw new BaseError("auth-error", "Token hết hạn", 401);
  //     throw new BaseError("auth-error", "Không đủ quyền truy cập", 401);
  //   }
  // }

  log(message: string) {
    return ActivityModel.create({ userId: this.id, username: this.username, message });
  }

  async getOwner() {
    return await UserLoader.load(this.id).then((res: any) => ({
      _id: res._id,
      name: this.username,
      phone: res.phone,
      email: res.email,
      role: res.role,
    }));
  }
  async getUser({ cached = false }) {
    if (get(this.token.payload, "type") == TokenType.STAFF) {
      if (!cached) UserLoader.clear(this.id);
      return await UserLoader.load(this.id);
    }
  }

  auth(roles: string[]) {
    this.acceptRoles(roles);
    return this;
  }
  async grant(scopes: string[]) {
    if (!this.isAuth) throw BaseErrorHelper.unauthorized();
    const user = await this.getUser({ cached: false });

    if (user.status == UserStatus.INACTIVE) {
      throw BaseErrorHelper.badToken();
    }
    if (!sift({ scopes: { $in: scopes } })(user)) {
      throw authErrorPermissionDeny;
      // throw BaseErrorHelper.permissionDeny();
    }
  }

  acceptRoles(roles: String[]) {
    if (!this.isAuth) throw authErrorPermissionDeny;
    if (this.isTokenExpired) {
      this.unsetCookie("x-token");
      throw authErrorTokenExpired;
    }
    if (roles.indexOf(this.token.role) !== -1) {
      return;
    } else {
      logger.debug(`acceptRoles: ${this.token.role} not in ${roles}`);
      this.unsetCookie("x-token");
      throw authErrorPermissionDeny;
    }
  }
  checkValidAuth(throwError = true) {
    if (this.isTokenExpired) {
      if (!throwError) return false;
      this.unsetCookie("x-token");
      throw authErrorTokenExpired;
    }
    if (!this.isAuth) {
      if (!throwError) return false;
      this.unsetCookie("x-token");
      throw authErrorUnauthorized;
    }
    return true;
  }
  isOwner(_id: string, throwError = true) {
    const validAuth = this.checkValidAuth(throwError);
    if (!validAuth) return false;
    if (this.token!._id.toString() != _id?.toString()) {
      if (!throwError) return false;
      throw authErrorPermissionDeny;
    }
    return true;
  }

  setCookie(key: string, value: string, options: any) {
    if (this.res) {
      this.res.cookie(key, value, options);
    }
  }

  unsetCookie(key: string, options: any = {}) {
    if (this.res) {
      // logger.debug(`Unset cookie ${key}`);
      this.res.clearCookie(key, options);
    }
  }
  setAccessToken(token: string, path = "/") {
    this.setCookie("x-token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: path,
    });
  }

  async checkTokenSession() {
    if (this.isAuth == true) {
      if (SECURITY_CONFIG.auth.useSession) {
        const sessionId = _.get(this.token.payload, "sessionId");
        if (!sessionId) {
          this.isTokenExpired = true;
          return;
        }
        const tokenId = this.token.role == TOKEN_ROLES.SHOP ? this.id + this.shopOwnerId : this.id;
        const tokenType =
          this.token.role == TOKEN_ROLES.SHOP
            ? "shop"
            : this.token.role == TOKEN_ROLES.CUSTOMER
            ? "customer"
            : "user";
        const currentSessionId = await cache.get(`token-session:${tokenType}:rs${tokenId}`);
        if (!currentSessionId) {
          logger.error(`Token session not found`, { id: tokenId, sessionId });
          this.isTokenExpired = true;
          return;
        }
        if (currentSessionId !== sessionId) {
          this.isTokenExpired = true;
          return;
        }
      }
    }
  }
}

export async function onContext(params: any) {
  let context: Context = new Context(params);
  await context.checkTokenSession();
  return context;
}
