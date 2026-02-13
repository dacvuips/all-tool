import fs from "fs";
import _ from "lodash";
import moment from "moment-timezone";
import passwordHash from "password-hash";
import path from "path";
import { v4 as uuidV4 } from "uuid";
import { validateJSON } from "./validateJSON";

export class UtilsHelper {
  constructor() {}
  static parseDateFilter(query: { startDate: string; endDate: string }) {
    validateJSON(query, { required: ["startDate", "endDate"] });
    const startDate = moment(query.startDate, "YYYY-MM-DD").startOf("day").toDate();
    const endDate = moment(query.endDate, "YYYY-MM-DD").endOf("day").toDate();
    return { startDate, endDate };
  }

  static toBoolean(value: string) {
    return _.upperCase(value) == "TRUE";
  }
  static toMoney(text = 0, digit = 0) {
    var re = "\\d(?=(\\d{3})+" + (digit > 0 ? "\\." : "$") + ")";
    return text.toFixed(Math.max(0, ~~digit)).replace(new RegExp(re, "g"), "$&,");
  }
  static walkSyncFiles(dir: string, filelist: string[] = []) {
    const files = fs.readdirSync(dir);
    files.forEach(function (file: any) {
      if (fs.statSync(path.join(dir, file)).isDirectory()) {
        filelist = UtilsHelper.walkSyncFiles(path.join(dir, file), filelist);
      } else {
        filelist.push(path.join(dir, file));
      }
    });
    return filelist;
  }
  static parsePhone(phone: string, pre: string) {
    if (!phone) return phone;
    let newPhone = "" + phone;
    newPhone = newPhone
      .replace(/^\+84/i, pre)
      .replace(/^\+0/i, pre)
      .replace(/^0/i, pre)
      .replace(/^84/i, pre);

    return newPhone;
  }

  static isEmail(email: string) {
    const re =
      /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
  }
  static isPhone(phone: string) {
    return /(84|0[3|5|7|8|9])+([0-9]{8})\b/.test(phone);
  }
  static parseObjectWithInfo(params: { object: any; info: any }) {
    const { info, object } = params;
    let encodeData = JSON.stringify(object);
    encodeData = this.parseStringWithInfo({ data: encodeData, info });
    try {
      return JSON.parse(encodeData);
    } catch (err) {
      return object;
    }
  }
  static parseStringWithInfo(params: { data: string; info: any }) {
    const { data, info } = params;
    let messageText = "" + data;
    const stringRegex = /{{(.*?)}}/g;
    messageText = messageText.replace(stringRegex, (m: any, field: string) => {
      let data = _.get(info, field.trim());
      if (_.isString(data) || _.isNumber(data)) {
        data = JSON.stringify(data)
          .replace(/\\n/g, "\\n")
          .replace(/\\'/g, "\\'")
          .replace(/\\"/g, '\\"')
          .replace(/\\&/g, "\\&")
          .replace(/\\r/g, "\\r")
          .replace(/\\t/g, "\\t")
          .replace(/\\b/g, "\\b")
          .replace(/\\f/g, "\\f")
          .replace(/^\"(.*)\"$/g, "$1");
      } else if (_.isObject(data) || _.isBoolean(data)) {
        data = `<<Object(${JSON.stringify(data)})Object>>`;
      }
      return data || "";
    });
    return messageText.replace(
      /\:\"(?: +)?<<Object\((true|false|[\{|\[].*?[\}|\]])\)Object>>(?: +)?\"/g,
      ":$1"
    );
  }

  static hashPassword(password: string) {
    if (password.length < 6) throw Error("Mật khẩu phải có ít nhất 6 ký tự.");
    return passwordHash.generate(password);
  }
  static verifyPassword(password: string, hashedPassword: string) {
    return passwordHash.verify(password, hashedPassword);
  }
  static isVietnamesePhoneNumber(number: string) {
    if (!/^((\+84|0|84)[3|5|7|8|9])+([0-9]{8})$/g.test(number)) {
      throw Error("Số điện thoại không đúng định dạng");
    }
    return true;
  }

  static generateUuidV4(): string {
    return uuidV4();
  }
}
