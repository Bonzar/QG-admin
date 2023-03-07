import axios from "axios";
import async from "async";
import { addDays, format as formatDate, sub as subFromDate } from "date-fns";
import * as dbService from "./dbService.js";
import OzonProduct from "../models/OzonProduct.js";
import { Marketplace } from "./marketplace.js";
import * as https from "https";

const ozonAPI = axios.create({
  baseURL: "https://api-seller.ozon.ru/",
  httpsAgent: new https.Agent({ keepAlive: true }),
  headers: {
    "Content-Type": "application/json",
    "Client-Id": process.env.OZON_CLIENTID,
    "Api-Key": process.env.OZON_APIKEY,
  },
});

//todo add errors processing for api requests
export class Ozon extends Marketplace {
  static marketProductSchema = OzonProduct;

  /**
   * INSTANCE METHODS
   */
  async #updateApiStock(newStock) {
    const product = await this._getDbProduct();

    return Ozon.#updateApiProductStock(product.article, newStock);
  }

  async #getApiStocks() {
    const product = await this._getDbProduct();

    const stocks = await Ozon.#getApiProductsStocks({
      product_id: [product.sku],
      visibility: "ALL",
    });

    return stocks[0].stocks;
  }

  async _getApiProduct() {
    const dbProduct = await this._getDbProduct();

    return Ozon._getApiProducts({
      product_id: [dbProduct.sku],
    });
  }

  static async checkIdentifierExistsInApi(newProductData) {
    if (newProductData.sku || newProductData.article) {
      const allApiProducts = await this.#getApiProductsStocks();

      if (
        !allApiProducts.find(
          (product) => +product.product_id === +newProductData.sku
        )
      ) {
        throw new Error(
          `Идентификатор товара (sku - ${newProductData.sku}) не существует в базе маркетплейса.`
        );
      }

      if (
        !allApiProducts.find(
          (product) => product.offer_id === newProductData.article
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
  static #getApiProductsStocks(filter = {}) {
    return ozonAPI
      .post("v3/product/info/stocks", {
        filter: { visibility: "ALL", ...filter },
        last_id: "",
        limit: 1000,
      })
      .then((response) => response.data.result.items);
  }

  static #getApiProductsInfo(productIds) {
    return ozonAPI
      .post("v2/product/info/list", {
        product_id: productIds,
      })
      .then((response) => {
        const apiProducts = {};
        response.data.result.items.forEach((apiProduct) => {
          apiProducts[apiProduct.id] = apiProduct;
        });

        return apiProducts;
      });
  }

  /**
   * @param {{visibility: string}} filter
   */
  static async _getApiProducts(filter) {
    const productsStocks = await this.#getApiProductsStocks(filter);

    const productsIds = productsStocks.map((product) => product.product_id);

    const productsInfo = await this.#getApiProductsInfo(productsIds);

    setTimeout(
      () => dbService.updateOzonStocks({ productsInfo, productsStocks }),
      0
    );

    return { productsInfo, productsStocks };
  }

  /**
   * @param {[{stock, offer_id}]} stocks
   */
  static async #updateApiProductsStock(stocks) {
    const productsStocks = await this.#getApiProductsStocks({
      offer_id: stocks.map((stock) => stock.offer_id),
    });

    stocks.forEach((stock) => {
      const reserveStocks = productsStocks.find(
        (reserve) => reserve.offer_id === stock.offer_id
      );
      const reserve = reserveStocks.stocks.find(
        (reserveStock) => reserveStock.type === "fbs"
      )?.reserved;

      if (Number.isFinite(reserve)) {
        stock.stock -= reserve;
      }
    });

    return (
      ozonAPI
        .post("v1/product/import/stocks", {
          stocks,
        })
        // request errors returns with 200 status and in data info
        .then((response) => {
          if (
            response.data.result.every(
              (product) =>
                product.updated ||
                product.errors.find(
                  (error) => error.code === "SKU_STOCK_NOT_CHANGE"
                )
            )
          ) {
            return { updatedAll: true, data: response.data };
          }

          return { updatedAll: false, data: response.data };
        })
        .catch((error) => {
          console.error(error);

          return {
            updatedAll: false,
            error: error.isAxiosError ? error.response?.data : error ?? error,
          };
        })
    );
  }

  static #updateApiProductStock(article, newStock) {
    return (
      this.#updateApiProductsStock([
        {
          offer_id: article,
          stock: +newStock,
        },
      ])
        // always success
        .then((result) => {
          return {
            updated: result.updatedAll,
            data: result.data.result[0],
            error:
              result.error ?? !result.updatedAll
                ? result.data.result[0].errors
                : null ?? null,
          };
        })
    );
  }

  static getApiOrdersToday() {
    const getApiTodayOrdersRequest = () => {
      const today = new Date();
      today.setHours(0, 0, 0);
      const todayStart = today.toISOString();
      today.setHours(23, 59, 59, 999);
      const todayEnd = today.toISOString();

      return ozonAPI
        .post("v3/posting/fbs/unfulfilled/list", {
          dir: "ASC",
          filter: {
            cutoff_from: todayStart,
            cutoff_to: todayEnd,
          },
          limit: 100,
          offset: 0,
          with: {},
        })
        .then((response) => response.data.result.postings);
    };

    const getApiTodayOrdersRequestCached = this._makeCachingForTime(
      getApiTodayOrdersRequest,
      [],
      "OZON-GET-API-TODAY-ORDERS",
      5 * 60 * 1000
    );

    return getApiTodayOrdersRequestCached();
  }

  static getApiOrdersOverdue() {
    const getApiOverdueOrdersRequest = async () => {
      const date = new Date();
      const today = date.setHours(0, 0, 0, 0);

      date.setHours(23, 59, 59, 999);
      const dateStart = subFromDate(date, { days: 1 });

      date.setHours(0, 0, 0, 0);
      const dateEnd = subFromDate(date, { months: 1 });

      let orders = await ozonAPI.post("v3/posting/fbs/list", {
        dir: "ASC",
        filter: {
          since: dateStart.toISOString(),
          to: dateEnd.toISOString(),
        },
        limit: 100,
        offset: 0,
        with: {},
      });

      // All overdue orders
      return orders.data.result.postings.filter((order) => {
        const orderShipmentDate = new Date(order.shipment_date).setHours(
          0,
          0,
          0,
          0
        );

        // Is order status in list AND shipment data before today
        return (
          [
            "awaiting_registration",
            "acceptance_in_progress",
            "awaiting_approve",
            "awaiting_packaging",
            "awaiting_deliver",
          ].includes(order.status) && orderShipmentDate < today
        );
      });
    };

    const getApiOverdueOrdersRequestCached = this._makeCachingForTime(
      getApiOverdueOrdersRequest,
      [],
      "OZON-GET-API-OVERDUE-ORDERS",
      5 * 60 * 1000
    );

    return getApiOverdueOrdersRequestCached();
  }

  static getAnalyticData(date_from, date_to) {
    const getAnalyticDataRequest = (date_from, date_to) =>
      ozonAPI
        .request({
          method: "post",
          url: "v1/analytics/data",
          data: {
            date_from: formatDate(date_from, "yyyy-MM-dd"),
            date_to: formatDate(date_to, "yyyy-MM-dd"),
            metrics: ["ordered_units"],
            dimension: ["sku"],
            filters: [],
            limit: 1000,
            offset: 0,
          },
        })
        .then((response) => {
          return response.data.result.data;
        });

    const getAnalyticDataRequestCached = this._makeCachingForTime(
      getAnalyticDataRequest,
      [date_from, date_to],
      "OZON-GET-ANALYTIC-DATA",
      30 * 60 * 1000
    );

    return getAnalyticDataRequestCached();
  }

  static async getApiShipmentPredict(
    dateShiftDays = 13,
    predictPeriodDays = 30,
    minStockCount = 5
  ) {
    const yesterday = subFromDate(new Date(), { days: 1 });
    const oneMonthAgo = subFromDate(yesterday, { months: 1 });
    const oneYearAgo = subFromDate(yesterday, { years: 1 });
    const oneYearOneMonthAgo = subFromDate(yesterday, {
      years: 1,
      months: 1,
    });
    const oneYearWithShiftAgo = addDays(oneYearAgo, dateShiftDays);

    const oneYearWithShiftAndPredictPeriodAgo = addDays(
      oneYearWithShiftAgo,
      predictPeriodDays
    );

    const requestsData = await async.parallel({
      oneMonthAgoOneMonthData: (callback) => {
        this.getAnalyticData(oneMonthAgo, yesterday)
          .then((results) => callback(null, results))
          .catch((error) => callback(error));
      },
      oneYearOneMonthAgoOneMonthData: (callback) => {
        this.getAnalyticData(oneYearOneMonthAgo, oneYearAgo)
          .then((results) => callback(null, results))
          .catch((error) => callback(error));
      },
      oneYearAgoShiftDaysData: (callback) => {
        this.getAnalyticData(oneYearAgo, oneYearWithShiftAgo)
          .then((results) => callback(null, results))
          .catch((error) => callback(error));
      },
      oneYearAgoOneYearData: (callback) => {
        this.getAnalyticData(oneYearAgo, yesterday)
          .then((results) => callback(null, results))
          .catch((error) => callback(error));
      },
      //
      oneYearWithShiftAgoPredictPeriodData: (callback) => {
        this.getAnalyticData(
          oneYearWithShiftAgo,
          oneYearWithShiftAndPredictPeriodAgo
        )
          .then((results) => callback(null, results))
          .catch((error) => callback(error));
      },
      // Product detailed info list and product-id/stock list
      productsFullInfo: (callback) => {
        this._getApiProducts()
          .then((results) => callback(null, results))
          .catch((error) => callback(error));
      },
      ozonDbProducts: (callback) => {
        this._getDbProducts()
          .then((products) => callback(null, products))
          .catch((error) => callback(error));
      },
    });

    const {
      oneMonthAgoOneMonthData,
      oneYearOneMonthAgoOneMonthData,
      oneYearAgoShiftDaysData,
      oneYearWithShiftAgoPredictPeriodData,
      oneYearAgoOneYearData,
      productsFullInfo,
      ozonDbProducts,
    } = requestsData;

    // Joining data and return only products with positive onShipment value
    const products = [];

    const getAllSells = (analyticData) => {
      return analyticData.reduce(
        (total, currentProduct) => total + currentProduct["metrics"][0] ?? 0,
        0
      );
    };

    const allSellsOneYearOneMonthAgoOneMonthData = getAllSells(
      oneYearOneMonthAgoOneMonthData
    );
    const allSellsOneYearAgoShiftDaysData = getAllSells(
      oneYearAgoShiftDaysData
    );
    const allSellsOneYearWithShiftAgoPredictPeriodData = getAllSells(
      oneYearWithShiftAgoPredictPeriodData
    );
    const allSellsOneYearAgoOneYearData = getAllSells(oneYearAgoOneYearData);

    const shiftPeriodByPrevYearRise =
      allSellsOneYearAgoShiftDaysData / allSellsOneYearOneMonthAgoOneMonthData;

    const predictPeriodByYearMedianRise =
      allSellsOneYearWithShiftAgoPredictPeriodData /
      allSellsOneYearAgoOneYearData;

    const predictPeriodByPrevYearRise =
      allSellsOneYearWithShiftAgoPredictPeriodData /
      (allSellsOneYearAgoShiftDaysData +
        allSellsOneYearOneMonthAgoOneMonthData);

    const connectedProducts = Object.values(
      this._connectDbApiData(ozonDbProducts, productsFullInfo)
    );

    connectedProducts.forEach((product) => {
      // Skip not actual products
      if (!product.dbInfo.isActual) {
        return;
      }

      const stock = product.fbmStock;

      const getProductSells = (product, analyticData) => {
        return product.apiInfo.sources.reduce((total, currentSource) => {
          total +=
            analyticData.find((productData) => {
              return +productData["dimensions"][0].id === currentSource.sku;
            })?.metrics[0] ?? 0;

          return total;
        }, 0);
      };

      const productSellsOneMonthAgoOneMonthData = getProductSells(
        product,
        oneMonthAgoOneMonthData
      );

      const productSellsOneYearAgoOneYearData = getProductSells(
        product,
        oneYearAgoOneYearData
      );

      const predictShiftSells =
        productSellsOneMonthAgoOneMonthData * shiftPeriodByPrevYearRise;

      const predictPeriodAfterShiftSells =
        (productSellsOneMonthAgoOneMonthData + predictShiftSells) *
        predictPeriodByPrevYearRise;

      const predictPeriodSellsByYearMedianRise =
        productSellsOneYearAgoOneYearData * predictPeriodByYearMedianRise;

      const onShipmentByPrevYearRise =
        predictPeriodAfterShiftSells + predictShiftSells - stock;
      const onShipmentByYearMedian = predictPeriodSellsByYearMedianRise - stock;
      const onShipmentByMinStockCount = minStockCount - stock;

      const onShipment = Math.max(
        onShipmentByPrevYearRise,
        onShipmentByYearMedian,
        onShipmentByMinStockCount
      );

      if (onShipment > 0) {
        products.push({
          article: product.apiInfo.offer_id,
          name: product.dbInfo?.variation?.product.name,
          stock,
          onShipmentByPrevYearRise: Math.round(onShipmentByPrevYearRise),
          onShipmentByYearMedian: Math.round(onShipmentByYearMedian),
          onShipmentByMinStockCount: Math.round(onShipmentByMinStockCount),
          onShipment: Math.round(onShipment),
        });
      }
    });

    return products;
  }

  static _connectDbApiData(dbProducts, apiProductsData) {
    const { productsInfo: apiProducts, productsStocks: apiStocks } =
      apiProductsData;

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

      connectedProduct.dbInfo = dbProduct;
    }

    for (const productsStock of apiStocks) {
      const connectedProduct = connectedProducts[productsStock.product_id];
      if (!connectedProduct) {
        continue;
      }

      const fbsStocks = productsStock.stocks.find(
        (stock) => stock.type === "fbs"
      );

      connectedProduct.fbsStock = fbsStocks?.present - fbsStocks?.reserved;
      connectedProduct.fbsReserve = fbsStocks?.reserved;
      connectedProduct.fbmStock = productsStock.stocks.find(
        (stock) => stock.type === "fbo"
      )?.present;
    }

    return connectedProducts;
  }
}
