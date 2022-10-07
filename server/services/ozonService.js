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

exports.getProductsStockList = async () => {
  const config = {
    method: "post",
    url: "https://api-seller.ozon.ru/v3/product/info/stocks",
    headers: {
      ...getHeadersRequire(),
    },
    data: {
      filter: { visibility: "ALL" },
      last_id: "",
      limit: 1000,
    },
  };

  return await axios(config).then((response) => {
    return response.data;
  });
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

exports.getProductsList = async () => {
  const productsStockList = (await module.exports.getProductsStockList()).result
    .items;

  const productsIds = productsStockList.map((product) => product.product_id);

  const productsInfo = (await module.exports.getProductsInfo(productsIds))
    .result.items;

  // Products list with article, name and stocks fields
  return { productsInfo, productsStockList };
};

exports.updateStock = async (offer_id, stock) => {
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

    return await axios(config).then((response) => {
      return response.data;
    });
  } catch (e) {
    console.log(e);
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
    console.log(e.code);
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
      const ProductsFullInfo = await module.exports.getProductsList();
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
          return +productData.dimensions[0].id === currentSource.sku;
        })?.metrics[0] ?? 0;

      return total;
    }, 0);

    const sellPerYear = product.sources.reduce((total, currentSource) => {
      total +=
        yearData.result.data.find((productData) => {
          return +productData.dimensions[0].id === currentSource.sku;
        })?.metrics[0] ?? 0;
      return total;
    }, 0);

    const onShipment = Math.round(
      (sellPerMonth >= sellPerYear / 12 ? sellPerMonth : sellPerYear / 12) * 2 -
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
