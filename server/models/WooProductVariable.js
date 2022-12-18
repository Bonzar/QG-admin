import { model, Schema } from "mongoose";

const WooProductVariable = new Schema({
  id: { type: Number, unique: true, required: true },
  article: String,
});

export default model("WooProductVariable", WooProductVariable);
