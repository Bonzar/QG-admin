import * as dbService from "./dbService.js";
import async from "async";
export class Marketplace {
  #dbData;

  constructor(dbId) {
    this.dbId = dbId;
    this.setProductInfoFromDb(dbId);
  }

  /**
   * INSTANCE METHODS
   */
  getDbData() {
    if (this.#dbData) {
      return this.#dbData;
    }

    return this.setProductInfoFromDb(this.dbId);
  }

  setProductInfoFromDb(dbId) {
    this.#dbData = this.constructor.getDbProductById(dbId);
    return this.#dbData;
  }

  async addUpdateDbInfo(marketProductData) {
    await this.constructor.checkIdentifierExistsInApi(marketProductData);

    const marketProductDetails =
      this.constructor.getMarketProductDetails(marketProductData);

    let product = await this.getDbData();

    return dbService.addUpdateDbRecord(
      product,
      marketProductDetails,
      this.constructor.marketProductSchema
    );
  }

  addUpdateProduct(newData, apiStockUpdater) {
    return async.parallel({
      updateApiStock: (callback) => {
        apiStockUpdater(newData.stockFBS)
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
  }

  static async checkIdentifierExistsInApi() {
    return true;
  }

  /**
   * CLASS METHODS
   */
  //fixme article cant be empty when it was set at least once
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

  static getDbProducts(filter = {}) {
    return this.marketProductSchema?.find(filter).exec();
  }

  static getDbProductById(id) {
    return this.marketProductSchema?.findById(id).exec();
  }
}
