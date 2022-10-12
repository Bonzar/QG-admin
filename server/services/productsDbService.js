const ProductVariation = require("../models/ProductVariation");
// const Product = require("../models/Product");
const WbProduct = require("../models/WbProduct");

module.exports.getAllVariations = async (populate = "", callback) => {
  try {
    const result = await ProductVariation.find().populate(populate).exec();

    if (callback) {
      return callback(null, result);
    }
    return result;
  } catch (e) {
    console.log(e);
    callback(e, null);
  }
};

module.exports.getWbProducts = async (callback) => {
  try {
    const result = await WbProduct.find().exec();

    if (callback) {
      return callback(null, result);
    }
    return result;
  } catch (e) {
    console.log(e);
    callback(e, null);
  }
};
