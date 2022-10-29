const axios = require("axios");
const { clearName } = require("./nameFormatter");
const async = require("async");

const getHeadersRequire = () => {
  return {
    "Content-Type": "application/json",
    "Client-Id": process.env.OZON_CLIENTID,
    "Api-Key": process.env.OZON_APIKEY,
  };
};

exports.getProductsStockList = async (
  filter = { visibility: "ALL" },
  callback
) => {
  try {
    const config = {
      method: "post",
      url: "https://api-seller.ozon.ru/v3/product/info/stocks",
      headers: {
        ...getHeadersRequire(),
      },
      data: {
        filter,
        last_id: "",
        limit: 1000,
      },
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
    if (callback) {
      callback(e, null);
      return;
    }
    return e;
  }
};

exports.getProductsInfo = async (ids) => {
  const config = {
    method: "post",
    url: "https://api-seller.ozon.ru/v2/product/info/list",
    headers: {
      ...getHeadersRequire(),
    },
    data: {
      product_id: ids,
    },
  };

  return await axios(config)
    .then((response) => {
      return response.data;
    })
    .catch((e) => {
      console.log(e);
    });
};

exports.getApiProductsList = async (filter, callback) => {
  try {
    const productsStockList = (
      await module.exports.getProductsStockList(filter)
    ).result.items;

    const productsIds = productsStockList.map((product) => product.product_id);

    const productsInfo = (await module.exports.getProductsInfo(productsIds))
      .result.items;

    // Products list with article, name and stocks fields
    if (callback) {
      return callback(null, { productsInfo, productsStockList });
    }
    return { productsInfo, productsStockList };
  } catch (e) {
    console.log(e);
    if (callback) {
      callback(e, null);
      return;
    }
    return e;
  }
};

exports.updateApiStock = async (offer_id, stock, callback) => {
  try {
    const config = {
      method: "post",
      url: "https://api-seller.ozon.ru/v1/product/import/stocks",
      headers: {
        ...getHeadersRequire(),
      },
      data: {
        stocks: [
          {
            offer_id,
            stock,
          },
        ],
      },
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
      return new Error(e);
    }
    callback(e, null);
  }
};

exports.getTodayOrders = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0);
    const todayStart = today.toISOString();
    today.setHours(23, 59, 59, 999);
    const todayEnd = today.toISOString();

    const config = {
      method: "post",
      url: "https://api-seller.ozon.ru/v3/posting/fbs/unfulfilled/list",
      headers: {
        ...getHeadersRequire(),
      },
      data: {
        dir: "ASC",
        filter: {
          cutoff_from: todayStart,
          cutoff_to: todayEnd,
        },
        limit: 100,
        offset: 0,
        with: {},
      },
    };

    return await axios(config).then((response) => {
      return response.data.result.postings;
    });
  } catch (e) {
    console.log(e.code);
  }
};

exports.getOverdueOrders = async () => {
  try {
    const date = new Date();
    const today = date.setHours(0, 0, 0, 0);

    date.setDate(date.getDate() - 1);
    date.setHours(23, 59, 59, 999);
    const dateEnd = date.toISOString();

    date.setDate(date.getDate() - 30);
    date.setHours(0, 0, 0, 0);
    const dateStart = date.toISOString();

    const config = {
      method: "post",
      url: "https://api-seller.ozon.ru/v3/posting/fbs/list",
      headers: {
        ...getHeadersRequire(),
      },
      data: {
        dir: "ASC",
        filter: {
          since: dateStart,
          to: dateEnd,
        },
        limit: 100,
        offset: 0,
        with: {},
      },
    };

    const overdueOrders = await axios(config).then((response) => {
      return response.data.result.postings;
    });

    return overdueOrders.filter((order) => {
      const orderShipmentDate = new Date(order.shipment_date).setHours(
        0,
        0,
        0,
        0
      );

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
  } catch (e) {
    console.log(e);
  }
};

exports.getOzonShipment = async () => {
  // format date for analytics requests
  const today = new Date();
  today.setDate(today.getDate() - 1);
  const filterStartMonth = `${today.getFullYear()}-${
    today.getMonth() < 10 ? `0${today.getMonth()}` : today.getMonth()
  }-${today.getDate() < 10 ? `0${today.getDate()}` : today.getDate()}`;
  const filterStartYear = `${today.getFullYear() - 1}-${
    today.getMonth() + 1 < 10
      ? `0${today.getMonth() + 1}`
      : today.getMonth() + 1
  }-${today.getDate() < 10 ? `0${today.getDate()}` : today.getDate()}`;
  const filterEnd = `${today.getFullYear()}-${
    today.getMonth() + 1 < 10
      ? `0${today.getMonth() + 1}`
      : today.getMonth() + 1
  }-${today.getDate() < 10 ? `0${today.getDate()}` : today.getDate()}`;

  const config = {
    method: "post",
    url: "https://api-seller.ozon.ru/v1/analytics/data",
    headers: {
      ...getHeadersRequire(),
    },
    data: {
      date_from: null,
      date_to: filterEnd,
      metrics: ["ordered_units"],
      dimension: ["sku"],
      filters: [],
      limit: 1000,
      offset: 0,
    },
  };

  const getProductsFullInfo = async (callback) => {
    try {
      const ProductsFullInfo = await module.exports.getApiProductsList();
      return callback(null, ProductsFullInfo);
    } catch (e) {
      console.log(e);
      return callback(e, null);
    }
  };

  const getMonthData = async (callback) => {
    try {
      const monthData = await axios({
        ...config,
        data: { ...config.data, date_from: filterStartMonth },
      })
        .then((response) => {
          return response.data;
        })
        .catch((e) => {
          console.log(e);
        });

      callback(null, monthData);
    } catch (e) {
      console.log(e);
      callback(e, null);
    }
  };

  const getYearData = async (callback) => {
    try {
      const yearData = await axios({
        ...config,
        data: { ...config.data, date_from: filterStartYear },
      })
        .then((response) => {
          return response.data;
        })
        .catch((e) => {
          console.log(e);
        });

      callback(null, yearData);
    } catch (e) {
      console.log(e);
      callback(e, null);
    }
  };

  const requestsData = await async.parallel({
    // Orders number for month by product
    monthData(callback) {
      getMonthData(callback);
    },
    // Orders number for year by product
    yearData(callback) {
      getYearData(callback);
    },
    // Product detailed info list and product-id/stock list
    productsFullInfo(callback) {
      getProductsFullInfo(callback);
    },
  });

  const { productsInfo, productsStockList } = requestsData.productsFullInfo;
  const monthData = requestsData.monthData;
  const yearData = requestsData.yearData;

  // Joining data and return only products with positive onShipment value
  const products = [];
  productsInfo.forEach((product) => {
    const name = clearName(product.name);

    const stock =
      productsStockList.find((stockInfo) => stockInfo.product_id === product.id)
        .stocks[0]?.present ?? 0;

    const sellPerMonth = product.sources.reduce((total, currentSource) => {
      total +=
        monthData.result.data.find((productData) => {
          return +productData["dimensions"][0].id === currentSource.sku;
        })?.metrics[0] ?? 0;

      return total;
    }, 0);

    const sellPerYear = product.sources.reduce((total, currentSource) => {
      total +=
        yearData.result.data.find((productData) => {
          return +productData["dimensions"][0].id === currentSource.sku;
        })?.metrics[0] ?? 0;
      return total;
    }, 0);

    const onShipment = Math.round(
      (sellPerMonth >= sellPerYear / 12 ? sellPerMonth : sellPerYear / 12) -
        stock
    );

    if (onShipment > 0) {
      products.push({
        article: product.offer_id,
        name,
        stock,
        sellPerMonth,
        sellPerYear,
        onShipment,
      });
    }
  });

  return products;
};

exports.getConnectOzonDataRequests = (
  filters,
  ozonApiProducts,
  ozonApiStocks,
  allDbVariations,
  connectOzonDataResultFormatter
) => {
  return ozonApiProducts.map((ozonApiProduct) => {
    return async function () {
      let ozonDbProduct;
      // Search variation for market product from api
      const variation = allDbVariations.find(
        (variation) =>
          // Search market product in db for market product from api
          variation.ozonProduct?.filter((variationOzonDbProduct) => {
            const isMarketProductMatch =
              variationOzonDbProduct.sku === ozonApiProduct["id"];

            // find -> save market product
            if (isMarketProductMatch) {
              ozonDbProduct = variationOzonDbProduct;
            }

            return isMarketProductMatch;
          }).length > 0
      );

      const productStocks = ozonApiStocks.find(
        (stockInfo) => stockInfo.product_id === ozonApiProduct.id
      );

      const stockFBO = productStocks.stocks[0]?.present ?? 0;
      const stockFBS = productStocks.stocks[1]?.present ?? 0;

      // Filtration
      let isPassFilterArray = [];
      // by stock status
      switch (filters.stock_status) {
        // Filter only outofstock products (by FBS)
        case "outofstock":
          isPassFilterArray.push(stockFBS <= 0);
          break;
        // Filter only outofstock products (by FBO and FBS)
        case "outofstockall":
          isPassFilterArray.push(stockFBS <= 0 && stockFBO <= 0);
          break;
        // Filter only instock on FBS products
        case "instockFBS":
          isPassFilterArray.push(stockFBS > 0);
          break;
        // Filter only instock on FBW products
        case "instockFBM":
          isPassFilterArray.push(stockFBO > 0);
          break;
        // Filter only instock on FBW or FBS products (some of them)
        case "instockSome":
          isPassFilterArray.push(stockFBS > 0 || stockFBO > 0);
          break;
      }

      // by actual (manual setup in DB)
      switch (filters.isActual) {
        case "notActual":
          isPassFilterArray.push(ozonDbProduct?.isActual === false);
          break;
        case "all":
          isPassFilterArray.push(true);
          break;
        // Only actual by default
        default:
          isPassFilterArray.push(ozonDbProduct?.isActual !== false);
      }

      if (isPassFilterArray.every((pass) => pass)) {
        return connectOzonDataResultFormatter(
          variation,
          ozonDbProduct,
          ozonApiProduct,
          stockFBO,
          stockFBS
        );
      }
    };
  });
};
