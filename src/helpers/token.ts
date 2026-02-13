import config from "config";
import jwt from "jsonwebtoken";

export enum TokenType {
  STAFF = "STAFF",
  ADMIN = "ADMIN",
}
export default class Token {
  constructor(
    readonly _id: string,
    readonly role: string,
    readonly payload: any = {},
    readonly expiresIn: string | number = "30d"
  ) {}

  sign() {
    return jwt.sign({ ...this.payload, role: this.role, _id: this._id }, config.get("secret"), {
      expiresIn: this.expiresIn,
    });
  }

  static decode(token: string) {
    const { _id, role, ...payload }: any = jwt.verify(token, config.get("secret"));
    return new Token(_id, role, payload);
  }

  static decodeNotSecretKey(token: string) {
    const { _id, role, ...payload }: any = jwt.decode(token);
    return new Token(_id, role, payload);
  }
}
