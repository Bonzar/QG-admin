const axios = require("axios");

const getHeadersRequire = () => {
  return {
    "Content-Type": "application/json",
    "Client-Id": process.env.OZON_CLIENTID,
    "Api-Key": process.env.OZON_APIKEY,
  };
};

exports.getProductsList = async () => {
  const config = {
    method: "post",
    url: "https://api-seller.ozon.ru/v3/product/info/stocks",
    headers: {
      ...getHeadersRequire(),
    },
    data: {
      filter: {},
      last_id: "",
      limit: 200,
    },
  };

  return await axios(config).then((response) => {
    return response.data;
  });
};

exports.updateStock = async (product_id, stock) => {
  const config = {
    method: "post",
    url: "https://api-seller.ozon.ru/v1/product/import/stocks",
    headers: {
      ...getHeadersRequire(),
    },
    data: {
      stocks: [
        {
          product_id, // 55946,
          stock, // 4,
        },
      ],
    },
  };

  return await axios(config).then((response) => {
    return response.data;
  });
};
