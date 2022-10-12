const { Schema, model } = require("mongoose");

const Product = new Schema({
  name: { type: String, required: true },
  isActual: { type: Boolean, default: true },
});

module.exports = model("Product", Product);
