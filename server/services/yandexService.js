import axios from "axios";

const yandexAPI = axios.create({
  baseURL: "https://api.partner.market.yandex.ru/",
  headers: {
    "Content-Type": "application/json",
    Authorization: `OAuth oauth_token="${process.env.YANDEX_OAUTHTOKEN}", oauth_client_id="${process.env.YANDEX_CLIENTID}"`,
  },
});

export const getApiSkusList = () => {
  return yandexAPI
    .get("v2/campaigns/21938028/offer-mapping-entries.json?limit=200")
    .then((response) => {
      return response.data.result.offerMappingEntries
        .filter((offer) => offer.offer.processingState.status !== "OTHER")
        .map((offer) => offer.offer.shopSku);
    });
};

export const getApiProductsList = async (skusList = []) => {
  if (skusList.length <= 0) {
    skusList = await getApiSkusList();
  }

  // List of all products
  return yandexAPI
    .post("v2/campaigns/21938028/stats/skus.json", {
      shopSkus: skusList,
    })
    .then((response) => {
      return response.data.result.shopSkus;
    });
};

export const updateApiStock = (sku, stockCount) => {
  return yandexAPI
    .put("v2/campaigns/21938028/offers/stocks.json", {
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
    })
    .then((response) => {
      return response.data;
    });
};

export const getApiTodayOrders = () => {
  const today = new Date();

  const filterDate = today
    .toLocaleString("ru", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    })
    .replaceAll(".", "-");

  return yandexAPI
    .get(
      `v2/campaigns/21938028/orders.json?supplierShipmentDateFrom=${filterDate}&supplierShipmentDateTo=${filterDate}&status=PROCESSING`
    )
    .then((response) => {
      return response.data;
    });
};

export const getConnectYandexDataRequests = (
  filters,
  yandexApiProducts,
  yandexDbProducts,
  allDbVariations,
  connectYandexDataResultFormatter
) => {
  return yandexApiProducts.map((yandexApiProduct) => {
    return async () => {
      let yandexDbProduct;
      // Search variation for market product from api
      const variation = allDbVariations.find(
        (variation) =>
          // Search market product in db for market product from api
          variation.yandexProduct?.filter((variationYandexDbProduct) => {
            const isMarketProductMatch =
              variationYandexDbProduct.sku === yandexApiProduct["shopSku"];

            // find -> save market product
            if (isMarketProductMatch) {
              yandexDbProduct = variationYandexDbProduct;
            }

            return isMarketProductMatch;
          }).length > 0
      );

      if (!yandexDbProduct) {
        yandexDbProduct = yandexDbProducts.find(
          (yandexDbProduct) =>
            yandexDbProduct.sku === yandexApiProduct["shopSku"]
        );
      }

      const yandexStock =
        yandexApiProduct.warehouses?.[0].stocks.find(
          (stockType) => stockType.type === "FIT"
        )?.count ?? 0;

      // Filtration
      let isPassFilterArray = [];
      // by stock status
      if (filters.stock_status === "outofstock") {
        isPassFilterArray.push(yandexStock <= 0);
      }
      // by actual (manual setup in DB)
      switch (filters.isActual) {
        case "notActual":
          isPassFilterArray.push(yandexDbProduct?.isActual === false);
          break;
        case "all":
          isPassFilterArray.push(true);
          break;
        // Only actual by default
        default:
          isPassFilterArray.push(yandexDbProduct?.isActual !== false);
      }

      if (!isPassFilterArray.every((pass) => pass)) return;

      return connectYandexDataResultFormatter(
        variation,
        yandexDbProduct,
        yandexApiProduct,
        yandexStock
      );
    };
  });
};
