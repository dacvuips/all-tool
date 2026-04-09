import mongoose from "mongoose";
import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../core";
import {
  AiGenerationRunStatusEnum,
  AiGenerationRunTypeEnum,
  IAiGenerationRun,
} from "./ai-generation-run.interface";

const Schema = mongoose.Schema;

/** Schema cho một output ref (ảnh/video/file) */
const generationOutputRefSchema = new Schema(
  {
    type: { type: String, enum: ["image", "video", "file", "audio"] },
    attachmentId: { type: String },
    url: { type: String },
    mimeType: { type: String },
    size: { type: Number },
    order: { type: Number },
  },
  { _id: false }
);

const responseSummarySchema = new Schema(
  {
    outputCount: { type: Number },
    usageMetadata: { type: Schema.Types.Mixed },
    model: { type: String },
  },
  { _id: false }
);

const aiGenerationRunSchema = new Schema(
  {
    customerId: { type: String, required: true, index: true },
    prompt: { type: String, required: true },
    voicePrompt: { type: String, required: true },
    provider: { type: String, required: true },
    outputType: { type: String, required: true },
    type: { type: String, enum: Object.values(AiGenerationRunTypeEnum), required: true },
    status: {
      type: String,
      enum: Object.values(AiGenerationRunStatusEnum),
      default: AiGenerationRunStatusEnum.PENDING,
    },
    requestSnapshot: { type: Schema.Types.Mixed },
    responseSummary: { type: responseSummarySchema },
    resultRefs: { type: [generationOutputRefSchema], default: [] },
    errorMessage: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
    creditCost: { type: Number, default: 0 },
    creditChargedAt: { type: Date },
    creditRefundedAt: { type: Date },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

/** Index để query lịch sử theo customer, sort mới nhất trước */
aiGenerationRunSchema.index({ customerId: 1, createdAt: -1 });
aiGenerationRunSchema.index({ customerId: 1, status: 1 });

export const AiGenerationRunModel = MainConnection.model<IAiGenerationRun>(
  "AiGenerationRun",
  aiGenerationRunSchema
);
export const AiGenerationRunLoader = ModelLoader(AiGenerationRunModel);
