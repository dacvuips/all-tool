import { Schema } from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../core";
import { IAgendaJob } from "./agenda.interface";

const agendaJobSchema = new Schema(
  {
    name: { type: String },
    data: { type: Schema.Types.Mixed },
    type: { type: String },
    priority: { type: String },
    nextRunAt: { type: String },
    lastModifiedBy: { type: String },
    lockedAt: { type: String },
    lastRunAt: { type: String },
    lastFinishedAt: { type: String },
    disabled: { type: Boolean },
  },
  { timestamps: true }
);

export const AgendaJobModel = MainConnection.model<IAgendaJob>(
  "AgendaJob",
  agendaJobSchema,
  "agendaJobs"
);

export const AgendaJobLoader = ModelLoader(AgendaJobModel);
