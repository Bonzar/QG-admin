const axios = require("axios");

const getHeadersRequire = (req) => {
  return {
    "Content-Type": "application/json",
    Authorization: `OAuth oauth_token="${req.query.access_token}", oauth_client_id="${process.env.YANDEX_CLIENTID}"`,
  };
};

exports.product_list = async (req, res) => {
  try {
    if (!req.query.access_token) {
      res.send({
        isAuthorize: false,
        clientId: process.env.YANDEX_CLIENTID,
      });
      return;
    }

    const shopSkus = await axios
      .get(
        "https://api.partner.market.yandex.ru/v2/campaigns/21938028/offer-mapping-entries.json?limit=200",
        {
          headers: {
            ...getHeadersRequire(req),
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
        ...getHeadersRequire(req),
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

exports.update_stock = (req, res) => {
  try {
    const config = {
      method: "put",
      url: "https://api.partner.market.yandex.ru/v2/campaigns/21938028/offers/stocks.json",
      headers: {
        ...getHeadersRequire(req),
      },
      data: {
        skus: [
          {
            sku: req.query.sku,
            warehouseId: 52301,
            items: [
              {
                type: "FIT",
                count: req.query.stock,
                updatedAt: new Date().toISOString(),
              },
            ],
          },
        ],
      },
    };

    axios(config)
      .then((response) => {
        res.send(JSON.stringify(response.data));
      })
      .catch((error) => {
        console.log(error);
      });
  } catch (e) {
    res
      .status(400)
      .send("Error while updating stock of product. Try again later.");
  }
};
