import axios from "axios";
import async from "async";
import { format as formatDate, sub as subFromDate, addDays } from "date-fns";
import * as dbService from "./dbService.js";
import OzonProduct from "../models/OzonProduct.js";
import { Marketplace } from "./marketplace.js";

const ozonAPI = axios.create({
  baseURL: "https://api-seller.ozon.ru/",
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
  async updateApiStock(newStock) {
    const product = await this.getDbProduct();

    return Ozon.updateApiStock(product.article, newStock);
  }

  async getApiStocks() {
    const product = await this.getDbProduct();

    const stocks = await Ozon.getApiProductsStocks({
      product_id: [product.sku],
      visibility: "ALL",
    });

    return stocks[0].stocks;
  }

  async getApiProduct() {
    const dbProduct = await this.getDbProduct();

    return Ozon.getApiProducts({
      product_id: [dbProduct.sku],
    });
  }

  static async checkIdentifierExistsInApi(newProductData) {
    const allApiProducts = await this.getApiProductsStocks();

    const isProductExistsOnMarketplace = [
      allApiProducts.find(
        (product) => +product.product_id === +newProductData.sku
      ),
      allApiProducts.find(
        (product) => product.offer_id === newProductData.article
      ),
    ].every((check) => check);

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
  static getApiProductsStocks(filter = {}) {
    return ozonAPI
      .post("v3/product/info/stocks", {
        filter: { visibility: "ALL", ...filter },
        last_id: "",
        limit: 1000,
      })
      .then((response) => response.data.result.items);
  }

  static getApiProductsInfo(productIds) {
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
  static async getApiProducts(filter) {
    const productsStocks = await this.getApiProductsStocks(filter);

    const productsIds = productsStocks.map((product) => product.product_id);

    const productsInfo = await this.getApiProductsInfo(productsIds);

    setTimeout(
      () => dbService.updateOzonStocks({ productsInfo, productsStocks }),
      0
    );

    return { productsInfo, productsStocks };
  }

  /**
   * @param {[{stock, offer_id}]} stocks
   */
  static updateApiStocks(stocks) {
    return ozonAPI
      .post("v1/product/import/stocks", {
        stocks,
      })
      .then((response) => {
        return response.data;
      });
  }

  static updateApiStock(article, newStock) {
    return this.updateApiStocks([
      {
        offer_id: article,
        stock: +newStock,
      },
    ]);
  }

  static getApiTodayOrders() {
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
  }

  static async getApiOverdueOrders() {
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
  }

  static async getApiShipmentPredict(
    dateShiftDays = 13,
    predictPeriodDays = 30
  ) {
    const getAnalyticData = (date_from, date_to) => {
      return ozonAPI
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
    };

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
        getAnalyticData(oneMonthAgo, yesterday)
          .then((results) => callback(null, results))
          .catch((error) => callback(error));
      },
      oneYearOneMonthAgoOneMonthData: (callback) => {
        getAnalyticData(oneYearOneMonthAgo, oneYearAgo)
          .then((results) => callback(null, results))
          .catch((error) => callback(error));
      },
      oneYearAgoShiftDaysData: (callback) => {
        getAnalyticData(oneYearAgo, oneYearWithShiftAgo)
          .then((results) => callback(null, results))
          .catch((error) => callback(error));
      },
      //
      oneYearWithShiftAgoPredictPeriodData: (callback) => {
        getAnalyticData(
          oneYearWithShiftAgo,
          oneYearWithShiftAndPredictPeriodAgo
        )
          .then((results) => callback(null, results))
          .catch((error) => callback(error));
      },
      // Product detailed info list and product-id/stock list
      productsFullInfo: (callback) => {
        this.getApiProducts()
          .then((results) => callback(null, results))
          .catch((error) => callback(error));
      },
      ozonDbProducts: (callback) => {
        this.getDbProducts()
          .then((products) => callback(null, products))
          .catch((error) => callback(error));
      },
    });

    const {
      oneMonthAgoOneMonthData,
      oneYearOneMonthAgoOneMonthData,
      oneYearAgoShiftDaysData,
      oneYearWithShiftAgoPredictPeriodData,
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

    const shiftRise =
      allSellsOneYearAgoShiftDaysData / allSellsOneYearOneMonthAgoOneMonthData;

    const predictPeriodRise =
      allSellsOneYearWithShiftAgoPredictPeriodData /
      (allSellsOneYearAgoShiftDaysData +
        allSellsOneYearOneMonthAgoOneMonthData);

    const connectedProducts = Object.values(
      this.connectDbApiData(ozonDbProducts, productsFullInfo)
    );

    connectedProducts.forEach((product) => {
      // Skip not actual products
      if (!product.dbInfo.isActual) {
        return;
      }

      const stock = product.fbmStock;

      const getProductSells = (product, analyticData) => {
        return product.sources.reduce((total, currentSource) => {
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

      const predictShiftSells = productSellsOneMonthAgoOneMonthData * shiftRise;
      const predictPeriodAfterShiftSells =
        (productSellsOneMonthAgoOneMonthData + predictShiftSells) *
        predictPeriodRise;

      const predictShiftStocks = stock - predictShiftSells;

      const onShipment = predictPeriodAfterShiftSells - predictShiftStocks;

      if (onShipment > 0) {
        products.push({
          article: product.offer_id,
          name: product.dbInfo?.variation?.product.name,
          stock,
          shiftStocks: Math.round(predictShiftStocks),
          productSellsOneMonthAgoOneMonthData: Math.round(
            productSellsOneMonthAgoOneMonthData
          ),
          shiftRise: Math.round(shiftRise * 100),
          predictPeriodRise: Math.round(predictPeriodRise * 100),
          predictShiftSells: Math.round(predictShiftSells),
          predictPeriodAfterShiftSells: Math.round(
            predictPeriodAfterShiftSells
          ),
          onShipment: Math.round(onShipment),
        });
      }
    });

    return products;
  }

  static connectDbApiData(dbProducts, apiProductsData) {
    const { productsInfo: apiProducts, productsStocks: apiStocks } =
      apiProductsData;

    for (const productsStock of apiStocks) {
      const apiProduct = apiProducts[productsStock.product_id];
      if (!apiProduct) {
        continue;
      }

      const fbsStocks = productsStock.stocks.find(
        (stock) => stock.type === "fbs"
      );

      apiProduct.fbsStock = fbsStocks?.present - fbsStocks?.reserved;
      apiProduct.fbmStock = productsStock.stocks.find(
        (stock) => stock.type === "fbo"
      )?.present;
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
}
