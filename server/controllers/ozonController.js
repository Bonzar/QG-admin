const axios = require("axios");

const getHeadersRequire = () => {
  return {
    "Content-Type": "application/json",
    "Client-Id": process.env.OZON_CLIENTID,
    "Api-Key": process.env.OZON_APIKEY,
  };
};

exports.product_list = (req, res) => {
  try {
    const config = {
      method: "post",
      url: "https://api-seller.ozon.ru/v3/product/info/stocks",
      headers: {
        ...getHeadersRequire(req),
      },
      data: {
        filter: {},
        last_id: "",
        limit: 200,
      },
    };
    axios(config)
      .then((response) => {
        // res.send(JSON.stringify(response.data));
        res.render("stocks-table", {
          title: "Ozon Stocks",
          headers: {
            SKU: "productSku",
            Name: "productName",
            FBM: "productStockFBM",
            FBS: "productStockFBS",
          },
          products: response.data.result.items.map((product) => {
            return {
              productSku: product["product_id"],
              productName: product["offer_id"],
              productStockFBM: product.stocks[0]?.present ?? 0,
              productStockFBS: product.stocks[1]?.present ?? 0,
            };
          }),
        });
      })
      .catch((error) => {
        console.log(error);
      });
  } catch (error) {
    res
      .status(400)
      .send("Error while getting list of products. Try again later.");
  }
};
