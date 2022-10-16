const { Schema, model } = require("mongoose");

const ProductVariation = new Schema({
  product: { type: Schema.ObjectId, ref: "Product", required: true },
  volume: {
    type: String,
    enum: ["3 мл", "6 мл", "10 мл", "Набор", "Стикеры"],
    required: true,
  },
  ozonProduct: {
    type: Schema.ObjectId,
    unique: true,
    sparse: true,
    ref: "OzonProduct",
  },
  yandexProduct: {
    type: Schema.ObjectId,
    unique: true,
    sparse: true,
    ref: "YandexProduct",
  },
  wbProduct: {
    type: Schema.ObjectId,
    unique: true,
    sparse: true,
    ref: "WbProduct",
  },
  WooProduct: {
    type: Schema.ObjectId,
    unique: true,
    sparse: true,
    ref: "WooProduct",
  },
});

ProductVariation.index({ product: 1, volume: 1 }, { unique: true });

module.exports = model("ProductVariation", ProductVariation);
