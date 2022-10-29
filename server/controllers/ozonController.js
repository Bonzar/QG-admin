const ozonService = require("../services/ozonService");
const async = require("async");
const dbService = require("../services/dbService");

exports.getProductsListPage = async (req, res) => {
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

  try {
    async.waterfall(
      [
        (cb) => {
          async.parallel(
            {
              // Stocks on WB warehouse
              ozonApiProductsInfo(callback) {
                ozonService.getApiProductsList({ visibility: "ALL" }, callback);
              },
              // List of all products from DB with reference of WB product sku to product name
              allDbVariations(callback) {
                dbService.getAllVariations(
                  {},
                  ["product ozonProduct"],
                  callback
                );
              },
            },
            cb
          );
        },
        (results, cb) => {
          const { allDbVariations, ozonApiProductsInfo } = results;

          const {
            productsInfo: ozonApiProducts,
            productsStockList: ozonApiStocks,
          } = ozonApiProductsInfo;

          async.parallel(
            ozonService.getConnectOzonDataRequests(
              req.query,
              ozonApiProducts,
              ozonApiStocks,
              allDbVariations,
              connectOzonDataResultFormatter
            ),
            (err, products) => {
              if (err) {
                cb(err, null);
                return;
              }
              // Ok
              cb(null, [products, ozonApiStocks]);
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

exports.updateStock = async (req, res) => {
  try {
    ozonService
      .updateApiStock(req.query.id, req.query.stock)
      .then((result) => {
        res.json(result);
      })
      .catch((err) => {
        console.log(err);
        res.status(400).json({
          message: "Error while updating product stock. Try again later.",
          code: err.code,
          status: err.response?.status,
        });
      });
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message: "Error while updating product stock. Try again later.",
      code: err.code,
      status: err.response?.status,
    });
  }
};
