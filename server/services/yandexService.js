const axios = require("axios");

const getHeadersRequire = () => {
  return {
    "Content-Type": "application/json",
    Authorization: `OAuth oauth_token="${process.env.YANDEX_OAUTHTOKEN}", oauth_client_id="${process.env.YANDEX_CLIENTID}"`,
  };
};

exports.getApiSkusList = async () => {
  return await axios
    .get(
      "https://api.partner.market.yandex.ru/v2/campaigns/21938028/offer-mapping-entries.json?limit=200",
      {
        headers: {
          ...getHeadersRequire(),
        },
      }
    )
    .then((response) => {
      return response.data.result.offerMappingEntries
        .filter((offer) => offer.offer.processingState.status !== "OTHER")
        .map((offer) => offer.offer.shopSku);
    });
};

exports.getApiProductsList = async (callback) => {
  try {
    const skusList = await module.exports.getApiSkusList();

    const config = {
      method: "post",
      url: "https://api.partner.market.yandex.ru/v2/campaigns/21938028/stats/skus.json",
      headers: {
        ...getHeadersRequire(),
      },
      data: {
        shopSkus: skusList,
      },
    };

    // List of all products
    const allProducts = await axios(config).then((response) => {
      return response.data.result.shopSkus;
    });

    if (!callback) {
      return allProducts;
    }
    callback(null, allProducts);
  } catch (e) {
    console.log(e);
    if (callback) {
      callback(e, null);
      return;
    }
    return e;
  }
};

exports.updateApiStock = async (sku, stockCount) => {
  const config = {
    method: "put",
    url: "https://api.partner.market.yandex.ru/v2/campaigns/21938028/offers/stocks.json",
    headers: {
      ...getHeadersRequire(),
    },
    data: {
      skus: [
        {
          sku,
          warehouseId: 52301,
          items: [
            {
              type: "FIT",
              count: stockCount,
              updatedAt: new Date().toISOString(),
            },
          ],
        },
      ],
    },
  };

  return await axios(config).then((response) => {
    return response.data;
  });
};

exports.getApiTodayOrders = async () => {
  const today = new Date();

  const filterDate = today
    .toLocaleString("ru", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    })
    .replaceAll(".", "-");

  const config = {
    method: "get",
    url: `https://api.partner.market.yandex.ru/v2/campaigns/21938028/orders.json?supplierShipmentDateFrom=${filterDate}&supplierShipmentDateTo=${filterDate}&status=PROCESSING`,
    headers: {
      ...getHeadersRequire(),
    },
  };

  return await axios(config).then((response) => {
    return response.data;
  });
};
