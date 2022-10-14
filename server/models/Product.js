const { Schema, model } = require("mongoose");

const Product = new Schema({
  name: { type: String, unique: true, required: true },
  isActual: { type: Boolean, default: true },
});

module.exports = model("Product", Product);
