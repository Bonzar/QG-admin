import axios from "axios";
import { Marketplace } from "./marketplace.js";
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
    const product = await this.getDbProduct();

    return Yandex.getApiProducts([product.sku]);
  }

  async updateApiStock(newStock) {
    const product = await this.getDbProduct();

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
        const apiProducts = {};
        response.data.result.shopSkus.forEach((apiProduct) => {
          apiProducts[apiProduct["shopSku"]] = apiProduct;
        });

        return apiProducts;
      });
  }

  static connectDbApiData(dbProducts, apiProducts) {
    for (const apiProduct of Object.values(apiProducts)) {
      apiProduct.fbsStock = apiProduct.warehouses?.[0].stocks.find(
        (stockType) => stockType.type === "FIT"
      )?.count;
    }

    for (const dbProduct of dbProducts) {
      const apiProduct = apiProducts[dbProduct.sku];
      if (!apiProduct) {
        continue;
      }

      apiProduct.dbInfo = dbProduct;
    }

    return apiProducts;
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
