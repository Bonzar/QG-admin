const { Schema, model } = require("mongoose");

const WooProductVariable = new Schema({
  id: { type: Number, required: true },
  article: String,
});

module.exports = model("WooProductVariable", WooProductVariable);
