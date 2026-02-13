import axios, { AxiosInstance } from "axios";
import { EventEmitter } from "events";

import logger from "../logger";

export class CassoAPI extends EventEmitter {
  public api: AxiosInstance;
  constructor() {
    super();
    this.api = axios.create({
      baseURL: "https://oauth.casso.vn/v2",
      headers: {
        "content-type": "application/json",
      },
    });
    this.api.interceptors.response.use(
      (response) => {
        // console.log("response", response);
        if (response && response.data) return response.data;
        return response;
      },
      (error) => {
        logger.error(`Lỗi Casso API`, error);
        throw new Error(error.message);
      }
    );
  }

  private tokenHeader(accessToken: string) {
    return { Authorization: `ApiKey ` + accessToken };
  }

  async getToken(apiKey: string) {
    return apiKey;
  }

  getUser(accessToken: string) {
    return this.api
      .get("/userInfo", {
        headers: { ...this.tokenHeader(accessToken) },
      })
      .then((res) => res.data);
  }

  createWebhook(accessToken: string, data: any) {
    return this.api
      .post("/webhooks", data, { headers: { ...this.tokenHeader(accessToken) } })
      .then((res) => res.data);
  }

  getWehhook(accessToken: string, webhookId: string) {
    return this.api
      .get(`/webhooks/${webhookId}`, {
        headers: { ...this.tokenHeader(accessToken) },
      })
      .then((res) => res.data);
  }

  updateWebhook(accessToken: string, webhookId: string, data: any) {
    return this.api
      .put(`/webhooks/${webhookId}`, data, {
        headers: { ...this.tokenHeader(accessToken) },
      })
      .then((res) => res.data);
  }

  deleteWebhook(accessToken: string, webhookId: number) {
    return this.api
      .delete(`/webhooks/${webhookId}`, { headers: { ...this.tokenHeader(accessToken) } })
      .then((res) => res.data);
  }

  deleteWebhookByUrl(accessToken: string, url: string) {
    return this.api
      .delete(`/webhooks`, {
        headers: { ...this.tokenHeader(accessToken) },
        params: { webhook: url },
      })
      .then((res) => res.data);
  }

  async regisWebhookByApiKey(apiKey: string, url: string, secureToken: string) {
    const token = await this.getToken(apiKey);
    // Delete Toàn bộ webhook đã đăng kí trước đó
    await this.deleteWebhookByUrl(token, url);
    // Tiến hành tạo webhook
    const data = {
      webhook: url,
      secure_token: secureToken,
      income_only: true,
    };
    return await this.createWebhook(token, data);
  }
}
