import async from "async";
import * as wbService from "../services/wbService.js";
import * as dbService from "../services/dbService.js";

const connectWbDataResultFormatter = (
  variation,
  wbDbProduct,
  wbApiProduct,
  stockFBW,
  stockFBS
) => {
  return {
    productInnerId: variation?.product._id,
    marketProductInnerId: wbDbProduct?._id,
    barcode: wbDbProduct?.barcode ?? "",
    articleWb: wbApiProduct["nmID"],
    article: wbApiProduct["vendorCode"],
    name:
      (variation?.product.name ?? "") +
      (["3 мл", "10 мл"].includes(variation?.volume)
        ? ` - ${variation?.volume}`
        : ""),
    stockFBW,
    stockFBS: {
      stock: stockFBS,
      updateBy: wbDbProduct?.barcode ?? "",
      marketType: "wb",
    },
  };
};

export const getProductsListPage = (req, res) => {
  async
    .waterfall([
      (cb) => {
        async.parallel(
          {
            // List of all products fetched right from WB servers
            wbApiProducts(callback) {
              wbService
                .getApiProductsInfoList(null)
                .then((result) => callback(null, result))
                .catch((error) => callback(error, null));
            },
            // Stocks on our warehouse (for selling on WB)
            wbApiFbsStocks(callback) {
              wbService
                .getApiProductFbsStocks("")
                .then((products) => callback(null, products))
                .catch((error) => callback(error, null));
            },
            // Stocks on WB warehouse
            wbApiFbwStocks(callback) {
              wbService
                .getApiProductFbwStocks()
                .then((result) => callback(null, result))
                .catch((error) => {
                  // if request unsuccessful leave wbApiFbwStocks empty.
                  console.error(error);
                  callback(null, null);
                });
            },
            // List of all products from DB with reference of WB product sku to product name
            allDbVariations(callback) {
              dbService
                .getAllVariations({}, ["product wbProduct"])
                .then((variations) => callback(null, variations))
                .catch((error) => callback(error, null));
            },
            // List of Wb products from DB
            wbDbProducts(callback) {
              dbService
                .getWbProducts({})
                .then((products) => callback(null, products))
                .catch((error) => callback(error, null));
            },
          },
          cb
        );
      },
      (results, cb) => {
        const {
          wbApiProducts,
          wbApiFbsStocks,
          wbApiFbwStocks,
          wbDbProducts,
          allDbVariations,
        } = results;

        async
          .parallel(
            wbService.getConnectWbDataRequests(
              req.query,
              wbApiProducts,
              wbApiFbsStocks,
              wbApiFbwStocks,
              wbDbProducts,
              allDbVariations,
              connectWbDataResultFormatter
            )
          )
          .then((products) =>
            cb(null, [products, wbApiFbwStocks, wbApiProducts])
          )
          .catch((error) => cb(error, null));
      },
    ])
    .then((results) => {
      let [products, wbApiFbwStocks, wbApiProducts] = results;

      // Clear product list of undefined after async
      products = products.filter((product) => !!product);

      // Sorting
      products.sort((product1, product2) =>
        product1.name.localeCompare(product2.name, "ru")
      );

      res.render("wb-stocks", {
        title: "WB Stocks",
        marketType: "wb",
        headers: {
          Article: { type: "identifier", field: "article" },
          Name: { type: "name", field: "name" },
          FBM: { type: "fbm", field: "stockFBW" },
          FBS: { type: "fbs", field: "stockFBS" },
        },
        products,
      });
      dbService.updateWbStocks(wbApiProducts, wbApiFbwStocks);
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
  wbService
    .updateApiStock(req.query.barcode, req.query.stock)
    .then((result) => {
      if (result["error"]) {
        return res
          .status(400)
          .json({ message: result["errorText"], result: result });
      }
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
};
