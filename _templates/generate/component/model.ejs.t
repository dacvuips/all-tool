---
to: src/libs/dal/<%= h.inflection.camelize(name, true) %>/<%= h.inflection.camelize(name, true) %>.model.ts
---
import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { I<%= h.inflection.camelize(name) %> } from "./<%= h.inflection.camelize(name, true) %>.interface";

const Schema = mongoose.Schema;

const <%= h.inflection.camelize(name, true) %>Schema = new Schema(
  {
    name: { type: String },
  },
  { timestamps: true }
);

// <%= h.inflection.camelize(name, true) %>Schema.index({ name: "text" }, { weights: { name: 2 } } as any);

export const <%= h.inflection.camelize(name) %>Model = MainConnection.model<I<%= h.inflection.camelize(name) %>>(
  "<%= h.inflection.camelize(name) %>",
  <%= h.inflection.camelize(name, true) %>Schema
);

export const <%= h.inflection.camelize(name) %>Loader = ModelLoader(<%= h.inflection.camelize(name) %>Model);
