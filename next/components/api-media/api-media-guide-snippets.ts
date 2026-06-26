import {
  ApiMediaGuideConfig,
  buildApiMediaRequestBody,
  CodeLang,
  getCreateJobTitle,
  getVideoModeHint,
  showUpsampleImageCard,
  showUpsampleVideoCard,
} from "./api-media-guide-config";

export * from "./api-media-guide-config";

export function getApiBaseUrl(): string {
  return typeof window !== "undefined" ? window.location.origin : "https://your-domain.com";
}

function getActionType(config: ApiMediaGuideConfig): string {
  return config.creationType === "image" ? "IMAGE_GENERATION" : "VIDEO_GENERATION";
}

function jsonStringify(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

export function buildCreateJobSnippet(
  apiKey: string,
  config: ApiMediaGuideConfig,
  lang: CodeLang
): string {
  const base = getApiBaseUrl();
  const action = getActionType(config);
  const body = buildApiMediaRequestBody(config);

  if (lang === "curl") {
    const payload = JSON.stringify(body).replace(/'/g, "'\\''");
    return `curl -X POST "${base}/api/api-media?type=${action}" \\
  -H "x-api-key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '${payload}'`;
  }

  return `import requests

# Bước 1 — Tạo job (trả ngay jobId, status QUEUED)
response = requests.post(
    "${base}/api/api-media?type=${action}",
    headers={
        "x-api-key": "${apiKey}",
        "Content-Type": "application/json",
    },
    json=${jsonStringify(body).replace(/\n/g, "\n    ")},
    timeout=30,
)
response.raise_for_status()
data = response.json()
job_id = data["jobId"]
print("jobId:", job_id, "status:", data.get("status"))`;
}

export function buildPollJobSnippet(apiKey: string, lang: CodeLang): string {
  const base = getApiBaseUrl();

  if (lang === "curl") {
    return `# Poll đến khi status=SUCCEEDED hoặc FAILED; dùng resultData.flow2RequestId để upscale
curl -X GET "${base}/api/api-media/job/JOB_ID" \\
  -H "x-api-key: ${apiKey}"`;
  }

  return `import requests
import time

job_id = "JOB_ID_FROM_CREATE_RESPONSE"

while True:
    res = requests.get(
        f"${base}/api/api-media/job/{job_id}",
        headers={"x-api-key": "${apiKey}"},
        timeout=30,
    )
    res.raise_for_status()
    job = res.json()["data"]
    print(job["status"], job.get("progress"), job.get("message"))

    if job["status"] in ("SUCCEEDED", "FAILED", "CANCELLED"):
        print(job.get("resultData") or job.get("errorMessage"))
        break

    time.sleep(3)`;
}

export function buildUpsampleImageSnippet(
  apiKey: string,
  config: ApiMediaGuideConfig,
  lang: CodeLang
): string {
  const base = getApiBaseUrl();
  const resolution = config.upsampleImageResolution;

  if (resolution === "2K") {
    const body = { resolution: "2K", flow2RequestId: "FLOW2_REQUEST_ID_FROM_JOB_RESULT" };
    if (lang === "curl") {
      return `# Sau khi gen_image status=SUCCEEDED (metadata giữ flow2RequestId)
curl -X POST "${base}/api/api-media/upsample-image" \\
  -H "x-api-key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(body)}'`;
    }
    return `import requests

res = requests.post(
    "${base}/api/api-media/upsample-image",
    headers={"x-api-key": "${apiKey}", "Content-Type": "application/json"},
    json=${jsonStringify(body).replace(/\n/g, "\n    ")},
    timeout=600,
)
res.raise_for_status()
print(res.json())`;
  }

  const body = {
    resolution: "4K",
    mediaId: "MEDIA_ID_FROM_JOB_RESULT",
    projectId: "PROJECT_ID_FROM_JOB_RESULT",
    profileId: "PROFILE_ID_FROM_JOB_RESULT",
  };

  if (lang === "curl") {
    return `# Upscale ảnh 4K — cần mediaId/projectId/profileId từ resultData
curl -X POST "${base}/api/api-media/upsample-image" \\
  -H "x-api-key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(body)}'`;
  }

  return `import requests

res = requests.post(
    "${base}/api/api-media/upsample-image",
    headers={"x-api-key": "${apiKey}", "Content-Type": "application/json"},
    json=${jsonStringify(body).replace(/\n/g, "\n    ")},
    timeout=600,
)
res.raise_for_status()
print(res.json())`;
}

export function buildUpsampleVideoSnippet(apiKey: string, lang: CodeLang): string {
  const base = getApiBaseUrl();
  const body = { requestId: "FLOW2_REQUEST_ID_FROM_JOB_RESULT" };

  if (lang === "curl") {
    return `# Bước 1 — enqueue upscale 1080p (poll nội bộ, tránh timeout)
curl -X POST "${base}/api/api-media/upsample-video" \\
  -H "x-api-key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(body)}'`;
  }

  return `import requests

res = requests.post(
    "${base}/api/api-media/upsample-video",
    headers={"x-api-key": "${apiKey}", "Content-Type": "application/json"},
    json=${jsonStringify(body).replace(/\n/g, "\n    ")},
    timeout=900,
)
res.raise_for_status()
print(res.json())`;
}

export { getCreateJobTitle, getVideoModeHint, showUpsampleImageCard, showUpsampleVideoCard };
