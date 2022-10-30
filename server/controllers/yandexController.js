const yandexService = require("../services/yandexService");
const async = require("async");
const dbService = require("../services/dbService");

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
      updateBy: yandexDbProduct.sku,
      marketType: "yandex",
    },
  };
};

exports.getProductsListPage = async (req, res) => {
  try {
    async.waterfall(
      [
        (cb) => {
          async.parallel(
            {
              // Stocks on Yandex warehouse
              yandexApiProducts(callback) {
                yandexService.getApiProductsList([], callback);
              },
              // List of all products from DB with reference of Yandex product sku to product name
              allDbVariations(callback) {
                dbService.getAllVariations(
                  {},
                  ["product yandexProduct"],
                  callback
                );
              },
              // List of yandex products from DB
              yandexDbProducts(callback) {
                dbService.getYandexProducts({}, callback);
              },
            },
            cb
          );
        },
        (results, cb) => {
          const { yandexApiProducts, allDbVariations, yandexDbProducts } =
            results;

          async.parallel(
            yandexService.getConnectYandexDataRequests(
              req.query,
              yandexApiProducts,
              yandexDbProducts,
              allDbVariations,
              connectYandexDataResultFormatter
            ),
            (err, products) => {
              if (err) {
                cb(err, null);
                return;
              }
              // Ok
              cb(null, [products, yandexApiProducts]);
            }
          );
        },
      ],
      (err, results) => {
        if (err) {
          console.log(err);
          return res.status(400).json({
            message: "Error while getting list of products. Try again later.",
            code: err.code,
            status: err.response?.status,
          });
        }

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
      }
    );
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message: "Error while getting list of products. Try again later.",
      code: err.code,
      status: err.response?.status,
    });
  }
};

exports.updateApiStock = async (req, res) => {
  try {
    yandexService
      .updateApiStock(req.query.sku, req.query.stock)
      .then((response) => {
        res.send(JSON.stringify(response.data));
      })
      .catch((error) => {
        console.log(error);
        res.status(400).json(error);
      });
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message: "Error while update stock of product. Try again later.",
      code: err.code,
      status: err.response?.status,
    });
  }
};
