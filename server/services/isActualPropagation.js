const ProductVariation = require("../models/ProductVariation");

function isActualPropagation(isActual) {
  if (isActual) {
    ProductVariation.find({ WooProduct: this.id })
      .populate()
      .exec()
      .then((result) => {
        console.log(result);
      });

    return isActual;
  }
}
module.exports = isActualPropagation;
