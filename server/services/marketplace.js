import * as dbService from "./dbService.js";
import async from "async";
export class Marketplace {
  #dbData;
  static marketProductSchema;
  static cacheStore = {};

  constructor(search) {
    if (typeof search !== "object") {
      search = { _id: search };
    }

    this.search = search;
  }

  /**
   * INSTANCE METHODS
   */
  _getDbProduct() {
    if (this.#dbData) {
      return this.#dbData;
    }

    return this.#setProductInfoFromDb(this.search);
  }

  async #setProductInfoFromDb(search) {
    this.#dbData = await this.constructor._getDbProduct(search);
    if (!this.#dbData) {
      const error = new Error("Market product not found in db");
      error.code = "NO-DB-DATA";

      throw error;
    }

    return this.#dbData;
  }

  async #addUpdateDbInfo(marketProductData) {
    await this.constructor.checkIdentifierExistsInApi(marketProductData);

    const marketProductDetails = await this.constructor.getMarketProductDetails(
      marketProductData
    );

    let product = await this._getDbProduct();

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
        this.#addUpdateDbInfo(newData)
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
    });
  }

  updateStock(newStock, apiStockUpdater) {
    return this.addUpdateProduct({ stockFBS: newStock }, apiStockUpdater);
  }

  async getProduct() {
    const dbProduct = await this._getDbProduct();
    const apiProduct = await this._getApiProduct();

    const connectedApiDbProduct = this.constructor._connectDbApiData(
      [dbProduct],
      apiProduct
    );

    return Object.values(connectedApiDbProduct)[0];
  }

  async _getApiProduct() {
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

    if (marketProductData.article) {
      marketProductDetails.article =
        marketProductData.article !== ""
          ? marketProductData.article
          : undefined;
    }

    marketProductDetails.isActual = marketProductData.isActual
      ? marketProductData.isActual === "true"
      : true;

    if (marketProductData.variation_volume && marketProductData.product_id) {
      marketProductDetails.variation = await dbService.getProductVariation({
        product: marketProductData.product_id,
        volume: marketProductData.variation_volume,
      });
    } else if (
      marketProductData.variation_volume === "" ||
      marketProductData.product_id === ""
    ) {
      marketProductDetails.variation = null;
    }

    return marketProductDetails;
  }

  static _getDbProducts(filter = {}) {
    return this.marketProductSchema?.find(filter).populate({
      path: "variation",
      populate: { path: "product" },
    });
  }

  static _getDbProductById(id) {
    return this.marketProductSchema?.findById(id).populate({
      path: "variation",
      populate: { path: "product" },
    });
  }

  static _getDbProduct(filter = {}) {
    return this.marketProductSchema?.findOne(filter).populate({
      path: "variation",
      populate: { path: "product" },
    });
  }

  static async getProducts() {
    const data = await async.parallel({
      apiProductsData: (callback) => {
        this._getApiProducts()
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
      dbProducts: (callback) => {
        this._getDbProducts()
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
    });

    return this._connectDbApiData(data.dbProducts, data.apiProductsData);
  }

  static _getApiProducts() {
    throw new Error("Method should be overwritten and run by child class");
  }

  static _connectDbApiData() {
    throw new Error("Method should be overwritten and run by child class");
  }

  static _makeCachingForTime(
    func,
    argsList,
    funcCode,
    cacheTime,
    forceUpdate = false
  ) {
    return () => {
      const cacheStoreKey = `${funcCode}-args:${JSON.stringify(argsList)}`;

      if (
        this.cacheStore[cacheStoreKey]?.cacheEndTime > Date.now() &&
        !forceUpdate
      ) {
        return this.cacheStore[cacheStoreKey].funcResult;
      }

      const updatedResult = func(...argsList);
      this.cacheStore[cacheStoreKey] = {
        funcCode,
        cacheEndTime: Date.now() + cacheTime,
        funcResult: updatedResult,
      };

      return updatedResult;
    };
  }

  /**
   * @param {string || boolean} cacheKeyToDelete key to delete OR if true then clear all cache
   */
  static _clearCache(cacheKeyToDelete) {
    if (cacheKeyToDelete === true) {
      this.cacheStore = {};
    } else
      Object.entries(this.cacheStore).forEach(([cacheKey, cacheValue]) => {
        if (cacheValue.funcCode === cacheKeyToDelete) {
          delete this.cacheStore[cacheKey];
        }
      });
  }
}
