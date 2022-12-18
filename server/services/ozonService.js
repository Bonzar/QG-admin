import axios from "axios";
import async from "async";
import { format as formatDate, sub as subFromDate, addDays } from "date-fns";
import * as dbService from "./dbService.js";
import OzonProduct from "../models/OzonProduct.js";
import { Marketplace, MarketplaceProductInstanceMixin } from "./marketplace.js";

const ozonAPI = axios.create({
  baseURL: "https://api-seller.ozon.ru/",
  headers: {
    "Content-Type": "application/json",
    "Client-Id": process.env.OZON_CLIENTID,
    "Api-Key": process.env.OZON_APIKEY,
  },
});

export class Ozon extends Marketplace {
  constructor() {
    super(OzonProduct);
  }

  // API methods
  getApiProductStocks(filter = { visibility: "ALL" }) {
    return ozonAPI
      .post("v3/product/info/stocks", {
        filter,
        last_id: "",
        limit: 1000,
      })
      .then((response) => response.data.result.items);
  }

  getApiProductsInfo = (productIds) => {
    return ozonAPI
      .post("v2/product/info/list", {
        product_id: productIds,
      })
      .then((response) => response.data);
  };

  /**
   * @param {{visibility: string}} filter
   */
  getApiProducts = async (filter) => {
    const productsStockList = await this.getApiProductStocks(filter);

    const productsIds = productsStockList.map((product) => product.product_id);

    const productsInfo = (await this.getApiProductsInfo(productsIds)).result
      .items;

    dbService.updateOzonStocks({ productsInfo, productsStockList });

    return { productsInfo, productsStockList };
  };

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
    return Ozon.updateApiStocks([
      {
        offer_id: article,
        stock: +newStock,
      },
    ]);
  }

  getTodayOrders() {
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

  async getOverdueOrders() {
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

  async getApiShipmentPredict(dateShiftDays = 13, predictPeriodDays = 30) {
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
      // List of all products from DB
      allDbVariations: (callback) => {
        dbService
          .getAllVariations({}, ["product ozonProduct"])
          .then((variations) => callback(null, variations))
          .catch((error) => callback(error));
      },
    });

    const {
      oneMonthAgoOneMonthData,
      oneYearOneMonthAgoOneMonthData,
      oneYearAgoShiftDaysData,
      oneYearWithShiftAgoPredictPeriodData,
      productsFullInfo: { productsInfo, productsStockList },
      ozonDbProducts,
      allDbVariations,
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

    productsInfo.forEach((apiProduct) => {
      const { dbVariation: variation, dbProduct: ozonDbProduct } =
        Ozon.getDbProductAndVariationForApiProduct(
          apiProduct,
          allDbVariations,
          ozonDbProducts
        );

      // Skip not actual products
      if (!ozonDbProduct.isActual) {
        return;
      }

      const stock =
        productsStockList
          .find((stockInfo) => stockInfo.product_id === apiProduct.id)
          .stocks.find((stock) => stock.type === "fbo")?.present ?? 0;

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
        apiProduct,
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
          article: apiProduct.offer_id,
          name: variation.product.name,
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

  // Other methods

  static getDbProductAndVariationForApiProduct(
    apiProduct,
    allDbVariations,
    ozonDbProducts
  ) {
    let dbProduct;
    // Search variation for market product from api
    const dbVariation = allDbVariations.find(
      (variation) =>
        // Search market product in db for market product from api
        variation.ozonProduct?.filter((variationOzonDbProduct) => {
          const isMarketProductMatch =
            variationOzonDbProduct.sku === apiProduct.id ||
            variationOzonDbProduct.article === apiProduct.offer_id;

          // find -> save market product
          if (isMarketProductMatch) {
            dbProduct = variationOzonDbProduct;
          }

          return isMarketProductMatch;
        }).length > 0
    );

    if (!dbProduct) {
      // Search fetched product from ozon in DB
      dbProduct = ozonDbProducts.find(
        (ozonDbProduct) => ozonDbProduct.sku === apiProduct.id
      );
    }

    return { dbVariation, dbProduct };
  }

  static getConnectOzonDataRequests(
    filters,
    ozonApiProducts,
    ozonApiStocks,
    ozonDbProducts,
    allDbVariations,
    connectOzonDataResultFormatter
  ) {
    return ozonApiProducts.map((apiProduct) => {
      return async () => {
        const { dbVariation, dbProduct } =
          Ozon.getDbProductAndVariationForApiProduct(
            apiProduct,
            allDbVariations,
            ozonDbProducts
          );

        const productStocks = ozonApiStocks.find(
          (stockInfo) => stockInfo.product_id === apiProduct.id
        );

        const stockFBO =
          productStocks.stocks.find((stock) => stock.type === "fbo")?.present ??
          0;
        const stockFBS =
          productStocks.stocks.find((stock) => stock.type === "fbs")?.present ??
          0;

        // Filtration
        let isPassFilterArray = [];
        // by stock status
        switch (filters.stock_status) {
          // Filter only outofstock products (by FBM and FBS)
          case "outofstock":
            isPassFilterArray.push(stockFBS <= 0 && stockFBO <= 0);
            break;
          // Filter only outofstock products (by FBS)
          case "outofstockFBS":
            isPassFilterArray.push(stockFBS <= 0);
            break;
          // Filter only outofstock products (by FBM)
          case "outofstockFBM":
            isPassFilterArray.push(stockFBO <= 0);
            break;
          // Filter only instock on FBS products
          case "instockFBS":
            isPassFilterArray.push(stockFBS > 0);
            break;
          // Filter only instock on FBM products
          case "instockFBM":
            isPassFilterArray.push(stockFBO > 0);
            break;
          // Filter only instock on FBM or FBS products (some of them)
          case "instockSome":
            isPassFilterArray.push(stockFBS > 0 || stockFBO > 0);
            break;
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

        if (isPassFilterArray.every((pass) => pass)) {
          return connectOzonDataResultFormatter(
            dbVariation,
            dbProduct,
            apiProduct,
            stockFBO,
            stockFBS
          );
        }
      };
    });
  }

  async getProducts(filters, connectOzonDataResultFormatter, allDbVariations) {
    const data = await async.parallel({
      ozonApiProducts: (callback) => {
        this.getApiProducts()
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
      ozonDbProducts: (callback) => {
        this.getDbProducts()
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
      dbVariations: (callback) => {
        if (!allDbVariations) {
          dbService
            .getAllVariations({}, ["product ozonProduct"])
            .then((result) => callback(null, result))
            .catch((error) => callback(error, null));
          return;
        }

        callback(null, allDbVariations);
      },
    });

    const {
      ozonApiProducts: {
        productsInfo: ozonApiProductsInfo,
        productsStockList: ozonApiStocks,
      },
      ozonDbProducts,
      dbVariations,
    } = data;

    return async.parallel(
      Ozon.getConnectOzonDataRequests(
        filters,
        ozonApiProductsInfo,
        ozonApiStocks,
        ozonDbProducts,
        dbVariations,
        connectOzonDataResultFormatter
      )
    );
  }
}

export class OzonProductInstance extends Ozon {
  #dbData;

  constructor(dbId) {
    super();
    this.dbId = dbId;
    this.setProductInfoFromDb(dbId);
  }

  getDbData() {
    if (this.#dbData) {
      return this.#dbData;
    }

    return this.setProductInfoFromDb(this.dbId);
  }

  setProductInfoFromDb(dbId) {
    this.#dbData = this.getDbProductById(dbId);
    return this.#dbData;
  }

  // API methods

  async updateApiStock(newStock) {
    const product = await this.getDbData();

    return Ozon.updateApiStock(product.article, newStock);
  }

  async checkIdentifierExistsInApi(newProductData) {
    const allApiProducts = await this.getApiProductStocks();

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

  async getApiStock() {
    const product = await this.getDbData();

    const stocks = await this.getApiProductStocks({
      product_id: [product.sku],
      visibility: "ALL",
    });

    return stocks[0].stocks;
  }

  addUpdateDbInfo() {
    // rewrite from MarketplaceProductInstanceMixin
  }

  addUpdateDbProduct() {
    // rewrite from MarketplaceProductInstanceMixin
  }
}

Object.assign(OzonProductInstance.prototype, MarketplaceProductInstanceMixin);
