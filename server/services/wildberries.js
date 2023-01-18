import axios from "axios";
import async from "async";
import { Marketplace } from "./marketplace.js";
import WbProduct from "../models/WbProduct.js";
import fns from "date-fns-tz";
import * as dbService from "./dbService.js";
import https from "https";

const { formatInTimeZone } = fns;

const wbAPI = axios.create({
  baseURL: "https://suppliers-api.wildberries.ru/",
  httpsAgent: new https.Agent({ keepAlive: true }),
  headers: {
    "Content-Type": "application/json",
    Authorization: process.env.WB_APIKEY,
  },
});

const wbStatAPI = axios.create({
  baseURL: "https://statistics-api.wildberries.ru/",
  httpsAgent: new https.Agent({ keepAlive: true }),
  headers: {
    "Content-Type": "application/json",
    Authorization: process.env.WB_APISTATKEY,
  },
});

export class Wildberries extends Marketplace {
  static marketProductSchema = WbProduct;

  // INSTANCE METHODS
  async #getApiStockFbs() {
    const product = await this._getDbProduct();

    const result = await Wildberries.#getApiProductsStocksFbs(product.barcode);
    return result?.[0].stock;
  }

  async #updateApiStock(stock) {
    const product = await this._getDbProduct();

    return Wildberries.#updateApiProductStock(product.barcode, stock);
  }

  addUpdateProduct(newData) {
    return super.addUpdateProduct(newData, (newStock) =>
      this.#updateApiStock(newStock)
    );
  }

  async _getApiProduct() {
    const dbProduct = await this._getDbProduct();

    return Wildberries._getApiProducts(dbProduct.sku);
  }

  // CLASS METHODS
  static async checkIdentifierExistsInApi(newProductData) {
    let isProductExistsOnMarketplace = true;

    if (newProductData.sku) {
      const allApiProducts = await this.#getApiProductsInfo();

      const apiProduct = allApiProducts[newProductData.sku];

      if (!apiProduct) {
        throw new Error(
          `Идентификатор товара (sku - ${newProductData.sku}) не существует в базе маркетплейса.`
        );
      }

      if (
        newProductData.article &&
        newProductData.article !== apiProduct["vendorCode"]
      ) {
        throw new Error(
          `Идентификатор товара (article - ${newProductData.article}) не соответствует sku товара.`
        );
      }

      if (
        newProductData.barcode &&
        newProductData.barcode !== apiProduct.sizes[0].skus[0]
      ) {
        throw new Error(
          `Идентификатор товара (barcode - ${newProductData.barcode}) не соответствует sku товара.`
        );
      }
    }

    if (!isProductExistsOnMarketplace) {
      throw new Error("Идентификатор товара не существует в базе маркетплейса");
    }
  }

  static getMarketProductDetails(marketProductData) {
    const marketProductDetails = super.getMarketProductDetails(
      marketProductData
    );

    if (marketProductData.barcode) {
      marketProductDetails.barcode = marketProductData.barcode;
    }

    return marketProductDetails;
  }

  static #processWbApiErrors(responseData) {
    if (responseData.error) {
      throw new Error(
        `${responseData.errorText}. ${
          responseData["additionalErrors"]
            ? ` Additional errors: ${responseData["additionalErrors"]}`
            : ""
        }`
      );
    }
  }

  static _connectDbApiData(dbProducts, apiProductsData) {
    const {
      productsInfo: apiProducts,
      productsStocks: { fbsStocks, fbmStocks, fbsReserves },
    } = apiProductsData;

    for (const fbmStock of fbmStocks) {
      const apiProduct = apiProducts[fbmStock["nmId"]];
      if (!apiProduct) {
        continue;
      }

      apiProduct.fbmStock = fbmStock.quantity;
    }

    // fbsReserves contains all new orders in each order by only one product
    for (const fbsReserve of fbsReserves) {
      const apiProduct = apiProducts[fbsReserve["nmId"]];
      if (!apiProduct) {
        continue;
      }

      if (!Number.isFinite(apiProduct.fbsReserve)) {
        apiProduct.fbsReserve = 1;
      } else {
        apiProduct.fbsReserve++;
      }
    }

    for (const dbProduct of dbProducts) {
      const apiProduct = apiProducts[dbProduct.sku];
      if (!apiProduct) {
        continue;
      }

      const fbsStock = fbsStocks.find(
        (fbsStock) => +fbsStock.sku === dbProduct.barcode
      );

      apiProduct.dbInfo = dbProduct;
      apiProduct.fbsStock = fbsStock?.amount;
    }

    return apiProducts;
  }

  static async #getApiProductsStocksFbs(barcodes, warehouse = 206312) {
    return wbAPI
      .post(`api/v3/stocks/${warehouse}`, { skus: barcodes })
      .then((response) => {
        return response.data.stocks;
      });
  }

  static #getApiProductsStocksFbm(skuFilter) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const getApiProductsFbmStocksRequest = () =>
      wbStatAPI
        .get(
          `api/v1/supplier/stocks?dateFrom=${formatInTimeZone(
            yesterday,
            "UTC",
            "yyyy-MM-dd"
          )}`
        )
        .then((response) => {
          let fbmStocks = response.data;

          if (skuFilter) {
            fbmStocks = fbmStocks.filter(
              (fbmStock) => fbmStock["nmId"] === skuFilter
            );
          }
          let allFbmStocks = 0;
          let formatFbmStocks = {};
          for (const fbmStock of fbmStocks) {
            if (!formatFbmStocks[fbmStock["nmId"]]) {
              allFbmStocks += fbmStock.quantity;
              formatFbmStocks[fbmStock["nmId"]] = {
                nmId: fbmStock["nmId"],
                quantity: fbmStock.quantity,
              };
            } else {
              formatFbmStocks[fbmStock["nmId"]].quantity += fbmStock.quantity;
            }
          }

          if (allFbmStocks === 0) {
            throw new Error("FBW stocks from API is empty.");
          }

          const resultFbmStocks = Object.values(formatFbmStocks);

          setTimeout(() => dbService.updateWbStocks(resultFbmStocks), 0);

          return resultFbmStocks;
        })
        .catch(async (error) => {
          if (error.response?.status === 429) {
            console.error("Ошибка получания остатков FBW");
          } else {
            console.error(error);
          }

          const dbProducts = await Wildberries._getDbProducts(
            skuFilter ? { sku: skuFilter } : {}
          );
          return dbProducts.map((dbProduct) => {
            return { nmId: dbProduct.sku, quantity: dbProduct.stock };
          });
        });

    const getApiProductsFbmStocksRequestCached = this._makeCachingForTime(
      getApiProductsFbmStocksRequest,
      [],
      "WB-GET-API-PRODUCTS-FBM-STOCKS",
      15 * 60 * 1000
    );

    return getApiProductsFbmStocksRequestCached();
  }

  //todo add pagination processing
  static #getApiProductsInfo(searchValue = null) {
    return wbAPI
      .post("content/v1/cards/cursor/list", {
        sort: {
          cursor: {
            // "updatedAt": "2022-09-23T17:41:32Z",
            // "nmID": 66965444,
            limit: 1000,
          },
          filter: {
            textSearch: searchValue?.toString() ?? "",
            withPhoto: -1,
          },
          // "sort": {
          //   "sortColumn": "updateAt",
          //   "ascending": false
          // }
        },
      })
      .then((response) => {
        this.#processWbApiErrors(response.data);

        const apiProducts = {};
        response.data.data.cards.forEach((apiProduct) => {
          apiProducts[apiProduct.nmID] = apiProduct;
        });

        return apiProducts;
      });
  }

  static async _getApiProducts(sku) {
    return async
      .parallel({
        productsInfo: (callback) => {
          this.#getApiProductsInfo(sku)
            .then((result) => callback(null, result))
            .catch((error) => callback(error, null));
        },
        fbmStocks: (callback) => {
          this.#getApiProductsStocksFbm(sku)
            .then((result) => callback(null, result))
            .catch((error) => callback(error, null));
        },
        fbsStocks: (callback) => {
          this._getDbProducts(sku ? { sku } : {})
            .then((dbProducts) => {
              const barcodes = dbProducts.map((dbProduct) =>
                dbProduct.barcode.toString()
              );

              this.#getApiProductsStocksFbs(barcodes).then((result) =>
                callback(null, result)
              );
            })
            .catch((error) => callback(error, null));
        },
        fbsReserves: (callback) => {
          this.getApiOrdersNew()
            .then((newOrders) => callback(null, newOrders))
            .catch((error) => callback(error, null));
        },
      })
      .then((results) => {
        return {
          productsInfo: results.productsInfo,
          productsStocks: {
            fbmStocks: results.fbmStocks,
            fbsStocks: results.fbsStocks,
            fbsReserves: results.fbsReserves,
          },
        };
      });
  }

  /**
   * @param {string} barcode
   * @param {number} stock
   */
  static #updateApiProductStock(barcode, stock) {
    return this.#updateApiProductsStock([
      { sku: barcode.toString(), amount: +stock },
    ]);
  }

  /**
   * @param {[{amount: number, sku: string}]} stocks
   * @param {number} warehouse
   * @description sku is a barcode (WildBerries API troubles)
   */
  static async #updateApiProductsStock(stocks, warehouse = 206312) {
    const newOrders = await this.getApiOrdersNew(false);
    for (const newOrder of newOrders) {
      const stock = stocks.find((stock) => stock.sku === newOrder.skus[0]);
      if (!stock) {
        continue;
      }

      if (stock.amount <= 0) {
        continue;
      }

      stock.amount--;
    }

    return wbAPI
      .put(`api/v3/stocks/${warehouse}`, { stocks })
      .then((response) => {
        this.#processWbApiErrors(response.data);

        return response.data;
      });
  }

  static getApiOrdersNew(useCache = true) {
    const getNewOrdersRequest = () =>
      wbAPI.get("api/v3/orders/new").then((response) => {
        return response.data.orders;
      });

    const cachedRequest = this._makeCachingForTime(
      getNewOrdersRequest,
      [],
      "WB-GET-API-NEW-ORDERS",
      5 * 60 * 1000,
      !useCache
    );

    return cachedRequest();
  }

  static getApiOrdersReshipment() {
    return wbAPI.get("api/v3/supplies/orders/reshipment").then((response) => {
      return response.data.orders;
    });
  }

  static getApiOrdersFromDate(fromDate = 0) {
    return wbStatAPI
      .get(
        `api/v1/supplier/orders?dateFrom=${formatInTimeZone(
          fromDate,
          "UTC",
          "yyyy-MM-dd"
        )}`
      )
      .then((response) => {
        return response.data;
      });
  }

  static #getApiSellsFromDate(fromDate = 0) {
    return wbStatAPI
      .get(
        `api/v1/supplier/sales?dateFrom=${formatInTimeZone(
          fromDate,
          "UTC",
          "yyyy-MM-dd"
        )}`
      )
      .then((response) => {
        return response.data;
      });
  }

  static async getApiShipmentPredict(mayakSellsPerYear) {
    return async
      .parallel({
        allSells: (callback) => {
          (async () => {
            try {
              const sellsFromDb = await dbService
                .getAllSells()
                .sort({ date: -1 });

              const lastSellInDbDate = sellsFromDb[0].date;

              const newSellsFromApi = await this.#getApiSellsFromDate(
                lastSellInDbDate
              );

              const updateDbSellsRequests = newSellsFromApi
                .filter(
                  (apiSell) =>
                    apiSell.IsStorno === 0 &&
                    (apiSell.saleID.startsWith("S") ||
                      apiSell.saleID.startsWith("D")) &&
                    new Date(apiSell.date) > lastSellInDbDate
                )
                .map((apiSell) => {
                  const newSell = {
                    marketProductRef: "WbProduct",
                    orderId: apiSell.saleID,
                    quantity: 1,
                    date: new Date(apiSell.date),
                    productIdentifier: apiSell["nmId"],
                  };

                  sellsFromDb.push(newSell);

                  return (callback) => {
                    dbService.addUpdateSell(newSell, callback);
                  };
                });

              setTimeout(() => async.parallel(updateDbSellsRequests), 0);

              callback(null, sellsFromDb);
            } catch (error) {
              console.error(error);
              callback(error, null);
            }
          })();
        },
        dbProducts: (callback) => {
          this._getDbProducts()
            .then((variations) => callback(null, variations))
            .catch((error) => callback(error, null));
        },
        apiProducts: (callback) => {
          this._getApiProducts()
            .then((variations) => callback(null, variations))
            .catch((error) => callback(error, null));
        },
      })
      .then((results) => {
        const { dbProducts, apiProducts, allSells } = results;

        allSells.sort((sell1, sell2) => sell1.date - sell2.date);

        const firstSellDate = allSells.at(0).date;
        const lastSellDate = allSells.at(-1).date;
        let monthBeforeLastSellDate = new Date(lastSellDate);
        monthBeforeLastSellDate = new Date(
          monthBeforeLastSellDate.setMonth(
            monthBeforeLastSellDate.getMonth() - 1
          )
        );
        const monthsBetweenFirstLastSell =
          (lastSellDate - firstSellDate) / (1000 * 60 * 60 * 24 * 30);

        const connectedProducts = Object.values(
          this._connectDbApiData(dbProducts, apiProducts)
        );

        // Connect products by variation
        const wbVariations = {};
        connectedProducts.forEach((product) => {
          const productVariation = product.dbInfo?.variation;

          if (!productVariation) {
            return;
          }

          const wbVariation = wbVariations[productVariation._id];

          const isActual = product.dbInfo.isActual;
          const barcode = isActual ? product.dbInfo.barcode : null;
          const sku = isActual ? product.dbInfo.sku : null;

          const dbSells = allSells.filter(
            (sell) =>
              sell.marketProduct?._id.toString() ===
                product.dbInfo._id.toString() ||
              sell.productIdentifier === product.nmID
          );
          const dbMonthSells = dbSells.filter(
            (sell) => sell.date >= monthBeforeLastSellDate
          );

          const mayakSells = mayakSellsPerYear.find(
            (mayakProduct) => mayakProduct.sku === product.nmID
          )?.sells;

          // length in dbSells used over quantity cause WB order always have only one position within
          if (!wbVariation) {
            wbVariations[productVariation._id] = {
              productName: productVariation.product.name,
              dbSells: dbSells.length,
              dbMonthSells: dbMonthSells.length,
              mayakSells: mayakSells ?? 0,
              stock: product.fbmStock ?? 0,
              barcode,
              sku,
              isActual,
            };
            return;
          }

          wbVariation.dbSells += dbSells.length;
          wbVariation.dbMonthSells += dbMonthSells.length;
          wbVariation.mayakSells += dbSells.mayakSells;
          wbVariation.stock += product.fbmStock;
          if (barcode) {
            wbVariation.barcode = barcode;
          }
          if (sku) {
            wbVariation.sku = sku;
          }
          if (isActual) {
            wbVariation.isActual = isActual;
          }
        });

        const productsOnShipment = [];

        Object.values(wbVariations).forEach((variation) => {
          const onShipment = Math.round(
            Math.max(
              variation.dbSells / monthsBetweenFirstLastSell,
              variation.dbMonthSells
            ) - variation.stock
          );

          const onShipmentMayak = Math.round(
            variation.mayakSells / 12 - variation.stock
          );

          if ((onShipment > 0 || onShipmentMayak > 0) && variation.isActual) {
            productsOnShipment.push({
              barcode: variation.barcode,
              sku: variation.sku,
              name: variation.productName,
              stock: variation.stock,
              sellPerMonth: variation.dbMonthSells,
              [`sells (cр за ${monthsBetweenFirstLastSell.toFixed(1)} мес)`]: (
                variation.dbSells / monthsBetweenFirstLastSell
              ).toFixed(1),
              sellMayakAvgPerYear: (variation.mayakSells / 12).toFixed(1),
              onShipment,
              onShipmentMayak,
            });
          }
        });

        return productsOnShipment;
      });
  }
}
