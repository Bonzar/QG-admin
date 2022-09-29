const axios = require("axios");
const app = require("../app");

// eslint-disable-next-line no-unused-vars
const getAuthToken = async (req) => {
  return (
    process.env.YANDEX_OAUTHTOKEN ?? (await app.redisClient.get("token_access"))
  );
};

const getHeadersRequire = async (req) => {
  return {
    "Content-Type": "application/json",
    Authorization: `OAuth oauth_token="${await getAuthToken(
      req
    )}", oauth_client_id="${process.env.YANDEX_CLIENTID}"`,
  };
};

exports.product_list = async (req, res) => {
  try {
    if (!(await getAuthToken(req))) {
      // Если в параметрах уже есть код, обмен его на токен и сохранение в redis
      if (req.query.code) {
        const newAccessToken = await axios
          .post(
            `https://oauth.yandex.ru/token`,
            `grant_type=authorization_code&code=${req.query.code}&client_id=${process.env.YANDEX_CLIENTID}&client_secret=cde8bcd95507475ab0a04b07f091c5c8`
          )
          .then((response) => {
            return response.data.access_token;
          })
          .catch((error) => {
            console.log(error);
          });
        app.redisClient.set("token_access", newAccessToken);
      }
      // Параметра code нет в url -> показ страницы авторизации
      res.render("Auth", {
        title: "Авторизация",
        clientId: process.env.YANDEX_CLIENTID,
      });
      return;
    }
    const shopSkus = await axios
      .get(
        "https://api.partner.market.yandex.ru/v2/campaigns/21938028/offer-mapping-entries.json?limit=200",
        {
          headers: {
            ...(await getHeadersRequire(req)),
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
        ...(await getHeadersRequire(req)),
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
          (stockType) => stockType.type === "FIT"
        )?.count ?? 0;

      const productName = product.name
        .replaceAll(
          /[".:]|(Queridos Glir?tters)|(ГлиттерГель)|(Глиттер гель)|(Глиттер)|(Бл[её]стки для лица и тела)|(Цвета)|(Цвет)|(набора)|(для блёсток)|(Блестки для глаз)/gi,
          ""
        )
        .replace("набор", "Набор:")
        .replace("ГЕЛЬ-ЗАПРАВКА", "ГЗ")
        .replace("Хайлайтер", "Хай")
        .trim();

      return {
        productSku: product.shopSku,
        productName,
        productStock: productStocks,
      };
    });
    res.render("stocks-table", {
      token: getAuthToken(req),
      title: "Yandex Stocks",
      headers: {
        SKU: "productSku",
        Name: "productName",
        FBS: "productStock",
      },
      products: productsToPrint.sort((product1, product2) =>
        product1.productName.localeCompare(product2.productName)
      ),
    });
  } catch (error) {
    res
      .status(400)
      .send("Error while getting list of products. Try again later.");
  }
};

exports.update_stock = async (req, res) => {
  try {
    const config = {
      method: "put",
      url: "https://api.partner.market.yandex.ru/v2/campaigns/21938028/offers/stocks.json",
      headers: {
        ...(await getHeadersRequire(req)),
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
