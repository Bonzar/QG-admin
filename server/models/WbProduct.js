const { Schema, model } = require("mongoose");

const WbProduct = new Schema({
  sku: { type: Number, unique: true, required: true },
  article: String,
  barcode: { type: Number, required: true },
  isActual: { type: Boolean, default: true },
  stock: { type: Number, default: 0 },
  stockFBS: { type: Number, default: 0 },
});

module.exports = model("WbProduct", WbProduct);