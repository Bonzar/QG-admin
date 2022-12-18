import * as dbService from "./dbService.js";
import async from "async";

export class Marketplace {
  constructor(marketProductSchema) {
    this.marketProductSchema = marketProductSchema;
  }

  static getMarketProductDetails(marketProductData) {
    const marketProductDetails = {};

    // Common fields for all marketplaces
    if (marketProductData.sku) {
      marketProductDetails.sku = marketProductData.sku;
    }
    if (marketProductData?.article) {
      marketProductDetails.article = marketProductData.article;
    }
    marketProductDetails.isActual = marketProductData.isActual
      ? marketProductData.isActual === "true"
      : true;

    return marketProductDetails;
  }

  getDbProducts = (filter = {}) => {
    return this.marketProductSchema.find(filter).exec();
  };

  getDbProductById = (id) => {
    return this.marketProductSchema.findById(id).exec();
  };
}

export const MarketplaceProductInstanceMixin = {
  async addUpdateDbInfo(marketProductData) {
    await this.checkIdentifierExistsInApi(marketProductData);

    const marketProductDetails =
      Marketplace.getMarketProductDetails(marketProductData);

    let product = await this.getDbData();

    return dbService.addUpdateDbRecord(
      product,
      marketProductDetails,
      this.marketProductSchema
    );
  },

  addUpdateDbProduct(newData) {
    return async.parallel({
      updateApiStock: (callback) => {
        this.updateApiStock(newData.stockFBS)
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
      addUpdateDbInfo: (callback) => {
        this.addUpdateDbInfo(newData)
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
      variationConnect: (callback) => {
        this.getDbData()
          .then((product) => {
            dbService
              .variationUpdate(product, newData)
              .then((result) => callback(null, result));
          })
          .catch((error) => callback(error, null));
      },
    });
  },
};
