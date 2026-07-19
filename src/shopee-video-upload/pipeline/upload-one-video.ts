/**
 * Orchestrator upload 1 video (7 bước MLS).
 * dryRun=true → không gọi Shopee, giả lập thành công (test queue/UI).
 */
import fs from "fs";
import logger from "../../helpers/logger";
import { shopeeUploadConfig } from "../config";
import {
  createPost,
  getUploadInfo,
  precheck,
  reportUpload,
  uploadFileToCdn,
} from "../shopee/api";
import { productsFromLinks } from "../shopee/product-parser";
import { resolveVideoToTempFile } from "./resolve-video-file";

export type UploadOneVideoInput = {
  cookie: string;
  country?: string;
  proxy?: string;
  caption?: string;
  productLink?: string;
  productId?: string;
  videoUrl?: string;
  videoBase64?: string;
  username?: string;
  threadId?: string;
};

export type UploadOneVideoResult = {
  success: boolean;
  postId?: string;
  postLink?: string;
  error?: string;
  dryRun?: boolean;
};

export async function uploadOneVideo(
  input: UploadOneVideoInput
): Promise<UploadOneVideoResult> {
  const dryRun = shopeeUploadConfig.dryRun;
  const label = input.username || input.threadId || "upload";

  if (dryRun) {
    logger.info(`[shopee-upload] DRY_RUN ${label} — bỏ qua Shopee`);
    await sleep(800);
    return {
      success: true,
      postId: `dryrun-${Date.now()}`,
      postLink: "",
      dryRun: true,
    };
  }

  if (!String(input.cookie || "").trim()) {
    return { success: false, error: "Thiếu cookie" };
  }

  let cleanup: (() => void) | null = null;
  try {
    const resolved = await resolveVideoToTempFile({
      videoUrl: input.videoUrl,
      videoBase64: input.videoBase64,
      filenameHint: input.threadId || "v",
    });
    cleanup = resolved.cleanup;
    const filePath = resolved.filePath;
    const fsize = fs.statSync(filePath).size;

    // 1. preupload
    const { vid, upload_token } = await getUploadInfo({
      cookie: input.cookie,
      country: input.country,
      proxy: input.proxy,
    });
    logger.info(`[shopee-upload] ${label} preupload vid=${vid}`);

    // 2–3. sign + precheck
    const precheckBody = {
      mediatype: 1,
      biz: 124,
    };
    const { extra_context } = await precheck({
      cookie: input.cookie,
      country: input.country,
      proxy: input.proxy,
      body: precheckBody,
    });

    // 4–5. CDN upload
    await uploadFileToCdn({
      filePath,
      uploadToken: upload_token,
      cookie: input.cookie,
      country: input.country,
      proxy: input.proxy,
    });

    // 6. report
    await reportUpload({
      cookie: input.cookie,
      country: input.country,
      proxy: input.proxy,
      vid,
      fsize,
    });

    // 7. createPost
    const products = productsFromLinks(input.productLink || "");
    if (input.productId && products.length === 0) {
      // fallback: chỉ có item id dạng số — bỏ qua nếu không parse được shop
    }
    const payload = {
      caption: input.caption || "",
      video: {
        video_id: vid,
        cover_url: "",
        duration: 30000,
        width: 720,
        height: 1280,
        fsize,
      },
      products,
      extra_context,
      app_info: {
        device_model: "SM-G996B",
        os: "android",
        os_version: 34,
        app_version: 34145,
      },
    };

    const { postId } = await createPost({
      cookie: input.cookie,
      country: input.country,
      proxy: input.proxy,
      payload,
    });

    logger.info(`[shopee-upload] ${label} OK postId=${postId}`);
    return {
      success: true,
      postId,
      postLink: postId ? `https://sv.shopee.vn/share-video/${postId}` : "",
    };
  } catch (err: any) {
    const msg = err?.message || String(err);
    logger.error(`[shopee-upload] ${label} FAIL: ${msg}`);
    return { success: false, error: msg };
  } finally {
    cleanup?.();
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
