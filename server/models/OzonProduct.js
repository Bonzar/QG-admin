const { Schema, model } = require("mongoose");

const OzonProduct = new Schema({
  sku: { type: Number, required: true },
  article: String,
  isActual: { type: Boolean, default: true },
  stock: { type: Number, default: 0 },
});

module.exports = model("OzonProduct", OzonProduct);
