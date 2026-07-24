/**
 * Orchestrator upload 1 video — port từ MLS V13.3 processLocalVideoUpload.
 * Flow: preupload → CDN upload(token) → report → createPost via /api/createpost
 * dryRun=true → không gọi Shopee, giả lập thành công (test queue/UI).
 */
import fs from "fs";
import logger from "../../helpers/logger";
import { resolveEffectiveSignerCreds } from "../admin-signer-creds";
import { shopeeUploadConfig } from "../config";
import { getCountry } from "../shopee/country";
import {
  createPost,
  getUploadInfo,
  reportUpload,
  uploadFileToCdn,
} from "../shopee/api";
import { resolveAffiliateProducts } from "../shopee/product-parser";
import { withSignerCreds } from "../signer/creds-context";
import { resolveVideoToTempFile } from "./resolve-video-file";

export type UploadOneVideoInput = {
  cookie: string;
  country?: string;
  proxy?: string;
  caption?: string;
  productLink?: string;
  /** shop_id:item_id hoặc link Shopee */
  productId?: string;
  videoUrl?: string;
  videoBase64?: string;
  username?: string;
  threadId?: string;
  /** Per-customer credit (Cài đặt UI) — ưu tiên hơn env */
  signerBaseUrl?: string;
  signerApiKey?: string;
};

export type UploadOneVideoResult = {
  success: boolean;
  postId?: string;
  postLink?: string;
  error?: string;
  dryRun?: boolean;
};

/** Sinh hashtags từ caption — port MLS generateHashtagsFromCaption */
function extractHashtags(caption: string) {
  const result: { hashtag_name: string; start: number; length: number }[] = [];
  const re = /#\w+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(caption)) !== null) {
    result.push({ hashtag_name: m[0], start: m.index, length: m[0].length });
  }
  return result;
}

export async function uploadOneVideo(
  input: UploadOneVideoInput
): Promise<UploadOneVideoResult> {
  const creds = await resolveEffectiveSignerCreds({
    baseUrl: input.signerBaseUrl,
    apiKey: input.signerApiKey,
  });
  return withSignerCreds(
    { baseUrl: creds.baseUrl, apiKey: creds.apiKey },
    () => uploadOneVideoInner(input)
  );
}

async function uploadOneVideoInner(
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

  const c = getCountry(input.country);

  let cleanup: (() => void) | null = null;
  try {
    // 0. Resolve video file
    const resolved = await resolveVideoToTempFile({
      videoUrl: input.videoUrl,
      videoBase64: input.videoBase64,
      filenameHint: input.threadId || "v",
    });
    cleanup = resolved.cleanup;
    const filePath = resolved.filePath;
    const fsize = fs.statSync(filePath).size;

    // 1. Preupload → lấy vid
    const { vid } = await getUploadInfo({
      cookie: input.cookie,
      country: input.country,
      proxy: input.proxy,
    });
    logger.info(`[shopee-upload] ${label} preupload vid=${vid}`);

    // MLS processLocalVideoUpload: không gọi getExtra/precheck — createpost proxy tự xử lý ký.
    // (Bỏ precheck để khớp MLS + tránh tốn thêm 1 lần /api/sign)

    // 2. Upload file lên CDN (token từ signer /generate_token)
    await uploadFileToCdn({
      filePath,
      vid,
      cookie: input.cookie,
      country: input.country,
      proxy: input.proxy,
    });
    logger.info(`[shopee-upload] ${label} CDN upload OK`);

    // 3. Report upload
    await reportUpload({
      cookie: input.cookie,
      country: input.country,
      proxy: input.proxy,
      vid,
      fsize,
    });
    logger.info(`[shopee-upload] ${label} report OK`);

    // 4. Chuẩn bị createPost payload — format MLS processLocalVideoUpload (không có extra_context)
    const caption = input.caption || "";
    const products = resolveAffiliateProducts({
      productLink: input.productLink,
      productId: input.productId,
    });
    if (!products.length && (input.productLink || input.productId)) {
      logger.warn(
        `[shopee-upload] ${label} không parse được affiliate link/id: link=${input.productLink || "-"} id=${input.productId || "-"}`
      );
    } else if (products.length) {
      logger.info(
        `[shopee-upload] ${label} gắn ${products.length} affiliate product(s): ${products
          .map((p) => `${p.shop_id}.${p.item_id}`)
          .join(", ")}`
      );
    }
    const videoDownloadUrl = `https://down-ws-global.vod.susercontent.com/${vid}.mp4`;
    const userId = (input.cookie.match(/SPC_U=([^;]+)/) || [])[1] || "0";

    const payload = {
      content: {
        from_source: `creator_id=${userId}&pre_source=content_merge_tab`,
        caption,
        video: {
          url: videoDownloadUrl,
          video_id: vid,
          cover: "",
          width: 720,
          height: 1280,
          size: fsize,
          duration: 30000,
          watermark_cover_url: "",
          skip_cover_check: true,
          is_ugc_cover: true,
        },
        music: {
          music_id: "",
          type: 3,
          title: "",
          url: "",
          original: true,
          start: 0,
          cover: "",
          duration: 30000,
          author_name: "",
          soundtracks: [] as unknown[],
        },
        mentions: [] as unknown[],
        hashtags: extractHashtags(caption),
        products: products.map((p) => ({
          custom_name: "",
          item_id: p.item_id,
          shop_id: p.shop_id,
          source_tab: p.source_tab || 3,
          mcn_campaign_token: "",
          free_sample_info: {
            free_sample_context: "",
            need_free_sample_proof: false,
            free_sample_proof_status: 0,
          },
        })),
        post_attr: { share_to_friends: false },
        content_source: 0,
        images: [] as unknown[],
        content_type: 0,
      },
      app_info: {
        system_os: "Android",
        system_version: "34",
        app_version: "34145",
        device_model: "Brand/samsung Model/sm-g996b OSVer/34 Manufacturer/samsung",
      },
      media_sdk_info: {
        camera: {
          magic: [] as unknown[],
          media_type: 2,
          text: 0,
          magic_type: [] as unknown[],
          filter_id: [] as unknown[],
        },
        edit: [
          {
            media_type: 2,
            text: 0,
            magic_type: [] as unknown[],
            filter_id: [] as unknown[],
          },
        ],
        effect_ids: [] as unknown[],
        game_info: "",
        cover_text_info: "",
        game_magic_type: 1,
        ug_reward_context_value: "",
        use_product_clip: false,
      },
      allow_info: { allow_stitch: false, allow_duet: false },
    };

    // 5. createPost qua credit /api/createpost (MLS)
    const { postId } = await createPost({
      cookie: input.cookie,
      country: input.country,
      proxy: input.proxy,
      payload,
    });

    const postLink = `https://sv.shopee.${c.tld}/share-video/${postId}`;
    logger.info(`[shopee-upload] ${label} OK postId=${postId} link=${postLink}`);
    return { success: true, postId, postLink };
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
