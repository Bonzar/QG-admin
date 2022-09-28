const axios = require("axios");

exports.product_list = async (req, res) => {
  try {
    if (!req.query.access_token) {
      res.send({
        isAuthorize: false,
        clientId: process.env.YANDEX_CLIENTID,
      });
      return;
    }

    const headersRequire = {
      "Content-Type": "application/json",
      Authorization: `OAuth oauth_token="${req.query.access_token}", oauth_client_id="${process.env.YANDEX_CLIENTID}"`,
    };

    const shopSkus = await axios
      .get(
        "https://api.partner.market.yandex.ru/v2/campaigns/21938028/offer-mapping-entries.json?limit=200",
        {
          headers: {
            ...headersRequire,
          },
        }
      )
      .then((response) => {
        return response.data;
      })
      .catch((error) => {
        console.log(error);
      });

    const config = {
      method: "post",
      url: "https://api.partner.market.yandex.ru/v2/campaigns/21938028/stats/skus.json",
      headers: {
        ...headersRequire,
      },
      data: {
        shopSkus: shopSkus.result.offerMappingEntries.map(
          (offer) => offer.offer.shopSku
        ),
      },
    };

    const products = await axios(config)
      .then((response) => {
        return response.data.result.shopSkus;
      })
      .catch((error) => {
        console.log(error);
      });

    const productsToPrint = products.map((product) => {
      const productStocks =
        product.warehouses?.[0].stocks.find(
          (stockType) => stockType.type === "AVAILABLE"
        )?.count ?? 0;

      const productName = product.name
        .replaceAll(
          /[".:]|(Queridos Glir?tters)|(ГлиттерГель)|(Глиттер гель)|(Глиттер)|(Бл[её]стки для лица и тела)|(Цвета)|(Цвет)|(набора)|(для блёсток)|(Блестки для глаз)/gi,
          ""
        )
        .replace("набор", "Набор:")
        .replace("ГЕЛЬ-ЗАПРАВКА", "ГЗ");

      return {
        productSku: product.shopSku,
        productName,
        productStock: productStocks,
      };
    });

    res.send(
      JSON.stringify({
        isAuthorize: true,
        products: productsToPrint,
      })
    );
  } catch (error) {
    res
      .status(400)
      .send("Error while getting list of products. Try again later.");
  }
};
