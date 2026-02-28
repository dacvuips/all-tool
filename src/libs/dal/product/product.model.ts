import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { IProduct, PropertyTypeEnum } from "./product.interface";

const Schema = mongoose.Schema;

const propertyOptionSchema = new Schema(
  { key: { type: String }, label: { type: String } },
  { _id: false }
);

const propertySchema = new Schema(
  {
    type: { type: String, enum: Object.values(PropertyTypeEnum) },
    key: { type: String },
    label: { type: String },
    placeholder: { type: String },
    tooltip: { type: String },
    required: { type: Boolean },
    clearable: { type: Boolean },
    options: [propertyOptionSchema],
  },
  { _id: false }
);

const nodeConfigSchema = new Schema(
  {
    outputType: { type: String },
    providerId: { type: String },
    model: { type: String },
    baseUrl: { type: String },
    endpoint: { type: String },
    method: { type: String },
    headers: { type: String },
    bodyTemplate: { type: String },
    responsePath: { type: String },
  },
  { _id: false }
);

const flowNodeDataSchema = new Schema(
  {
    label: { type: String },
    properties: [propertySchema],
    config: nodeConfigSchema,
  },
  { _id: false }
);

const flowNodePositionSchema = new Schema(
  { x: { type: Number }, y: { type: Number } },
  { _id: false }
);

const flowNodeSchema = new Schema(
  {
    id: { type: String, required: true },
    type: { type: String, default: "productNode" },
    position: { type: flowNodePositionSchema, required: true },
    data: { type: flowNodeDataSchema, default: () => ({}) },
  },
  { _id: false }
);

const flowEdgeSchema = new Schema(
  {
    id: { type: String, required: true },
    source: { type: String, required: true },
    target: { type: String, required: true },
    sourceHandle: { type: String },
    targetHandle: { type: String },
  },
  { _id: false }
);

const productFlowSchema = new Schema(
  {
    nodes: { type: [flowNodeSchema], default: (): unknown[] => [] },
    edges: { type: [flowEdgeSchema], default: (): unknown[] => [] },
  },
  { _id: false }
);

const productSchema = new Schema(
  {
    name: { type: String, require: true },
    des: { type: String },
    video: { type: String },
    coverImg: { type: String, require: true },
    categoryIds: { type: [String], default: [] },
    slug: { type: String, require: true },
    active: { type: Boolean, default: false },
    price: { type: Number, default: 0 },
    priority: { type: Number },
    flow: {
      type: productFlowSchema,
      default: (): { nodes: unknown[]; edges: unknown[] } => ({ nodes: [], edges: [] }),
    },
  },
  { timestamps: true }
);

productSchema.index({ name: "text" }, { weights: { name: 2 } } as any);

export const ProductModel = MainConnection.model<IProduct>("Product", productSchema);

export const ProductLoader = ModelLoader(ProductModel);
