import { model, Schema } from "mongoose";

const ProductVariation = new Schema({
  product: { type: Schema.ObjectId, ref: "Product", required: true },
  volume: {
    type: String,
    enum: ["3 мл", "6 мл", "10 мл", "60 мл", "120 мл", "Набор", "Стикеры"],
    required: true,
  },
  readyStock: { type: Number, required: true, default: 0 },
  dryStock: { type: Number, required: true, default: 0 },
  stockOnError: { type: Number },
  stockUpdateStatus: {
    type: String,
    enum: ["updated", "update-failed-reverted", "update-failed-revert-failed"],
    required: true,
    default: "updated",
  },
});

ProductVariation.index({ product: 1, volume: 1 }, { unique: true });

export default model("ProductVariation", ProductVariation);
