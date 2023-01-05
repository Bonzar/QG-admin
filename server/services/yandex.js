import axios from "axios";
import { Marketplace } from "./marketplace.js";
import async from "async";
import * as dbService from "./dbService.js";
import YandexProduct from "../models/YandexProduct.js";
import { format } from "date-fns";

const yandexAPI = axios.create({
  baseURL: "https://api.partner.market.yandex.ru/",
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
    const product = await this.getDbData();

    return Yandex.getApiProduct(product.sku);
  }

  async updateApiStock(newStock) {
    const product = await this.getDbData();

    return Yandex.updateApiStock(product.sku, newStock);
  }

  static async checkIdentifierExistsInApi(newProductData) {
    const allApiOffers = await this.getApiOffers();

    const isProductExistsOnMarketplace = allApiOffers.find(
      (offer) => offer.offer.shopSku === newProductData.sku
    );

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

  /**
   * @param {[{warehouseId: number, sku, items: [{count, type: string, updatedAt: string}]}]} skus
   */
  static updateApiStocks(skus) {
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

    // List of all products
    return yandexAPI
      .post("v2/campaigns/21938028/stats/skus.json", {
        shopSkus: skusList,
      })
      .then((response) => {
        return response.data.result.shopSkus;
      });
  }

  static async getApiProduct(sku) {
    const result = await this.getApiProducts([sku]);

    return result[0];
  }

  static async getProducts(
    filters,
    connectYandexDataResultFormatter,
    allDbVariations
  ) {
    const yandexData = await async.parallel({
      yandexApiProducts: (callback) => {
        this.getApiProducts()
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
      yandexDbProducts: (callback) => {
        this.getDbProducts()
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
      dbVariations: (callback) => {
        if (!allDbVariations) {
          dbService
            .getAllVariations({}, ["product yandexProduct"])
            .then((result) => callback(null, result))
            .catch((error) => callback(error, null));
          return;
        }

        callback(null, allDbVariations);
      },
    });

    return async.parallel(
      this.#getConnectYandexDataRequests(
        filters,
        yandexData.yandexApiProducts,
        yandexData.yandexDbProducts,
        yandexData.dbVariations,
        connectYandexDataResultFormatter
      )
    );
  }

  static getDbProductAndVariationForApiProduct(
    apiProduct,
    allDbVariations,
    yandexDbProducts
  ) {
    let dbProduct;
    // Search variation for market product from api
    const dbVariation = allDbVariations.find(
      (variation) =>
        // Search market product in db for market product from api
        variation.yandexProduct?.filter((variationYandexDbProduct) => {
          const isMarketProductMatch =
            variationYandexDbProduct.sku === apiProduct["shopSku"];
          // find -> save market product
          if (isMarketProductMatch) {
            dbProduct = variationYandexDbProduct;
          }

          return isMarketProductMatch;
        }).length > 0
    );

    if (!dbProduct) {
      // Search fetched product from ozon in DB
      dbProduct = yandexDbProducts.find(
        (yandexDbProduct) => yandexDbProduct.sku === apiProduct["shopSku"]
      );
    }

    return { dbVariation, dbProduct };
  }

  static #getConnectYandexDataRequests(
    filters,
    yandexApiProducts,
    yandexDbProducts,
    allDbVariations,
    connectYandexDataResultFormatter
  ) {
    return yandexApiProducts.map((yandexApiProduct) => {
      return async () => {
        const { dbVariation, dbProduct } =
          this.getDbProductAndVariationForApiProduct(
            yandexApiProduct,
            allDbVariations,
            yandexDbProducts
          );

        const yandexStock =
          yandexApiProduct.warehouses?.[0].stocks.find(
            (stockType) => stockType.type === "FIT"
          )?.count ?? 0;

        // Filtration
        let isPassFilterArray = [];
        // by stock status
        if (filters.stock_status === "outofstock") {
          isPassFilterArray.push(yandexStock <= 0);
        }
        // by actual (manual setup in DB)
        switch (filters.isActual) {
          case "notActual":
            isPassFilterArray.push(dbProduct?.isActual === false);
            break;
          case "all":
            isPassFilterArray.push(true);
            break;
          // Only actual by default
          default:
            isPassFilterArray.push(dbProduct?.isActual !== false);
        }

        if (!isPassFilterArray.every((pass) => pass)) return;

        return connectYandexDataResultFormatter(
          dbVariation,
          dbProduct,
          yandexApiProduct,
          yandexStock
        );
      };
    });
  }

  static getApiTodayOrders() {
    const today = format(new Date(), "dd-MM-yyyy");

    return this.getApiOrders({
      status: "PROCESSING",
      supplierShipmentDateFrom: today,
      supplierShipmentDateTo: today,
    });
  }

  static getApiStartedOrders() {
    return this.getApiOrders({
      substatus: "STARTED",
    });
  }

  //todo add pagination
  static getApiOrders(options = {}) {
    let optionsString = Object.entries(options)
      .map(([key, value]) => `${key}=${value}`)
      .join("&");

    return yandexAPI
      .get(`v2/campaigns/21938028/orders.json?${optionsString}`)
      .then((response) => {
        return response.data.orders;
      });
  }
}
