import axios from "axios";
import { Marketplace } from "./marketplace.js";
import YandexProduct from "../models/YandexProduct.js";
import { format, parse as dateParse } from "date-fns";
import async from "async";
import https from "https";

const yandexAPI = axios.create({
  baseURL: "https://api.partner.market.yandex.ru/",
  httpsAgent: new https.Agent({ keepAlive: true }),
  headers: {
    "Content-Type": "application/json",
    Authorization: `OAuth oauth_token="${process.env.YANDEX_OAUTHTOKEN}", oauth_client_id="${process.env.YANDEX_CLIENTID}"`,
  },
});

export class Yandex extends Marketplace {
  static marketProductSchema = YandexProduct;

  /**
   * INSTANCE METHODS
   */

  async _getApiProduct() {
    const product = await this._getDbProduct();

    return Yandex._getApiProducts([product.sku]);
  }

  async #updateApiStock(newStock) {
    const product = await this._getDbProduct();

    return Yandex.#updateApiProductStock(product.sku, newStock);
  }

  static async checkIdentifierExistsInApi(newProductData) {
    if (newProductData.sku || newProductData.article) {
      const allApiOffers = await this.#getApiOffers();

      if (
        !allApiOffers.find(
          (offer) => offer.offer.shopSku === newProductData.sku
        )
      ) {
        throw new Error(
          `Идентификатор товара (sku - ${newProductData.sku}) не существует в базе маркетплейса.`
        );
      }

      if (
        !allApiOffers.find(
          (offer) => offer.offer.vendorCode === newProductData.article
        )
      ) {
        throw new Error(
          `Идентификатор товара (article - ${newProductData.article}) не существует в базе маркетплейса.`
        );
      }
    }
  }

  addUpdateProduct(newData) {
    return super.addUpdateProduct(newData, (newStock) =>
      this.#updateApiStock(newStock)
    );
  }

  /**
   * CLASS METHODS
   */
  static #updateApiProductStock(sku, stockCount) {
    return this.#updateApiProductsStock([
      {
        sku,
        warehouseId: 52301,
        items: [
          {
            type: "FIT",
            count: stockCount,
            updatedAt: new Date().toISOString(),
          },
        ],
      },
      // always success
    ]).then((result) => {
      return {
        updated: result.updatedAll,
        error: result.error ?? null,
      };
    });
  }

  //todo update fbsStock in Db only on success api update
  /**
   * @param {[{warehouseId: number, sku, items: [{count: number, type: string, updatedAt: string}]}]} skus
   */
  static async #updateApiProductsStock(skus) {
    // no subtract reserve because we save with reserve and subtract it when connect data

    return yandexAPI
      .put("v2/campaigns/21938028/offers/stocks.json", { skus })
      .then((response) => {
        return {
          updatedAll: response.data.status === "OK",
          error: response.data.status === "ERROR" ? response.data.errors : null,
        };
      })
      .catch((error) => {
        console.error(error);

        return {
          updatedAll: false,
          error: error.isAxiosError ? error.response?.data : error ?? error,
        };
      });
  }

  static #getApiOffers() {
    return yandexAPI
      .get("v2/campaigns/21938028/offer-mapping-entries.json?limit=200")
      .then((response) => {
        return response.data.result.offerMappingEntries;
      });
  }

  static async _getApiProducts(skusList = []) {
    if (skusList.length <= 0) {
      const offers = await this.#getApiOffers();
      skusList = offers.map((offer) => offer.offer.shopSku);
    }

    const apiData = await async.parallel({
      apiProductsData: (callback) => {
        yandexAPI
          .post("v2/campaigns/21938028/stats/skus", {
            shopSkus: skusList,
          })
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
      lastMonthOrders: (callback) => {
        this.#getApiOrders()
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
    });

    const apiProducts = {};
    apiData.apiProductsData.data.result.shopSkus.forEach((apiProduct) => {
      apiProducts[apiProduct["shopSku"]] = apiProduct;
    });

    return {
      productsInfo: apiProducts,
      lastMonthOrders: apiData.lastMonthOrders,
    };
  }

  static _connectDbApiData(dbProducts, apiProductsData) {
    const { productsInfo: apiProducts, lastMonthOrders } = apiProductsData;

    const connectedProducts = {};

    for (const [apiProductSku, apiProductData] of Object.entries(apiProducts)) {
      connectedProducts[apiProductSku] = {
        apiInfo: Object.freeze(apiProductData),
      };
    }

    for (const dbProduct of dbProducts) {
      let connectedProduct = connectedProducts[dbProduct.sku];
      if (!connectedProduct) {
        connectedProducts[dbProduct.sku] = {};
        connectedProduct = connectedProducts[dbProduct.sku];
      }

      connectedProduct.fbsStock = dbProduct.stockFbs;
      connectedProduct.dbInfo = dbProduct;
    }

    for (const order of lastMonthOrders) {
      for (const orderProduct of order.items) {
        const connectedProduct = connectedProducts[orderProduct.offerId];
        if (!connectedProduct) {
          continue;
        }

        if (order.substatus === "STARTED") {
          if (!connectedProduct.fbsReserve) {
            connectedProduct.fbsReserve = orderProduct.count;
          } else {
            connectedProduct.fbsReserve += orderProduct.count;
          }

          if (!connectedProduct.fbsStock) {
            connectedProduct.fbsStock = -orderProduct.count;
          } else {
            connectedProduct.fbsStock -= orderProduct.count;
          }

          continue;
        }

        // skip not sold products
        if (["CANCELLED", "REJECTED", "UNPAID"].includes(order.status)) {
          continue;
        }

        // const orderCreationDate = new Date(order.creationDate);
        const orderCreationDate = dateParse(
          order.creationDate,
          "dd-MM-yyyy HH:mm:ss",
          new Date()
        );
        const stockFbsUpdateAt = connectedProduct.dbInfo?.stockFbsUpdateAt;

        // skip orders earlier that last stock update OR that have not last stock update date
        if (!(orderCreationDate > stockFbsUpdateAt)) {
          continue;
        }

        if (!connectedProduct.fbsStock) {
          connectedProduct.fbsStock = -orderProduct.count;
        } else {
          connectedProduct.fbsStock -= orderProduct.count;
        }
      }
    }

    return connectedProducts;
  }

  static getApiOrdersToday() {
    const today = format(new Date(), "dd-MM-yyyy");

    return this.#getApiOrders({
      status: "PROCESSING",
      supplierShipmentDateFrom: today,
      supplierShipmentDateTo: today,
    });
  }

  static #getApiOrdersStarted() {
    return this.#getApiOrders({
      substatus: "STARTED",
    });
  }

  static #getApiOrders(requestOptions = {}, useCache = true) {
    let optionsString = Object.entries(requestOptions)
      .map(([key, value]) => `${key}=${value}`)
      .join("&");

    const getApiOrdersRequest = (optionsString) => {
      return yandexAPI
        .get(`v2/campaigns/21938028/orders?${optionsString}`)
        .then(async (response) => {
          const additionalOrders = [];
          if (response.data.pager.pagesCount > 1) {
            const additionalOrdersRequests = [];
            for (
              let pageIndex = 2;
              pageIndex <= response.data.pager.pagesCount;
              pageIndex++
            ) {
              additionalOrdersRequests.push((callback) => {
                return yandexAPI
                  .get(
                    `v2/campaigns/21938028/orders?page=${pageIndex}&${optionsString}`
                  )
                  .then((response) => callback(null, response.data.orders))
                  .catch((error) => callback(error, null));
              });
            }

            const additionalOrdersPacks = await async.parallelLimit(
              additionalOrdersRequests,
              3
            );
            additionalOrdersPacks.forEach((orderPack) =>
              additionalOrders.push(...orderPack)
            );
          }

          return [...response.data.orders, ...additionalOrders];
        });
    };

    const cachedRequest = this._makeCachingForTime(
      getApiOrdersRequest,
      [optionsString],
      "YANDEX-GET-API-ORDERS",
      5 * 60 * 1000,
      !useCache
    );

    return cachedRequest();
  }

  static async getMarketProductDetails(marketProductData) {
    const marketProductDetails = await super.getMarketProductDetails(
      marketProductData
    );

    const stockFbs = +marketProductData.stockFBS;
    if (Number.isFinite(stockFbs)) {
      marketProductDetails.stockFbs = stockFbs;
      marketProductDetails.stockFbsUpdateAt = new Date();
    }

    return marketProductDetails;
  }
}
