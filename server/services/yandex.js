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

  async getApiProduct() {
    const product = await this.getDbProduct();

    return Yandex.getApiProducts([product.sku]);
  }

  async updateApiStock(newStock) {
    const product = await this.getDbProduct();

    return Yandex.updateApiStock(product.sku, newStock);
  }

  static async checkIdentifierExistsInApi(newProductData) {
    let isProductExistsOnMarketplace = true;

    if (newProductData.sku) {
      const allApiOffers = await this.getApiOffers();

      isProductExistsOnMarketplace = allApiOffers.find(
        (offer) => offer.offer.shopSku === newProductData.sku
      );
    }

    if (!isProductExistsOnMarketplace) {
      throw new Error("Идентификатор товара не существует в базе маркетплейса");
    }
  }

  addUpdateProduct(newData) {
    return super.addUpdateProduct(newData, (newStock) =>
      this.updateApiStock(newStock)
    );
  }

  /**
   * CLASS METHODS
   */
  static updateApiStock(sku, stockCount) {
    return this.updateApiStocks([
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
    ]);
  }

  //todo update fbsStock in Db only on success api update
  /**
   * @param {[{warehouseId: number, sku, items: [{count, type: string, updatedAt: string}]}]} skus
   */
  static async updateApiStocks(skus) {
    // no subtract reserve because we save with reserve and subtract it when connect data

    return yandexAPI
      .put("v2/campaigns/21938028/offers/stocks.json", { skus })
      .then((response) => {
        return response.data;
      });
  }

  static getApiOffers() {
    return yandexAPI
      .get("v2/campaigns/21938028/offer-mapping-entries.json?limit=200")
      .then((response) => {
        return response.data.result.offerMappingEntries;
      });
  }

  static async getApiProducts(skusList = []) {
    if (skusList.length <= 0) {
      const offers = await this.getApiOffers();
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
        this.getApiOrders()
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

  static connectDbApiData(dbProducts, apiProductsData) {
    const { productsInfo: apiProducts, lastMonthOrders } = apiProductsData;

    for (const dbProduct of dbProducts) {
      const apiProduct = apiProducts[dbProduct.sku];
      if (!apiProduct) {
        continue;
      }

      apiProduct.fbsStock = dbProduct.stockFbs;
      apiProduct.dbInfo = dbProduct;
    }

    for (const order of lastMonthOrders) {
      for (const orderProduct of order.items) {
        const apiProduct = apiProducts[orderProduct.offerId];
        if (!apiProduct) {
          continue;
        }

        if (order.substatus === "STARTED") {
          if (!apiProduct.fbsReserve) {
            apiProduct.fbsReserve = orderProduct.count;
          } else {
            apiProduct.fbsReserve += orderProduct.count;
          }

          if (!apiProduct.fbsStock) {
            apiProduct.fbsStock = -orderProduct.count;
          } else {
            apiProduct.fbsStock -= orderProduct.count;
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
        const stockFbsUpdateAt = apiProduct.dbInfo?.stockFbsUpdateAt;

        // skip orders earlier that last stock update OR that have not last stock update date
        if (!(orderCreationDate > stockFbsUpdateAt)) {
          continue;
        }

        if (!apiProduct.fbsStock) {
          apiProduct.fbsStock = -orderProduct.count;
        } else {
          apiProduct.fbsStock -= orderProduct.count;
        }
      }
    }

    return apiProducts;
  }

  static getApiOrdersToday() {
    const today = format(new Date(), "dd-MM-yyyy");

    return this.getApiOrders({
      status: "PROCESSING",
      supplierShipmentDateFrom: today,
      supplierShipmentDateTo: today,
    });
  }

  static getApiOrdersStarted() {
    return this.getApiOrders({
      substatus: "STARTED",
    });
  }

  static getApiOrders(requestOptions = {}, useCache = true) {
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

    const cachedRequest = this.makeCachingForTime(
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

    if (Number.isFinite(marketProductData.stockFBS)) {
      marketProductDetails.stockFbs = marketProductData.stockFBS;
      marketProductDetails.stockFbsUpdateAt = new Date();
    }

    return marketProductDetails;
  }
}
