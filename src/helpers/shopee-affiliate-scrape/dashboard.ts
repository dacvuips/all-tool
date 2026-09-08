import axios from "axios";
import { isAffiliateHost } from "./domains";

export interface AffiliateDashboardDetailInput {
  marketHost?: string;
  cookie: string;
  startTime: number;
  endTime: number;
}

/**
 * GET /api/v3/dashboard/detail — dùng cookie riêng của từng profile (không qua session
 * global capture bằng CDP), vì tính năng Doanh thu cần gọi nhiều profile không mở trình duyệt.
 */
export async function fetchAffiliateDashboardDetail(
  input: AffiliateDashboardDetailInput
): Promise<any> {
  const cookie = String(input.cookie || "").trim();
  if (!cookie) {
    throw new Error("Thiếu cookie của profile — hãy cập nhật cookie ở tab Quản lý Profile.");
  }
  const marketHost = isAffiliateHost(String(input.marketHost || ""))
    ? String(input.marketHost).toLowerCase()
    : "affiliate.shopee.vn";
  const startTime = Number(input.startTime);
  const endTime = Number(input.endTime);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
    throw new Error("Thiếu start_time/end_time hợp lệ.");
  }

  const url = `https://${marketHost}/api/v3/dashboard/detail?start_time=${startTime}&end_time=${endTime}`;
  const res = await axios.get(url, {
    timeout: 60000,
    headers: {
      accept: "application/json, text/plain, */*",
      "affiliate-program-type": "1",
      cookie,
      referer: `https://${marketHost}/dashboard`,
      origin: `https://${marketHost}`,
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    validateStatus: () => true,
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error(`HTTP ${res.status} — cookie hết hạn hoặc chưa đăng nhập Affiliate.`);
  }
  if (res.status >= 400) {
    throw new Error(
      `HTTP ${res.status}: ${typeof res.data === "string" ? res.data.slice(0, 200) : res.statusText}`
    );
  }
  const json = res.data;
  if (json?.code !== 0 && json?.code !== undefined) {
    throw new Error(json.msg || json.message || `API error code: ${json.code}`);
  }
  return json?.data ?? json;
}
