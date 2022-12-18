import { model, Schema } from "mongoose";

const Sells = new Schema({
  marketProductRef: {
    type: String,
    enum: ["WbProduct", "OzonProduct", "YandexProduct", "WooProduct"],
    required: true,
  },
  orderId: { type: String, required: true },
  quantity: { type: Number, required: true },
  date: { type: Date, required: true },
  marketProduct: {
    type: Schema.ObjectId,
    refPath: "marketProductRef",
    required: true,
  },
});

export default model("Sells", Sells);
