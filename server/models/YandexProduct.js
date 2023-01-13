import { model, Schema } from "mongoose";

const YandexProduct = new Schema({
  sku: { type: String, unique: true, required: true },
  article: String,
  isActual: { type: Boolean, default: true },
  variation: {
    type: Schema.ObjectId,
    ref: "ProductVariation",
  },
  stockFbs: { type: Number, default: 0, required: true },
  stockFbsUpdateAt: { type: Date },
});

export default model("YandexProduct", YandexProduct);
