import * as dbService from "./dbService.js";
import async from "async";
export class Marketplace {
  #dbData;
  static marketProductSchema;

  constructor(search) {
    if (typeof search !== "object") {
      search = { _id: search };
    }

    this.search = search;
    this.setProductInfoFromDb(search);
  }

  /**
   * INSTANCE METHODS
   */
  getDbProduct() {
    if (this.#dbData) {
      return this.#dbData;
    }

    return this.setProductInfoFromDb(this.search);
  }

  async setProductInfoFromDb(search) {
    this.#dbData = await this.constructor.getDbProduct(search);
    return this.#dbData;
  }

  async addUpdateDbInfo(marketProductData) {
    await this.constructor.checkIdentifierExistsInApi(marketProductData);

    const marketProductDetails = await this.constructor.getMarketProductDetails(
      marketProductData
    );

    let product = await this.getDbProduct();

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
    });
  }

  async getProduct() {
    const dbProduct = await this.getDbProduct();
    const apiProduct = await this.getApiProduct();

    const connectedApiDbProduct = this.constructor.connectDbApiData(
      [dbProduct],
      apiProduct
    );

    return Object.values(connectedApiDbProduct)[0];
  }

  async getApiProduct() {
    throw new Error("Method should be overwritten and run by child class");
  }

  static async checkIdentifierExistsInApi() {
    return true;
  }

  /**
   * CLASS METHODS
   */
  static async getMarketProductDetails(marketProductData) {
    const marketProductDetails = {};

    // Common fields for all marketplaces
    if (marketProductData.sku) {
      marketProductDetails.sku = marketProductData.sku;
    }

    marketProductDetails.article = marketProductData.article
      ? marketProductData.article
      : undefined;

    marketProductDetails.isActual = marketProductData.isActual
      ? marketProductData.isActual === "true"
      : true;

    if (marketProductData.variation_volume && marketProductData.product_id) {
      marketProductDetails.variation = await dbService.getProductVariation({
        product: marketProductData.product_id,
        volume: marketProductData.variation_volume,
      });
    } else {
      marketProductDetails.variation = null;
    }

    return marketProductDetails;
  }

  static getDbProducts(filter = {}) {
    return this.marketProductSchema?.find(filter).populate({
      path: "variation",
      populate: { path: "product" },
    });
  }

  static getDbProductById(id) {
    return this.marketProductSchema?.findById(id).populate({
      path: "variation",
      populate: { path: "product" },
    });
  }

  static getDbProduct(filter = {}) {
    return this.marketProductSchema?.findOne(filter).populate({
      path: "variation",
      populate: { path: "product" },
    });
  }

  static async getProducts() {
    const data = await async.parallel({
      apiProductsData: (callback) => {
        this.getApiProducts()
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
      dbProducts: (callback) => {
        this.getDbProducts()
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
    });

    return this.connectDbApiData(data.dbProducts, data.apiProductsData);
  }

  static getApiProducts() {
    throw new Error("Method should be overwritten and run by child class");
  }

  static connectDbApiData() {
    throw new Error("Method should be overwritten and run by child class");
  }
}
