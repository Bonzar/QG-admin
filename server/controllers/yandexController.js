import async from "async";
import * as yandexService from "../services/yandexService.js";
import * as dbService from "../services/dbService.js";

const connectYandexDataResultFormatter = (
  variation,
  yandexDbProduct,
  yandexApiProduct,
  yandexStock
) => {
  return {
    productInnerId: variation?.product._id,
    marketProductInnerId: yandexDbProduct?._id,
    productSku: yandexApiProduct.shopSku,
    productName:
      (variation?.product.name ?? "") +
      (["3 мл", "10 мл"].includes(variation?.volume)
        ? ` - ${variation?.volume}`
        : ""),
    productStock: {
      stock: yandexStock,
      updateBy: yandexDbProduct?.sku,
      marketType: "yandex",
    },
  };
};

export const getProductsListPage = (req, res) => {
  async
    .waterfall([
      (cb) => {
        async.parallel(
          {
            // Stocks on Yandex warehouse
            yandexApiProducts(callback) {
              yandexService
                .getApiProductsList([])
                .then((result) => callback(null, result))
                .catch((error) => callback(error, null));
            },
            // List of all products from DB
            allDbVariations(callback) {
              dbService
                .getAllVariations({}, ["product yandexProduct"])
                .then((variations) => callback(null, variations))
                .catch((error) => callback(error, null));
            },
            // List of yandex products from DB
            yandexDbProducts(callback) {
              dbService
                .getYandexProducts({})
                .then((products) => callback(null, products))
                .catch((error) => callback(error, null));
            },
          },
          cb
        );
      },
      (results, cb) => {
        const { yandexApiProducts, allDbVariations, yandexDbProducts } =
          results;

        async
          .parallel(
            yandexService.getConnectYandexDataRequests(
              req.query,
              yandexApiProducts,
              yandexDbProducts,
              allDbVariations,
              connectYandexDataResultFormatter
            )
          )
          .then((products) => cb(null, [products, yandexApiProducts]))
          .catch((error) => cb(error, null));
      },
    ])
    .then((results) => {
      let [products, yandexApiProducts] = results;

      // Clear product list of undefined after async
      products = products.filter((product) => !!product);

      // Sorting
      products.sort((product1, product2) =>
        product1.productName.localeCompare(product2.productName, "ru")
      );

      res.render("yandex-stocks", {
        title: "Yandex Stocks",
        marketType: "yandex",
        headers: {
          SKU: { type: "identifier", field: "productSku" },
          Name: { type: "name", field: "productName" },
          FBS: { type: "fbs", field: "productStock" },
        },
        products,
      });
      dbService.updateYandexStocks(yandexApiProducts);
    })
    .catch((error) => {
      console.error(error);
      return res.status(400).json({
        error,
        message: `Error while getting list of products. - ${error.message}`,
      });
    });
};

export const updateApiStock = (req, res) => {
  yandexService
    .updateApiStock(req.query.sku, req.query.stock)
    .then((response) => {
      res.json(response.data);
    })
    .catch((error) => {
      console.error(error);
      res.status(400).json({
        error,
        message: `Error while update api stocks. - ${error.message}`,
      });
    });
};
