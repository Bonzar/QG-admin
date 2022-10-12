const axios = require("axios");

const getHeadersRequire = () => {
  return {
    "Content-Type": "application/json",
    Authorization: process.env.WB_APIKEY,
  };
};

exports.getProductsInfoList = async (searchValue = null, callback) => {
  try {
    const config = {
      method: "post",
      url: `https://suppliers-api.wildberries.ru/content/v1/cards/list`,
      headers: {
        ...getHeadersRequire(),
      },
      data: {
        sort: {
          limit: 1000,
          // offset: 0,
          searchValue: searchValue?.toString() ?? "",
          // sortColumn: "updateAt", // also only has hasPhoto sorting
          // ascending: false,
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
    }
  }
};

exports.getProductFbsStocks = async (callback) => {
  try {
    const config = {
      method: "get",
      url: "https://suppliers-api.wildberries.ru/api/v2/stocks?skip=0&take=1000",
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

exports.getProductFbwStocks = async (callback) => {
  try {
    const config = {
      method: "get",
      url: `https://suppliers-stats.wildberries.ru/api/v1/supplier/stocks?key=${process.env.WB_APISTATKEY}&dateFrom=2022-10-09`,
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

exports.updateStock = async (barcode, stock) => {
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

  return await axios(config).then((response) => {
    return response.data;
  });
};

exports.getTodayOrders = async (callback) => {
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
