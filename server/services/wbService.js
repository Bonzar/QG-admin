const axios = require("axios");
// const { clearName } = require("./nameFormatter");
// const async = require("async");

const getHeadersRequire = () => {
  return {
    "Content-Type": "application/json",
    Authorization: process.env.WB_APIKEY,
  };
};

exports.getProductIdsList = async () => {
  try {
    const config = {
      method: "post",
      url: "https://suppliers-api.wildberries.ru/content/v1/cards/list",
      timeout: 1000000,
      headers: {
        ...getHeadersRequire(),
      },
      data: {
        sort: {
          limit: 1000,
          // offset: 0,
          // searchValue: "",
          // sortColumn: "updateAt", // also only has hasPhoto sorting
          // ascending: false,
        },
      },
    };

    return await axios(config).then((response) => {
      return response.data;
    });
  } catch (e) {
    console.log(e);
  }
};

exports.getProductFbsStocks = async () => {
  try {
    const config = {
      method: "get",
      url: "https://suppliers-api.wildberries.ru/api/v2/stocks?skip=0&take=1000",
      timeout: 1000000,
      headers: {
        ...getHeadersRequire(),
      },
    };

    return await axios(config).then((response) => {
      return response.data;
    });
  } catch (e) {
    console.log(e);
  }
};

/*
 * Need second api-key for statistics
 */
// exports.getProductFboStocks = async () => {
//   try {
//     const config = {
//       method: "get",
//       url: `https://suppliers-stats.wildberries.ru/api/v1/supplier/stocks?key=${process.env.WB_APIKEY}&dateFrom=2022-10-08`,
//       // headers: {
//       //   ...getHeadersRequire(),
//       // },
//     };
//
//     return await axios(config).then((response) => {
//       return response.data;
//     });
//   } catch (e) {
//     console.log(e.response.data.errors);
//   }
// };

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
