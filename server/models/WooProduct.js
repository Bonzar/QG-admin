import { model, Schema } from "mongoose";

const WooProduct = new Schema({
  id: { type: Number, unique: true, required: true },
  article: String,
  type: {
    type: String,
    enum: ["simple", "variation"],
    required: true,
  },
  parentVariable: { type: Schema.ObjectId, ref: "WooProductVariable" },
  isActual: { type: Boolean, default: true },
  stock: { type: Number, default: 0 },
  variation: {
    type: Schema.ObjectId,
    ref: "ProductVariation",
  },
});

export default model("WooProduct", WooProduct);
