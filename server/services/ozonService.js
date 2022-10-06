const axios = require("axios");

const getHeadersRequire = () => {
  return {
    "Content-Type": "application/json",
    "Client-Id": process.env.OZON_CLIENTID,
    "Api-Key": process.env.OZON_APIKEY,
  };
};

exports.getProductsIdList = async () => {
  const config = {
    method: "post",
    url: "https://api-seller.ozon.ru/v2/product/list",
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
            offer_id, // 55946,
            stock, // 4,
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
    today.setUTCHours(0, 0, 0);
    const todayStart = today.toISOString();
    today.setUTCHours(23, 59, 59, 999);
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
          delivering_date_from: todayStart,
          delivering_date_to: todayEnd,
        },
        limit: 100,
        offset: 0,
        with: {},
      },
    };

    return await axios(config).then((response) => {
      return response.data;
    });
  } catch (e) {
    console.log(e.code);
  }
};
