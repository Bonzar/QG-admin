const axios = require("axios");

exports.product_list = (req, res) => {
  try {
    const headersRequire = {
      "Content-Type": "application/json",
      "Client-Id": process.env.OZON_CLIENTID,
      "Api-Key": process.env.OZON_APIKEY,
    };
    const config = {
      method: "post",
      url: "https://api-seller.ozon.ru/v3/product/info/stocks",
      headers: {
        ...headersRequire,
      },
      data: {
        filter: {},
        last_id: "",
        limit: 200,
      },
    };
    axios(config)
      .then((response) => {
        res.send(JSON.stringify(response.data));
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
