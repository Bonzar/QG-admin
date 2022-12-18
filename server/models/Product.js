import { model, Schema } from "mongoose";

const Product = new Schema({
  name: { type: String, unique: true, required: true },
  isActual: { type: Boolean, default: true },
});

export default model("Product", Product);
