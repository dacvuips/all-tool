import logger from "../../../helpers/logger";
import { fetchFlow2WithRetry, getFlow2Config, throwFlow2HttpError } from "./_shared";

export type UpsampleResolution = "2K" | "4K";

export type UpsampleImageWithFlow2Params =
  | { resolution: "2K"; flow2RequestId: string }
  | {
      resolution: "4K";
      mediaId: string;
      projectId: string;
      profileId: string;
    };

export type UpsampledImageResult = {
  imageBytes: string;
  mimeType: string;
};

const UPSAMPLE_TARGET_RESOLUTION: Record<UpsampleResolution, string> = {
  "2K": "UPSAMPLE_IMAGE_RESOLUTION_2K",
  "4K": "UPSAMPLE_IMAGE_RESOLUTION_4K",
};

function buildUpsampleBody(params: UpsampleImageWithFlow2Params): Record<string, string> {
  if (params.resolution === "2K") {
    return {
      request_id: params.flow2RequestId,
      target_resolution: UPSAMPLE_TARGET_RESOLUTION["2K"],
    };
  }
  return {
    media_id: params.mediaId,
    project_id: params.projectId,
    profile_id: params.profileId,
    target_resolution: UPSAMPLE_TARGET_RESOLUTION["4K"],
  };
}

export async function upsampleImageWithFlow2(
  params: UpsampleImageWithFlow2Params
): Promise<UpsampledImageResult> {
  const { baseUrl, token } = await getFlow2Config();

  const resp = await fetchFlow2WithRetry(`${baseUrl}/api/requests/upsample-image?download=true`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(buildUpsampleBody(params)),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throwFlow2HttpError("Flow2 upsample error", resp.status, errText);
  }

  const contentType = (resp.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
  const buffer = Buffer.from(await resp.arrayBuffer());

  if (contentType.includes("application/json")) {
    const json = JSON.parse(buffer.toString("utf8")) as Record<string, unknown>;
    const message =
      (typeof json.message === "string" && json.message) ||
      (typeof json.error === "string" && json.error) ||
      "Flow2 upsample không trả ảnh";
    throw new Error(message);
  }

  if (!buffer.length) {
    throw new Error("Flow2 upsample trả về file rỗng");
  }

  const logRef =
    params.resolution === "2K"
      ? `request_id=${params.flow2RequestId}`
      : `media_id=${params.mediaId}`;

  logger.info(
    `[flow2-upsample] Hoàn tất ${params.resolution} ${logRef} (${buffer.length} bytes, ${contentType})`
  );

  return {
    imageBytes: buffer.toString("base64"),
    mimeType: contentType || "image/jpeg",
  };
}
