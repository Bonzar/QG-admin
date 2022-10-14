const { Schema, model } = require("mongoose");

const YandexProduct = new Schema({
  sku: { type: String, unique: true, required: true },
  article: String,
  isActual: { type: Boolean, default: true },
  stock: { type: Number, default: 0 },
  stockFBS: { type: Number, default: 0 },
});

module.exports = model("YandexProduct", YandexProduct);
