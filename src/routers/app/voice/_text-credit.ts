import { CustomerModel } from "../../../libs/dal/customer";
import { TextCreditUsageModel } from "../../../libs/dal/textCreditUsage";
import { SettingHelper } from "../../../packages/setting-helper";
import { unwrapMicroxJob } from "./_microx";

function deny(message: string, statusCode: number): never {
  throw Object.assign(new Error(message), { statusCode });
}

function toAmount(value: unknown, fallback = 1): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(1, Math.round(n));
}

export function remainingTextCredit(count?: number, limit?: number): number {
  const used = Number(count) || 0;
  const cap = limit === undefined || limit === null ? 0 : Number(limit);
  if (cap === -1) return Number.POSITIVE_INFINITY;
  return Math.max(0, cap - used);
}

export async function assertTextCreditRemaining(customerId: string, minAmount = 1): Promise<void> {
  const customer = await CustomerModel.findById(customerId)
    .select(
      "googlePackage.textCreditCount googlePackage.textCreditLimit googlePackage.subscription"
    )
    .lean();
  if (!customer) deny("Không tìm thấy thông tin khách hàng", 404);

  let limit = customer.googlePackage?.textCreditLimit;
  if (limit === undefined || limit === null) {
    const plan = String(customer.googlePackage?.subscription || "free").toLowerCase();
    const fromSetting = Number(await SettingHelper.load(`pk-${plan}-text-credit`));
    limit = Number.isFinite(fromSetting) ? fromSetting : 0;
    await CustomerModel.updateOne(
      { _id: customerId, "googlePackage.textCreditLimit": { $exists: false } },
      { $set: { "googlePackage.textCreditLimit": limit, "googlePackage.textCreditCount": 0 } }
    );
  }

  const count = customer.googlePackage?.textCreditCount || 0;
  const remaining = remainingTextCredit(count, limit);
  if (remaining < minAmount) {
    deny(
      `Bạn đã hết điểm  (${count}/${
        limit === -1 ? "∞" : limit
      }). Vui lòng nâng cấp gói hoặc liên hệ admin.`,
      403
    );
  }
}

export function inferVoiceTool(job: any): string {
  const raw = String(job?.type || job?.kind || job?.task || job?.capability || "").toLowerCase();
  if (raw.includes("speech-to-text") || raw.includes("stt") || raw.includes("transcrib"))
    return "stt";
  if (raw.includes("text-to-speech") || raw.includes("tts")) return "tts";
  if (raw.includes("clone")) return "clone";
  if (raw.includes("conversion") || raw.includes("convert")) return "conversion";
  if (raw.includes("cleanup") || raw.includes("enhance") || raw.includes("denoise"))
    return "cleanup";
  return "unknown";
}

export function jobUsageAmount(job: any): number {
  const usage = job?.usage;
  return toAmount(usage?.amount ?? usage?.credits ?? usage?.credit, 1);
}

function isJobCompleted(job: any): boolean {
  const status = String(job?.status || "").toLowerCase();
  return status === "completed" || status === "succeeded" || status === "success";
}

export async function maybeConsumeTextCreditFromJob(
  customerId: string,
  payload: any,
  tool?: string
): Promise<void> {
  const job = unwrapMicroxJob(payload);
  if (!job || !isJobCompleted(job)) return;
  const jobId = String(job.id || "").trim();
  if (!jobId) return;
  await consumeTextCredit({
    customerId,
    jobId,
    tool: tool && tool !== "unknown" ? tool : inferVoiceTool(job),
    amount: jobUsageAmount(job),
    microxAmount: Number(job?.usage?.amount),
  });
}

export async function consumeTextCredit(input: {
  customerId: string;
  jobId: string;
  tool: string;
  amount: number;
  microxAmount?: number;
  description?: string;
}): Promise<void> {
  const amount = toAmount(input.amount, 1);
  const exists = await TextCreditUsageModel.exists({ jobId: input.jobId });
  if (exists) return;

  try {
    await TextCreditUsageModel.create({
      customerId: input.customerId,
      customerCode: undefined,
      jobId: input.jobId,
      tool: input.tool || "unknown",
      amount,
      microxAmount: Number.isFinite(input.microxAmount) ? input.microxAmount : amount,
      description: input.description || `Voice ${input.tool} job ${input.jobId}`,
    });
  } catch (err: any) {
    if (err?.code === 11000) return;
    throw err;
  }

  const customer = await CustomerModel.findByIdAndUpdate(
    input.customerId,
    { $inc: { "googlePackage.textCreditCount": amount } },
    { new: true }
  )
    .select("code googlePackage.textCreditCount googlePackage.textCreditLimit")
    .lean();
  if (!customer) return;

  await TextCreditUsageModel.updateOne(
    { jobId: input.jobId },
    {
      $set: {
        customerCode: customer.code,
        textCreditCountAfter: customer.googlePackage?.textCreditCount,
        textCreditLimit: customer.googlePackage?.textCreditLimit,
      },
    }
  );
}
