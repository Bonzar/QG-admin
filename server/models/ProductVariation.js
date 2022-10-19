const { Schema, model } = require("mongoose");

const ProductVariation = new Schema({
  product: { type: Schema.ObjectId, ref: "Product", required: true },
  volume: {
    type: String,
    enum: ["3 мл", "6 мл", "10 мл", "Набор", "Стикеры"],
    required: true,
  },
  ozonProduct: {
    type: [
      {
        type: Schema.ObjectId,
        // unique: true,
        // sparse: true,
        ref: "OzonProduct",
      },
    ],
    sparse: true,
    unique: true,
    default: undefined,
  },
  yandexProduct: {
    type: [
      {
        type: Schema.ObjectId,
        // unique: true,
        // sparse: true,
        ref: "YandexProduct",
      },
    ],
    sparse: true,
    unique: true,
    default: undefined,
  },
  wbProduct: {
    type: [
      {
        type: Schema.ObjectId,
        // unique: true,
        // sparse: true,
        ref: "WbProduct",
      },
    ],
    sparse: true,
    unique: true,
    default: undefined,
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
