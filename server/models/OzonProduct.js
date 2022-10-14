const { Schema, model } = require("mongoose");

const OzonProduct = new Schema({
  sku: { type: Number, unique: true, required: true },
  article: String,
  isActual: { type: Boolean, default: true },
  stock: { type: Number, default: 0 },
  stockFBS: { type: Number, default: 0 },
});

module.exports = model("OzonProduct", OzonProduct);
