const path = require("path");
const axios = require("axios");
const express = require("express");
const app = express();

const PORT = process.env.PORT || 1234;

const buildPath = path.join(__dirname, "..", "dist");
app.use(express.static(buildPath));

app.get("/yandex-stocks", async (req, res) => {
  try {
    const authorization = {
      Authorization:
        'OAuth oauth_token="y0_AgAAAAAS1CmNAAhtsAAAAADPYoE0sFOwF-gGQq2gjR8AqiIGxQBAR04", oauth_client_id="111ace45a0254fec8d4550d496bb10b3"',
      "Content-Type": "application/json",
    };

    const shopSkus = await axios
      .get(
        "https://api.partner.market.yandex.ru/v2/campaigns/21938028/offer-mapping-entries.json?limit=200",
        {
          headers: {
            ...authorization,
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
        ...authorization,
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
      const productStock =
        product.warehouses?.[0].stocks.find(
          (stockType) => stockType.type === "AVAILABLE"
        )?.count ?? 0;

      const productName = product.name
        .replaceAll(
          /[".]|(Queridos Gli[r]?tters)|(ГлиттерГель)|(Бл[её]стки для лица и тела)|(Цвета)|(Цвет)|(Глиттер)|(Набора)|(для блёсток)|(Блестки для глаз)/g,
          ""
        )
        .replace("набор ", "Набор")
        .replace("ГЕЛЬ-ЗАПРАВКА", "ГЗ");

      return {
        productSku: product.shopSku,
        productName,
        productStock,
      };
    });

    res.send(JSON.stringify(productsToPrint));
  } catch (error) {
    res.status(400).send("Error while getting list of jobs. Try again later.");
  }
});

app.listen(PORT, () => {
  console.log(`server started on port ${PORT}`);
});
