import { Schema } from "mongoose";

export const LocationSchema = new Schema({
  type: { type: Schema.Types.String, default: "Point" },
  coordinates: {
    type: [{ type: Schema.Types.Number, default: 0 }],
    minlength: 2,
    maxlength: 2,
  },
});

export const PlaceSchema = new Schema({
  street: { type: String },
  province: { type: String },
  provinceId: { type: String },
  district: { type: String },
  districtId: { type: String },
  ward: { type: String },
  wardId: { type: String },
  fullAddress: { type: String },
  location: { type: LocationSchema },
  note: { type: String },
});
PlaceSchema.index({ location: "2dsphere" });
