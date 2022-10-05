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
  return productsInfo.map((product) => {
    const name = product.name
      .replaceAll(
        /[".:]|(Queridos Glir?tters)|(ГлиттерГель)|(Глиттер гель)|(Глиттер)|(Бл[её]стки для лица и тела)|(Цвета)|(Цвет)|(набора)|(для блёсток)|(3)|(6)|(мл\.?($|\s))|(Блестки для глаз)/gi,
        ""
      )
      .replace("набор", "Набор:")
      .replace("ГЕЛЬ-ЗАПРАВКА", "ГЗ")
      .replace("Хайлайтер", "Хай")
      .trim();

    const productStocks = productsStockList.find(
      (stockInfo) => stockInfo.product_id === product.id
    );

    return {
      article: product.offer_id,
      name,
      stockFBO: productStocks.stocks[0]?.present ?? 0,
      stockFBS: productStocks.stocks[1]?.present ?? 0,
    };
  });
};

exports.updateStock = async (offer_id, stock) => {
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
};
