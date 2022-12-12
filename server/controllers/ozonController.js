const ozonService = require("../services/ozonService");
const async = require("async");
const dbService = require("../services/dbService");
const connectOzonDataResultFormatter = (
  variation,
  ozonDbProduct,
  ozonApiProduct,
  stockFBO,
  stockFBS
) => {
  return {
    productInnerId: variation?.product._id,
    marketProductInnerId: ozonDbProduct?._id,
    sku: ozonApiProduct.id,
    article: ozonApiProduct.offer_id,
    name:
      (variation?.product.name ?? "") +
      (["3 мл", "10 мл"].includes(variation?.volume)
        ? ` - ${variation?.volume}`
        : ""),
    stockFBO,
    stockFBS: {
      stock: stockFBS,
      updateBy: ozonApiProduct.offer_id,
      marketType: "ozon",
    },
  };
};

exports.getProductsListPage = (req, res) => {
  async
    .waterfall([
      (cb) => {
        async.parallel(
          {
            // Stocks on Ozon warehouse
            ozonApiProductsInfo(callback) {
              ozonService
                .getApiProductsList({ visibility: "ALL" })
                .then((result) => callback(null, result))
                .catch((error) => callback(error, null));
            },
            // List of all products from DB
            allDbVariations(callback) {
              dbService
                .getAllVariations({}, ["product ozonProduct"])
                .then((variations) => callback(null, variations))
                .catch((error) => callback(error, null));
            },
            // List of ozon products from DB
            ozonDbProducts(callback) {
              dbService
                .getOzonProducts({})
                .then((products) => callback(null, products))
                .catch((error) => callback(error, null));
            },
          },
          cb
        );
      },
      (results, cb) => {
        const {
          allDbVariations,
          ozonApiProductsInfo: {
            productsInfo: ozonApiProducts,
            productsStockList: ozonApiStocks,
          },
          ozonDbProducts,
        } = results;

        async
          .parallel(
            ozonService.getConnectOzonDataRequests(
              req.query,
              ozonApiProducts,
              ozonApiStocks,
              ozonDbProducts,
              allDbVariations,
              connectOzonDataResultFormatter
            )
          )
          .then((products) => {
            cb(null, [products, ozonApiStocks]);
          })
          .catch((error) => {
            cb(error, null);
          });
      },
    ])
    .then((results) => {
      let [products, productsApiList] = results;

      // Clear product list of undefined after async
      products = products.filter((product) => !!product);

      // Sorting
      products.sort((product1, product2) =>
        product1.name.localeCompare(product2.name, "ru")
      );

      res.render("ozon-stocks", {
        title: "Ozon stocks",
        marketType: "ozon",
        headers: {
          Article: { type: "identifier", field: "article" },
          Name: { type: "name", field: "name" },
          FBM: { type: "fbm", field: "stockFBO" },
          FBS: { type: "fbs", field: "stockFBS" },
        },
        products,
      });
      dbService.updateOzonStocks(productsApiList);
    })
    .catch((error) => {
      console.log(error);
      return res.status(400).json({
        error,
        message: `Error while getting list of products. - ${error.message}`,
      });
    });
};

exports.updateStock = (req, res) => {
  ozonService
    .updateApiStock(req.query.id, req.query.stock)
    .then((result) => {
      res.json(result);
    })
    .catch((error) => {
      console.log(error);
      res.status(400).json({
        error,
        message: `Error while updating product stock. - ${error.message}`,
      });
    });
};
