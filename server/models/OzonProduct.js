const { Schema, model } = require("mongoose");

const OzonProduct = new Schema({
  sku: { type: Number, unique: true, required: true },
  article: { type: String, unique: true, required: true },
  isActual: { type: Boolean, default: true },
  stock: { type: Number, default: 0 },
  stockFBS: { type: Number, default: 0 },
});

module.exports = model("OzonProduct", OzonProduct);
