import axios from "axios";
import async from "async";
import { Marketplace, MarketplaceProductInstanceMixin } from "./marketplace.js";
import WbProduct from "../models/WbProduct.js";
import fns from "date-fns-tz";
import * as dbService from "./dbService.js";
import { Schema } from "mongoose";
const { formatInTimeZone } = fns;

const wbAPI = axios.create({
  baseURL: "https://suppliers-api.wildberries.ru/",
  headers: {
    "Content-Type": "application/json",
    Authorization: process.env.WB_APIKEY,
  },
});

const wbStatAPI = axios.create({
  baseURL: "https://statistics-api.wildberries.ru/",
  headers: {
    "Content-Type": "application/json",
    Authorization: process.env.WB_APISTATKEY,
  },
});

export class Wildberries extends Marketplace {
  #processWbApiErrors(responseData) {
    if (responseData.error) {
      throw new Error(
        `${responseData.errorText}. ${
          responseData.additionalErrors
            ? ` Additional errors: ${responseData.additionalErrors}`
            : ""
        }`
      );
    }
  }

  constructor() {
    super(WbProduct);
  }

  getApiProductsFbsStocks(search) {
    return wbAPI
      .get(`api/v2/stocks?${search ? `search=${search}&` : ""}skip=0&take=1000`)
      .then((response) => {
        return response.data.stocks;
      });
  }

  getApiProductsFbwStocks() {
    return wbStatAPI
      .get(
        `api/v1/supplier/stocks?dateFrom=${formatInTimeZone(
          new Date().setDate(20),
          "UTC",
          "yyyy-MM-dd"
        )}`
      )
      .then((response) => {
        const connectedDataBySku = {};
        response.data.forEach((fbwStock) => {
          if (!connectedDataBySku[fbwStock.nmId]) {
            connectedDataBySku[fbwStock.nmId] = fbwStock.quantity;
          } else {
            connectedDataBySku[fbwStock.nmId] += fbwStock.quantity;
          }
        });

        dbService.updateWbStocks(connectedDataBySku);

        return connectedDataBySku;
      });
  }

  getApiProductsStocks() {
    return async.parallel({
      fbsStocks: (callback) => {
        this.getApiProductsFbsStocks()
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
      fbwStocks: (callback) => {
        this.getApiProductsFbwStocks()
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
    });
  }

  //todo add pagination processing
  getApiProductsInfo(searchValue = null) {
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

        return response.data.data.cards;
      });
  }

  getApiProducts() {
    return async.parallel({
      productsStocks: (callback) => {
        this.getApiProductsStocks()
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
      productsInfo: (callback) => {
        this.getApiProductsInfo("")
          .then((products) => callback(null, products))
          .catch((error) => callback(error, null));
      },
    });
  }

  updateApiStock(barcode, stock) {
    return wbAPI
      .post("api/v2/stocks", [{ barcode, stock: +stock, warehouseId: 206312 }])
      .then((response) => {
        this.#processWbApiErrors(response.data);

        return response.data;
      });
  }

  getApiNewOrders() {
    return wbAPI.get("api/v3/orders/new").then((response) => {
      return response.data.orders;
    });
  }

  getApiReshipmentOrders() {
    return wbAPI.get("api/v3/supplies/orders/reshipment").then((response) => {
      return response.data.orders;
    });
  }

  getApiOrdersFromDate(fromDate = 0) {
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

  getApiSellsFromDate(fromDate = 0) {
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

  async getProducts(filters, connectWbDataResultFormatter, allDbVariations) {
    const data = await async.parallel({
      wbApiProducts: (callback) => {
        this.getApiProducts()
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
      wbDbProducts: (callback) => {
        this.getDbProducts()
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      },
      dbVariations: (callback) => {
        if (!allDbVariations) {
          dbService
            .getAllVariations({}, ["product wbProduct"])
            .then((result) => callback(null, result))
            .catch((error) => callback(error, null));
          return;
        }

        callback(null, allDbVariations);
      },
    });

    const {
      wbApiProducts: {
        productsInfo,
        productsStocks: { fbsStocks, fbwStocks },
      },
      wbDbProducts,
      dbVariations,
    } = data;

    return async.parallel(
      this.#getConnectWbDataRequests(
        filters,
        productsInfo,
        fbsStocks,
        fbwStocks,
        wbDbProducts,
        dbVariations,
        connectWbDataResultFormatter
      )
    );
  }

  async getApiShipmentPredict(mayakSellsPerYear) {
    return async
      .parallel({
        allSells: (callback) => {
          (async () => {
            try {
              const sellsFromDb = await dbService
                .getAllSells()
                .sort({ date: -1 });

              const lastSellInDbDate = sellsFromDb[0].date;

              const newSellsFromApi = await wb.getApiSellsFromDate(
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
        allDbVariations(callback) {
          dbService
            .getAllVariations({}, ["product wbProduct"])
            .then((variations) => callback(null, variations))
            .catch((error) => callback(error, null));
        },
      })
      .then((results) => {
        const { allDbVariations, allSells } = results;

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

        const allWbProducts = [];

        allDbVariations.forEach((variation) => {
          if (variation.wbProduct && variation.wbProduct.length !== 0) {
            let variationSells = 0;
            let variationMonthSells = 0;
            let variationMayakYearSells = 0;
            for (const wbProduct of variation.wbProduct) {
              const wbProductMayakSells = mayakSellsPerYear.find(
                (mayakProduct) => mayakProduct.sku === wbProduct.sku
              )?.sells;

              const wbProductSells = allSells.filter(
                (sell) =>
                  sell.marketProduct?._id.toString() ===
                    wbProduct._id.toString() ||
                  sell.productIdentifier === wbProduct.sku
              );
              const wbProductMonthSells = wbProductSells.filter(
                (sell) => sell.date >= monthBeforeLastSellDate
              );

              // length used over quantity cause WB order always have only one position within
              variationSells += wbProductSells.length;
              variationMonthSells += wbProductMonthSells.length;
              variationMayakYearSells += wbProductMayakSells ?? 0;
            }

            variation.wbSells = variationSells;
            variation.wbMonthSells = variationMonthSells;
            variation.mayakYearSells = variationMayakYearSells;

            allWbProducts.push(variation);
          }
        });

        const productsOnShipment = [];

        allWbProducts.forEach((variation) => {
          // const name = `${variation.product.name} - ${variation.volume}`;

          const stock = variation.wbProduct.reduce(
            (totalStock, currentProduct) => totalStock + currentProduct.stock,
            0
          );

          const onShipment = Math.round(
            Math.max(
              variation.wbSells / monthsBetweenFirstLastSell,
              variation.wbMonthSells
            ) - stock
          );

          // const onShipmentMayak = Math.round(
          //   Math.max(variation.wbMonthSells, variation.mayakYearSells / 12) -
          //     stock
          // );

          const onShipmentMayak = Math.round(
            variation.mayakYearSells / 12 - stock
          );

          if (
            (onShipment > 0 || onShipmentMayak > 0) &&
            variation.wbProduct.find((wbProduct) => wbProduct.isActual === true)
          ) {
            productsOnShipment.push({
              barcode: variation.wbProduct.find(
                (wbProduct) => wbProduct.isActual === true
              )?.barcode,
              sku: variation.wbProduct.find(
                (wbProduct) => wbProduct.isActual === true
              )?.sku,
              name: variation.product.name,
              stock,
              sellPerMonth: variation.wbMonthSells,
              [`sells (cр за ${monthsBetweenFirstLastSell.toFixed(1)} мес)`]: (
                variation.wbSells / monthsBetweenFirstLastSell
              ).toFixed(1),
              sellMayakAvgPerYear: (
                (variation.mayakYearSells / 12) *
                2
              ).toFixed(1),
              onShipment,
              onShipmentMayak,
            });
          }
        });

        return productsOnShipment;
      });
  }

  static getDbProductAndVariationForApiProduct(
    apiProduct,
    allDbVariations,
    wbDbProducts
  ) {
    let dbProduct;
    // Search variation for market product from api
    const dbVariation = allDbVariations.find(
      (variation) =>
        // Search market product in db for market product from api
        variation.wbProduct?.filter((variationWbDbProduct) => {
          const isMarketProductMatch =
            variationWbDbProduct.sku === apiProduct["nmID"];
          // || variationWbDbProduct.article === apiProduct.offer_id;

          // find -> save market product
          if (isMarketProductMatch) {
            dbProduct = variationWbDbProduct;
          }

          return isMarketProductMatch;
        }).length > 0
    );

    if (!dbProduct) {
      // Search fetched product from wb in DB
      dbProduct = wbDbProducts.find(
        (wbDbProduct) => wbDbProduct.sku === apiProduct["nmID"]
      );
    }

    return { dbVariation, dbProduct };
  }

  #getConnectWbDataRequests = (
    filters,
    wbApiProducts,
    wbApiFbsStocks,
    wbApiFbwStocks,
    wbDbProducts,
    allDbVariations,
    connectWbDataResultFormatter
  ) => {
    return wbApiProducts.map((apiProduct) => {
      return async function () {
        const { dbVariation, dbProduct } =
          Wildberries.getDbProductAndVariationForApiProduct(
            apiProduct,
            allDbVariations,
            wbDbProducts
          );

        const stockFBS =
          wbApiFbsStocks.find(
            (fbsStock) => fbsStock["nmId"] === apiProduct["nmID"]
          )?.stock ?? 0;
        let stockFBW;
        if (wbApiFbwStocks) {
          stockFBW = wbApiFbwStocks[apiProduct["nmID"]];
        } else {
          stockFBW = dbProduct?.stock;
        }

        // Filtration
        let isPassFilterArray = [];
        // by stock status
        switch (filters.stock_status) {
          // Filter only outofstock products (by FBM and FBS)
          case "outofstock":
            isPassFilterArray.push(stockFBS <= 0 && stockFBW <= 0);
            break;
          // Filter only outofstock products (by FBS)
          case "outofstockFBS":
            isPassFilterArray.push(stockFBS <= 0);
            break;
          // Filter only outofstock products (by FBM)
          case "outofstockFBM":
            isPassFilterArray.push(stockFBW <= 0);
            break;
          // Filter only instock on FBS products
          case "instockFBS":
            isPassFilterArray.push(stockFBS > 0);
            break;
          // Filter only instock on FBW products
          case "instockFBM":
            isPassFilterArray.push(stockFBW > 0);
            break;
          // Filter only instock on FBW or FBS products (some of them)
          case "instockSome":
            isPassFilterArray.push(stockFBS > 0 || stockFBW > 0);
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
          // Only actual or not specified by default
          default:
            isPassFilterArray.push(dbProduct?.isActual !== false);
        }

        if (isPassFilterArray.every((pass) => pass)) {
          return connectWbDataResultFormatter(
            dbVariation,
            dbProduct,
            apiProduct,
            stockFBW,
            stockFBS
          );
        }
      };
    });
  };
}
//
//
//
//
//
//
//
//
//
const wb = new Wildberries();

// wb.getApiProductsFbwStocks()
//   .then((result) => console.log(result))
//   .catch((error) => console.error(error));

//
// console.log(formatInTimeZone(0, "UTC", "yyyy-MM-dd"));
//
//
//
//
//
//
//
//
export class WildberriesProductInstance extends Wildberries {
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

  updateApiStock;
  checkIdentifierExistsInApi;
  getApiStock;

  addUpdateDbInfo() {
    // rewrite from MarketplaceProductInstanceMixin
  }

  addUpdateDbProduct() {
    // rewrite from MarketplaceProductInstanceMixin
  }
}

Object.assign(
  WildberriesProductInstance.prototype,
  MarketplaceProductInstanceMixin
);

export const getApiProductsInfoList = (searchValue = null) => {
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
      return response.data;
    });
};

export const getApiProductFbsStocks = (search) =>
  wbAPI
    .get(`api/v2/stocks?${search ? `search=${search}&` : ""}skip=0&take=1000`)
    .then((response) => {
      return response.data;
    });

export const getApiProductFbwStocks = () => {
  return wbStatAPI
    .get(
      `api/v1/supplier/stocks?dateFrom=${formatInTimeZone(
        Date.now(),
        "UTC",
        "yyyy-MM-dd"
      )}`
    )
    .then((response) => {
      return response.data;
    });
};

export const updateApiStock = (barcode, stock) =>
  wbAPI
    .post("api/v2/stocks", [
      { barcode: barcode.toString(), stock: +stock, warehouseId: 206312 },
    ])
    .then((response) => {
      return response.data;
    });

export const getApiTodayOrders = async () => {
  const date = new Date();

  const dateEnd = date.toISOString();

  date.setDate(date.getDate() - 7);
  date.setHours(0, 0, 0, 0);
  const dateStart = date.toISOString();

  const orders = await wbAPI.get(
    `api/v2/orders?date_start=${dateStart}&date_end=${dateEnd}&skip=0&take=1000`
  );

  // today orders
  return orders.data.orders.filter(
    (order) =>
      order.status <= 1 && (order.userStatus === 0 || order.userStatus === 4)
  );
};

export const getApiOrdersStat = () =>
  wbStatAPI
    .get(`api/v1/supplier/orders&dateFrom=1970-01-01`)
    .then((response) => {
      return response.data;
    });

export const getApiSellsStat = () =>
  wbStatAPI
    .get(`api/v1/supplier/sales&dateFrom=1970-01-01`)
    .then((response) => {
      return response.data;
    });

export const getWbShipment = (mayakSellsPerYear) =>
  async
    .parallel({
      // Get all sells (all old from db and new from api with db update)
      allSells(callback) {
        async.waterfall(
          [
            (callback) => {
              async.parallel(
                {
                  apiSellsStat(callback) {
                    getApiSellsStat()
                      .then((result) => callback(null, result))
                      .catch((error) => callback(error, null));
                  },
                  dbSellsStat(callback) {
                    dbService
                      .getAllSells(
                        { marketProductRef: "WbProduct" },
                        "marketProduct"
                      )
                      .then((sells) => callback(null, sells))
                      .catch((error) => callback(error, null));
                  },
                },
                callback
              );
            },
            (results, callback) => {
              const { apiSellsStat, dbSellsStat } = results;

              const sellsExistCheckRequests = apiSellsStat
                .filter(
                  (apiSell) =>
                    apiSell.IsStorno === 0 &&
                    (apiSell.saleID.startsWith("S") ||
                      apiSell.saleID.startsWith("D"))
                )
                .map((apiSell) => {
                  return (callback) => {
                    const dbSell = dbSellsStat.find(
                      (dbSell) => dbSell.orderId === apiSell.saleID
                    );

                    if (!dbSell) {
                      dbService.addUpdateSell(
                        null,
                        "WbProduct",
                        apiSell["nmId"],
                        apiSell.saleID,
                        1,
                        apiSell.date,
                        callback
                      );
                    } else {
                      callback(null, dbSell);
                    }
                  };
                });

              async.parallel(sellsExistCheckRequests, callback);
            },
          ],
          callback
        );
      },
      allVariations(callback) {
        dbService
          .getAllVariations({}, ["product wbProduct"])
          .then((variations) => callback(null, variations))
          .catch((error) => callback(error, null));
      },
      // updateWbStocks(callback) {
      //   dbService
      //     .updateWbStocks()
      //     .then(() => callback(null, true))
      //     .catch(() => callback(null, null));
      // },
    })
    .then((results) => {
      const { allVariations, allSells } = results;

      allSells.sort((sell1, sell2) => sell1.date - sell2.date);

      const firstSellDate = allSells.at(0).date;
      const lastSellDate = allSells.at(-1).date;
      let monthBeforeLastSellDate = new Date(lastSellDate);
      monthBeforeLastSellDate = new Date(
        monthBeforeLastSellDate.setMonth(monthBeforeLastSellDate.getMonth() - 1)
      );
      const monthsBetweenFirstLastSell =
        (lastSellDate - firstSellDate) / (1000 * 60 * 60 * 24 * 30);

      const allWbProducts = [];

      allVariations.forEach((variation) => {
        if (variation.wbProduct && variation.wbProduct.length !== 0) {
          let variationSells = 0;
          let variationMonthSells = 0;
          let variationMayakYearSells = 0;
          for (const wbProduct of variation.wbProduct) {
            const wbProductMayakSells = mayakSellsPerYear.find(
              (mayakProduct) => mayakProduct.sku === wbProduct.sku
            )?.sells;

            const wbProductSells = allSells.filter(
              (sell) =>
                sell.marketProduct._id.toString() === wbProduct._id.toString()
            );
            const wbProductMonthSells = wbProductSells.filter(
              (sell) => sell.date >= monthBeforeLastSellDate
            );

            // length used over quantity cause WB order always have only one position within
            variationSells += wbProductSells.length;
            variationMonthSells += wbProductMonthSells.length;
            variationMayakYearSells += wbProductMayakSells ?? 0;
          }

          variation.wbSells = variationSells;
          variation.wbMonthSells = variationMonthSells * 2;
          variation.mayakYearSells = variationMayakYearSells;

          allWbProducts.push(variation);
        }
      });

      const productsOnShipment = [];

      allWbProducts.forEach((variation) => {
        // const name = `${variation.product.name} - ${variation.volume}`;

        const stock = variation.wbProduct.reduce(
          (totalStock, currentProduct) => totalStock + currentProduct.stock,
          0
        );

        const onShipment = Math.round(
          Math.max(
            variation.wbSells / monthsBetweenFirstLastSell,
            variation.wbMonthSells
          ) - stock
        );

        // const onShipmentMayak = Math.round(
        //   Math.max(variation.wbMonthSells, variation.mayakYearSells / 12) -
        //     stock
        // );

        const onShipmentMayak = Math.round(
          (variation.mayakYearSells / 12) * 2 - stock
        );

        if (
          (onShipment > 0 || onShipmentMayak > 0) &&
          variation.wbProduct.find((wbProduct) => wbProduct.isActual === true)
        ) {
          productsOnShipment.push({
            barcode: variation.wbProduct.find(
              (wbProduct) => wbProduct.isActual === true
            )?.barcode,
            sku: variation.wbProduct.find(
              (wbProduct) => wbProduct.isActual === true
            )?.sku,
            name: variation.product.name,
            stock,
            sellPerMonth: variation.wbMonthSells,
            [`sells (cр за ${monthsBetweenFirstLastSell.toFixed(1)} мес)`]: (
              variation.wbSells / monthsBetweenFirstLastSell
            ).toFixed(1),
            sellMayakAvgPerYear: ((variation.mayakYearSells / 12) * 2).toFixed(
              1
            ),
            onShipment,
            onShipmentMayak,
          });
        }
      });

      return productsOnShipment;
    });

export const getConnectWbDataRequests = (
  filters,
  wbApiProducts,
  wbApiFbsStocks,
  wbApiFbwStocks,
  wbDbProducts,
  allDbVariations,
  connectWbDataResultFormatter
) =>
  wbApiProducts.data["cards"].map((wbApiProduct) => {
    return async function () {
      let wbDbProduct;
      // Search variation for market product from api
      const variation = allDbVariations.find(
        (variation) =>
          // Search market product in db for market product from api
          variation.wbProduct?.filter((variationWbDbProduct) => {
            const isMarketProductMatch =
              variationWbDbProduct.sku === wbApiProduct["nmID"];

            // find -> save market product
            if (isMarketProductMatch) {
              wbDbProduct = variationWbDbProduct;
            }

            return isMarketProductMatch;
          }).length > 0
      );

      if (!wbDbProduct) {
        // Search fetched product from wb in DB
        wbDbProduct = wbDbProducts.find(
          (wbDbProduct) => wbDbProduct.sku === wbApiProduct["nmID"]
        );
      }

      const stockFBS =
        wbApiFbsStocks["stocks"].find(
          (fbsStock) => fbsStock["nmId"] === wbApiProduct["nmID"]
        )?.stock ?? 0;

      let stockFBW;
      if (wbApiFbwStocks) {
        stockFBW =
          wbApiFbwStocks
            .filter((fbwStock) => fbwStock["nmId"] === wbApiProduct["nmID"])
            .reduce((total, current) => total + current.quantity, 0) ?? 0;
      } else {
        stockFBW = wbDbProduct?.stock;
      }

      // Filtration
      let isPassFilterArray = [];
      // by stock status
      switch (filters.stock_status) {
        // Filter only outofstock products (by FBM and FBS)
        case "outofstock":
          isPassFilterArray.push(stockFBS <= 0 && stockFBW <= 0);
          break;
        // Filter only outofstock products (by FBS)
        case "outofstockFBS":
          isPassFilterArray.push(stockFBS <= 0);
          break;
        // Filter only outofstock products (by FBM)
        case "outofstockFBM":
          isPassFilterArray.push(stockFBW <= 0);
          break;
        // Filter only instock on FBS products
        case "instockFBS":
          isPassFilterArray.push(stockFBS > 0);
          break;
        // Filter only instock on FBW products
        case "instockFBM":
          isPassFilterArray.push(stockFBW > 0);
          break;
        // Filter only instock on FBW or FBS products (some of them)
        case "instockSome":
          isPassFilterArray.push(stockFBS > 0 || stockFBW > 0);
          break;
      }

      // by actual (manual setup in DB)
      switch (filters.isActual) {
        case "notActual":
          isPassFilterArray.push(wbDbProduct?.isActual === false);
          break;
        case "all":
          isPassFilterArray.push(true);
          break;
        // Only actual or not specified by default
        default:
          isPassFilterArray.push(wbDbProduct?.isActual !== false);
      }

      if (isPassFilterArray.every((pass) => pass)) {
        return connectWbDataResultFormatter(
          variation,
          wbDbProduct,
          wbApiProduct,
          stockFBW,
          stockFBS
        );
      }
    };
  });
