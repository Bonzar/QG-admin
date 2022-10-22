const axios = require("axios");
const async = require("async");
const dbService = require("./dbService");

const getHeadersRequire = () => {
  return {
    "Content-Type": "application/json",
    Authorization: process.env.WB_APIKEY,
  };
};

exports.getApiProductsInfoList = async (searchValue = null, callback) => {
  try {
    const config = {
      method: "post",
      url: `https://suppliers-api.wildberries.ru/content/v1/cards/cursor/list`,
      headers: {
        ...getHeadersRequire(),
      },
      data: {
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
      },
    };

    const result = await axios(config).then((response) => {
      return response.data;
    });

    if (callback) {
      return callback(null, result);
    }
    return result;
  } catch (e) {
    console.log(e);
    if (callback) {
      callback(e, null);
      return;
    }
    return e;
  }
};

exports.getApiProductFbsStocks = async (search, callback) => {
  try {
    const searchParam = search ? `search=${search}&` : "";

    const config = {
      method: "get",
      url: `https://suppliers-api.wildberries.ru/api/v2/stocks?${searchParam}skip=0&take=1000`,
      headers: {
        ...getHeadersRequire(),
      },
    };

    const result = await axios(config).then((response) => {
      return response.data;
    });

    if (callback) {
      return callback(null, result);
    }
    return result;
  } catch (e) {
    console.log(e);
    if (callback) {
      callback(e, null);
    }
  }
};

exports.getApiProductFbwStocks = async (cb) => {
  try {
    const config = {
      method: "get",
      url: `https://suppliers-stats.wildberries.ru/api/v1/supplier/stocks?key=${process.env.WB_APISTATKEY}&dateFrom=2022-10-09`,
    };

    const fbwStocks = await axios(config).then((response) => {
      return response.data;
    });

    if (!cb) {
      return fbwStocks;
    }
    cb(null, fbwStocks);
  } catch (e) {
    console.log(e);
    if (cb) {
      cb(null, null);
      return;
    }
    return null;
  }
};

exports.updateApiStock = async (barcode, stock, callback) => {
  try {
    const config = {
      method: "post",
      url: "https://suppliers-api.wildberries.ru/api/v2/stocks",
      headers: {
        ...getHeadersRequire(),
      },
      data: [
        {
          barcode: barcode.toString(),
          stock: +stock,
          warehouseId: 206312,
        },
      ],
    };

    const result = await axios(config).then((response) => {
      return response.data;
    });

    if (!callback) {
      return result;
    }
    callback(null, result);
  } catch (e) {
    console.log(e);
    if (!callback) {
      throw e;
    }
    callback(e, null);
  }
};

exports.getApiTodayOrders = async (callback) => {
  try {
    const date = new Date();

    const dateEnd = date.toISOString();

    date.setDate(date.getDate() - 7);
    date.setHours(0, 0, 0, 0);
    const dateStart = date.toISOString();

    const config = {
      method: "get",
      url: `https://suppliers-api.wildberries.ru/api/v2/orders?date_start=${dateStart}&date_end=${dateEnd}&skip=0&take=1000`,
      headers: {
        ...getHeadersRequire(),
      },
    };

    const orders = await axios(config).then((response) => {
      return response.data.orders;
    });

    const todayOrders = orders.filter(
      (order) =>
        order.status <= 1 && (order.userStatus === 0 || order.userStatus === 4)
    );

    if (callback) {
      return callback(null, todayOrders);
    }
    return todayOrders;
  } catch (e) {
    console.log(e);
    if (callback) {
      callback(e, null);
    }
  }
};

exports.getApiOrdersStat = async (cb) => {
  try {
    const config = {
      method: "get",
      url: `https://suppliers-stats.wildberries.ru/api/v1/supplier/orders?key=${process.env.WB_APISTATKEY}&dateFrom=2002-10-09`,
    };

    const fbwOrdersStat = await axios(config).then((response) => {
      return response.data;
    });

    if (!cb) {
      return fbwOrdersStat;
    }
    cb(null, fbwOrdersStat);
  } catch (e) {
    console.log(e);
    if (cb) {
      cb(null, null);
      return;
    }
    return null;
  }
};

exports.getApiSellsStat = async (cb) => {
  try {
    const config = {
      method: "get",
      url: `https://suppliers-stats.wildberries.ru/api/v1/supplier/sales?key=${process.env.WB_APISTATKEY}&dateFrom=2002-10-09`,
    };

    const fbwSellsStat = await axios(config).then((response) => {
      return response.data;
    });

    if (!cb) {
      return fbwSellsStat;
    }
    cb(null, fbwSellsStat);
  } catch (e) {
    console.log(e);
    if (cb) {
      cb(e, null);
      return;
    }
    return null;
  }
};

exports.getWbShipment = (mayakSellsPerYear, cbFunc) => {
  try {
    async.parallel(
      {
        // Get all sells (all old from db and new from api with db update)
        allSells(callback) {
          async.waterfall(
            [
              (callback) => {
                async.parallel(
                  {
                    apiSellsStat(callback) {
                      exports.getApiSellsStat(callback);
                    },
                    dbSellsStat(callback) {
                      dbService.getAllSells(
                        { marketProductRef: "WbProduct" },
                        "marketProduct",
                        callback
                      );
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
          dbService.getAllVariations({}, "product wbProduct", callback);
        },
        updateWbStocks(callback) {
          try {
            dbService.updateWbStocks();
            callback(null, true);
          } catch (e) {
            console.log(e);
            callback(e, null);
          }
        },
      },
      (err, results) => {
        if (err) {
          console.log(err);
          cbFunc(err, null);
          return;
        }

        const { allVariations } = results;
        let { allSells } = results;

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
            variation.wbMonthSells = variationMonthSells;
            variation.mayakYearSells = variationMayakYearSells;

            allWbProducts.push(variation);
          }
        });

        const productsOnShipment = [];

        allWbProducts.forEach((variation) => {
          const name = `${variation.product.name} - ${variation.volume}`;

          const stock = variation.wbProduct.reduce(
            (totalStock, currentProduct) => totalStock + currentProduct.stock,
            0
          );

          const onShipment = Math.round(
            (variation.wbMonthSells >=
            variation.wbSells / monthsBetweenFirstLastSell
              ? variation.wbMonthSells
              : variation.wbSells / monthsBetweenFirstLastSell) - stock
          );

          const onShipmentMayak = Math.round(
            (variation.wbMonthSells >= variation.mayakYearSells / 12
              ? variation.wbMonthSells
              : variation.mayakYearSells / 12) - stock
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
              name,
              stock,
              sellPerMonth: variation.wbMonthSells,
              [`sells (cр за ${monthsBetweenFirstLastSell.toFixed(1)} мес)`]: (
                variation.wbSells / monthsBetweenFirstLastSell
              ).toFixed(1),
              sellMayakAvgPerYear: (variation.mayakYearSells / 12).toFixed(1),
              onShipment,
              onShipmentMayak,
            });
          }
        });

        cbFunc(null, productsOnShipment);
      }
    );
  } catch (e) {
    console.log(e);
    cbFunc(e, null);
  }
};
