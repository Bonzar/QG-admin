const axios = require("axios");
const async = require("async");
const { format: formatDate, sub: subFromDate } = require("date-fns");
const dbService = require("./dbService");

const ozonAPI = axios.create({
  baseURL: "https://api-seller.ozon.ru/",
  headers: {
    "Content-Type": "application/json",
    "Client-Id": process.env.OZON_CLIENTID,
    "Api-Key": process.env.OZON_APIKEY,
  },
});

exports.getProductsStockList = (filter = { visibility: "ALL" }) => {
  return ozonAPI
    .post("v3/product/info/stocks", {
      filter,
      last_id: "",
      limit: 1000,
    })
    .then((response) => {
      return response.data;
    });
};

exports.getProductsInfo = (ids) => {
  return ozonAPI
    .post("v2/product/info/list", {
      product_id: ids,
    })
    .then((response) => {
      return response.data;
    });
};

exports.getApiProductsList = async (filter) => {
  const productsStockList = (await module.exports.getProductsStockList(filter))
    .result.items;

  const productsIds = productsStockList.map((product) => product.product_id);

  const productsInfo = (await module.exports.getProductsInfo(productsIds))
    .result.items;

  return { productsInfo, productsStockList };
};

exports.updateApiStock = (offer_id, stock) => {
  return ozonAPI
    .post("v1/product/import/stocks", {
      stocks: [
        {
          offer_id,
          stock,
        },
      ],
    })
    .then((response) => {
      return response.data;
    });
};

exports.getTodayOrders = () => {
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
    .then((response) => {
      return response.data.result.postings;
    });
};

exports.getOverdueOrders = async () => {
  const date = new Date();
  const today = date.setHours(0, 0, 0, 0);

  date.setDate(date.getDate() - 1);
  date.setHours(23, 59, 59, 999);
  const dateEnd = date.toISOString();

  date.setDate(date.getDate() - 30);
  date.setHours(0, 0, 0, 0);
  const dateStart = date.toISOString();

  let overdueOrders = await ozonAPI.post("v3/posting/fbs/list", {
    dir: "ASC",
    filter: {
      since: dateStart,
      to: dateEnd,
    },
    limit: 100,
    offset: 0,
    with: {},
  });
  overdueOrders = overdueOrders.data.result.postings;

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
};

exports.getOzonShipment = async () => {
  // format date for requests
  const today = new Date();

  // don't take today orders
  const yesterday = subFromDate(today, { days: 1 });
  // date month ago
  const monthAgo = subFromDate(yesterday, { months: 1 });
  // date 11 month ago
  const elevenMonthsAgo = subFromDate(yesterday, { months: 11 });
  // date year ago
  const yearAgo = subFromDate(yesterday, { years: 1 });
  // date 13 month ago
  const thirteenMonthsAgo = subFromDate(yesterday, { months: 13 });

  const config = {
    method: "post",
    url: "v1/analytics/data",
    data: {
      date_from: null,
      date_to: null,
      metrics: ["ordered_units"],
      dimension: ["sku"],
      filters: [],
      limit: 1000,
      offset: 0,
    },
  };

  const getMonthAgoData = () => {
    return ozonAPI
      .request({
        ...config,
        data: {
          ...config.data,
          date_to: formatDate(yesterday, "yyyy-MM-dd"),
          date_from: formatDate(monthAgo, "yyyy-MM-dd"),
        },
      })
      .then((response) => {
        return response.data;
      });
  };

  const getPartYearAgoData = () => {
    return ozonAPI
      .request({
        ...config,
        data: {
          ...config.data,
          date_to: formatDate(monthAgo, "yyyy-MM-dd"),
          date_from: formatDate(elevenMonthsAgo, "yyyy-MM-dd"),
        },
      })
      .then((response) => {
        return response.data;
      });
  };

  const getNextMonthYearAgoData = () => {
    return ozonAPI
      .request({
        ...config,
        data: {
          ...config.data,
          date_to: formatDate(elevenMonthsAgo, "yyyy-MM-dd"),
          date_from: formatDate(yearAgo, "yyyy-MM-dd"),
        },
      })
      .then((response) => {
        return response.data;
      });
  };

  const getPreviousMonthYearAgoData = () => {
    return ozonAPI
      .request({
        ...config,
        data: {
          ...config.data,
          date_to: formatDate(yearAgo, "yyyy-MM-dd"),
          date_from: formatDate(thirteenMonthsAgo, "yyyy-MM-dd"),
        },
      })
      .then((response) => {
        return response.data;
      });
  };

  const requestsData = await async.parallel({
    // Orders number for month by product
    monthAgoData(callback) {
      getMonthAgoData()
        .then((results) => callback(null, results))
        .catch((error) => callback(error, null));
    },
    // Orders number for year by product
    partYearAgoData(callback) {
      getPartYearAgoData()
        .then((results) => callback(null, results))
        .catch((error) => callback(error, null));
    },
    //
    nextMonthYearAgoData(callback) {
      getNextMonthYearAgoData()
        .then((results) => callback(null, results))
        .catch((error) => callback(error, null));
    },
    //
    previousMonthYearAgoData(callback) {
      getPreviousMonthYearAgoData()
        .then((results) => callback(null, results))
        .catch((error) => callback(error, null));
    },
    // Product detailed info list and product-id/stock list
    productsFullInfo(callback) {
      module.exports
        .getApiProductsList()
        .then((results) => callback(null, results))
        .catch((error) => callback(error, null));
    },
    ozonDbProducts(callback) {
      dbService
        .getOzonProducts({})
        .then((products) => callback(null, products))
        .catch((error) => callback(error, null));
    },
    // List of all products from DB
    allDbVariations(callback) {
      dbService
        .getAllVariations({}, ["product ozonProduct"])
        .then((variations) => callback(null, variations))
        .catch((error) => callback(error, null));
    },
  });

  const {
    monthAgoData,
    partYearAgoData,
    nextMonthYearAgoData,
    previousMonthYearAgoData,
    ozonDbProducts,
    allDbVariations,
    productsFullInfo: { productsInfo, productsStockList },
  } = requestsData;

  // Joining data and return only products with positive onShipment value
  const products = [];

  const allSellsNextMonthYearAgo = nextMonthYearAgoData.result.data.reduce(
    (total, currentProduct) => total + currentProduct["metrics"][0] ?? 0,
    0
  );

  const allSellsPreviousMonthYearAgo =
    previousMonthYearAgoData.result.data.reduce(
      (total, currentProduct) => total + currentProduct["metrics"][0] ?? 0,
      0
    );

  const previousYearNextMonthRise =
    allSellsNextMonthYearAgo / allSellsPreviousMonthYearAgo;

  productsInfo.forEach((product) => {
    let ozonDbProduct;
    // Search variation for market product from api
    const variation = allDbVariations.find(
      (variation) =>
        // Search market product in db for market product from api
        variation.ozonProduct?.filter((variationOzonDbProduct) => {
          const isMarketProductMatch =
            variationOzonDbProduct.sku === product["id"];

          // find -> save market product
          if (isMarketProductMatch) {
            ozonDbProduct = variationOzonDbProduct;
          }

          return isMarketProductMatch;
        }).length > 0
    );

    if (!ozonDbProduct) {
      // Search fetched product from ozon in DB
      ozonDbProduct = ozonDbProducts.find(
        (ozonDbProduct) => ozonDbProduct.sku === product["id"]
      );
    }

    // Skip not actual products
    if (!ozonDbProduct.isActual) {
      return;
    }

    const stock =
      productsStockList.find((stockInfo) => stockInfo.product_id === product.id)
        .stocks[0]?.present ?? 0;

    const sellsMonthAgo = product.sources.reduce((total, currentSource) => {
      total +=
        monthAgoData.result.data.find((productData) => {
          return +productData["dimensions"][0].id === currentSource.sku;
        })?.metrics[0] ?? 0;

      return total;
    }, 0);

    const sellsNextMonthYearAgo = product.sources.reduce(
      (total, currentSource) => {
        total +=
          nextMonthYearAgoData.result.data.find((productData) => {
            return +productData["dimensions"][0].id === currentSource.sku;
          })?.metrics[0] ?? 0;

        return total;
      },
      0
    );

    const sellsPreviousMonthYearAgo = product.sources.reduce(
      (total, currentSource) => {
        total +=
          previousMonthYearAgoData.result.data.find((productData) => {
            return +productData["dimensions"][0].id === currentSource.sku;
          })?.metrics[0] ?? 0;

        return total;
      },
      0
    );

    // Only 10 months from year
    const partSellsYearAgo = product.sources.reduce((total, currentSource) => {
      total +=
        partYearAgoData.result.data.find((productData) => {
          return +productData["dimensions"][0].id === currentSource.sku;
        })?.metrics[0] ?? 0;

      return total;
    }, 0);

    const sellsYearAgoMonthAvg = Math.round(
      (partSellsYearAgo + sellsMonthAgo + sellsNextMonthYearAgo) / 12
    );

    const predictedSells = Math.round(
      (sellsMonthAgo > 0 ? sellsMonthAgo : 1) * previousYearNextMonthRise
    );

    const onShipment = predictedSells - stock;

    if (onShipment > 0) {
      products.push({
        article: product.offer_id,
        name: variation.product.name,
        stock,
        sellsYearAgoMonthAvg,
        sellsPreviousMonthYearAgo,
        sellsNextMonthYearAgo,
        sellsMonthAgo,
        rise: (sellsNextMonthYearAgo / sellsPreviousMonthYearAgo).toFixed(2),
        predictedSells,
        onShipment: onShipment > 0 ? onShipment : 0,
      });
    }
  });

  return products;
};

exports.getConnectOzonDataRequests = (
  filters,
  ozonApiProducts,
  ozonApiStocks,
  ozonDbProducts,
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

      if (!ozonDbProduct) {
        // Search fetched product from ozon in DB
        ozonDbProduct = ozonDbProducts.find(
          (ozonDbProduct) => ozonDbProduct.sku === ozonApiProduct["id"]
        );
      }

      const productStocks = ozonApiStocks.find(
        (stockInfo) => stockInfo.product_id === ozonApiProduct.id
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
