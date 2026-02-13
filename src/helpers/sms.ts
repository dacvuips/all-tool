import axios, { AxiosRequestConfig } from "axios";
import config from "config";
import request, { RequestPromiseOptions } from "request-promise";

import { convertPhone } from "./functions/string";

class SMSV1 {
  static async send(phone: string, message: string) {
    const id = config.get<string>("sms.id");
    const token = config.get<string>("sms.token");
    const validPhone = convertPhone(phone, "0");
    const url = `https://smsapi.loctroi.vn:44357/api/ltgsms/Sms/SendSmsMCOM`;
    const option: AxiosRequestConfig = {
      method: "POST",
      url: url,
      params: {
        id: id,
        token: token,
        phone: validPhone,
        message: message,
      },
    };
    const response = await axios(option);
    return response.data;
  }
}

class SMSV2 {
  private static _token: string;

  private static async getToken() {
    // Get Token
    const clientId = config.get<string>("sms.v2.clientId");
    const clientSecret = config.get<string>("sms.v2.clientSecret");
    const url = `https://externalconnect-gw.loctroi.vn/auth/connect/token`;

    const option: RequestPromiseOptions = {
      method: "POST",
      form: {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      },
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      strictSSL: false,
      json: true,
    };

    const response = await request(url, option);

    return response as {
      access_token: string;
      expires_in: number;
      token_type: string;
      scope: string;
    };
  }
  static async send(phone: string, message: string) {
    if (!SMSV2._token) {
      const { access_token, expires_in } = await SMSV2.getToken();
      SMSV2._token = access_token;
      setTimeout(() => {
        SMSV2._token = null;
      }, expires_in * 1000);
    }

    const token = SMSV2._token;
    const validPhone = convertPhone(phone, "0");
    const url = `https://externalconnect-gw.loctroi.vn/otp/api/v1/s1/sendsms`;
    const option: RequestPromiseOptions = {
      method: "POST",
      body: {
        phoneNumber: validPhone,
        message: message,
      },
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      json: true,
      strictSSL: false,
    };
    const response = await request(url, option);
    return response;
  }
}

export class SMS {
  constructor() {}
  static async send(phone: string, message: string) {
    const version = config.get<string>("sms.version");
    switch (version) {
      case "1":
        return await SMSV1.send(phone, message);
      case "2":
        return await SMSV2.send(phone, message);
      default:
        return await SMSV1.send(phone, message);
    }
  }
}
