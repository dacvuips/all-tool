/**
 * Enqueue job API Media — kiểm tra luồng theo token, không đụng logic app (googlePackage).
 */
import { MediaGenerationJobType } from "../../libs/dal/mediaGenerationJob";
import { assertApiMediaStreamAvailable } from "../../queues/media-generation/api-media-job-concurrency";
import {
  createAndEnqueueMediaJob,
  CreateAndEnqueueResult,
} from "../app/media-generation-job/_enqueue-helper";

export type CreateAndEnqueueApiMediaArgs = {
  customerId: string;
  apiMediaTokenId: string;
  type:
    | MediaGenerationJobType.API_MEDIA_IMAGE
    | MediaGenerationJobType.API_MEDIA_VIDEO
    | MediaGenerationJobType.API_MEDIA_UPSAMPLE_IMAGE
    | MediaGenerationJobType.API_MEDIA_UPSAMPLE_VIDEO;
  requestPayload: Record<string, unknown>;
};

export async function createAndEnqueueApiMediaJob(
  args: CreateAndEnqueueApiMediaArgs
): Promise<CreateAndEnqueueResult> {
  await assertApiMediaStreamAvailable(args.apiMediaTokenId);

  return createAndEnqueueMediaJob(
    {
      customerId: args.customerId,
      type: args.type,
      requestPayload: args.requestPayload,
      metadata: { apiMediaTokenId: args.apiMediaTokenId },
    },
    { skipStreamCheck: true }
  );
}
