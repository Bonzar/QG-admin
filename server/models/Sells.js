const { Schema, model } = require("mongoose");

const Sells = new Schema({
  marketProductRef: {
    type: String,
    enum: ["WbProduct", "OzonProduct", "YandexProduct", "WooProduct"],
    required: true,
  },
  orderId: { type: String, required: true },
  quantity: { type: Number, required: true },
  date: { type: Date, required: true },
  marketProduct: {
    type: Schema.ObjectId,
    refPath: "marketProductRef",
    required: true,
  },
});

module.exports = model("Sells", Sells);
