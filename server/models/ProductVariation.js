const { Schema, model } = require("mongoose");

const ProductVariation = new Schema({
  product: { type: Schema.ObjectId, ref: "Product", required: true },
  volume: {
    type: String,
    enum: ["3 мл", "6 мл", "10 мл", "Набор", "Стикеры"],
    required: true,
  },
  ozonProduct: { type: Schema.ObjectId, ref: "OzonProduct" },
  yandexProduct: { type: Schema.ObjectId, ref: "YandexProduct" },
  wbProduct: { type: Schema.ObjectId, ref: "WbProduct" },
  WooProduct: { type: Schema.ObjectId, ref: "WooProduct" },
});

module.exports = model("ProductVariation", ProductVariation);
