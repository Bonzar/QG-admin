const { Schema, model } = require("mongoose");

const WooProduct = new Schema({
  id: { type: Number, required: true },
  article: String,
  type: {
    type: String,
    enum: ["simple", "variation"],
    required: true,
  },
  parentVariable: { type: Schema.ObjectId, ref: "WooProductVariable" },
  isActual: { type: Boolean, default: true },
  stock: { type: Number, default: 0 },
});

module.exports = model("WooProduct", WooProduct);
