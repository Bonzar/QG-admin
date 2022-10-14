const wbService = require("../services/wbService");
const dbService = require("../services/dbService");
const async = require("async");

exports.getProductsListPage = async (req, res) => {
  try {
    async.waterfall(
      [
        (cb) => {
          async.parallel(
            {
              // List of all products fetched right from WB servers
              productsApiInfoList(callback) {
                wbService.getApiProductsInfoList(null, callback);
              },
              // Stocks on our warehouse (for selling on WB)
              productApiFbsStocks(callback) {
                wbService.getApiProductFbsStocks(callback);
              },
              // Stocks on WB warehouse
              productApiFbwStocks(callback) {
                wbService.getApiProductFbwStocks(callback);
              },
              // List of all products from DB with reference of WB product sku to product name
              allDbVariations(callback) {
                dbService.getAllVariations({}, "product wbProduct", callback);
              },
              // List of wb products from DB
              wbDbProducts(callback) {
                dbService.getWbProducts({}, callback);
              },
            },
            cb
          );
        },
        (results, cb) => {
          const {
            productsApiInfoList,
            productApiFbsStocks,
            productApiFbwStocks,
            allDbVariations,
            wbDbProducts,
          } = results;

          // Get fbw stock data from db if request to api failed
          let productFbwStocks = productApiFbwStocks;
          if (!productFbwStocks) {
            console.log("FBW stocks returned from DB.");
            productFbwStocks = results.wbDbProducts.map((product) => {
              return {
                nmId: product.sku,
                quantity: product.stock,
              };
            });
          }

          const productsFormatRequests = productsApiInfoList.data["cards"].map(
            (product) => {
              return async function () {
                // Search fetched product from wb in DB
                const wbDbProduct = wbDbProducts.find(
                  (wbDbProduct) => wbDbProduct.sku === product["nmID"]
                );
                const variation = allDbVariations.find(
                  (variation) => variation.wbProduct?.sku === product["nmID"]
                );

                const stockFBS =
                  productApiFbsStocks["stocks"].find(
                    (fbsStock) => fbsStock["nmId"] === product["nmID"]
                  )?.stock ?? 0;

                const stockFBW =
                  productFbwStocks
                    .filter((fbwStock) => fbwStock["nmId"] === product["nmID"])
                    .reduce((total, current) => total + current.quantity, 0) ??
                  0;

                // Filtration
                let isPassFilterArray = [];
                // by stock status
                switch (req.query.stock_status) {
                  // Filter only outofstock products (by FBS)
                  case "outofstock":
                    isPassFilterArray.push(stockFBS <= 0);
                    break;
                  // Filter only outofstock products (by FBO and FBS)
                  case "outofstockall":
                    isPassFilterArray.push(stockFBS <= 0 && stockFBW <= 0);
                    break;
                  // Filter only instock on FBS products
                  case "instockFBS":
                    isPassFilterArray.push(stockFBS > 0);
                    break;
                  // Filter only instock on FBW products
                  case "instockFBW":
                    isPassFilterArray.push(stockFBW > 0);
                    break;
                  // Filter only instock on FBW or FBS products (some of them)
                  case "instockSome":
                    isPassFilterArray.push(stockFBS > 0 || stockFBW > 0);
                    break;
                }

                // by actual (manual setup in DB)
                switch (req.query.isActual) {
                  case "notActual":
                    isPassFilterArray.push(wbDbProduct?.isActual === false);
                    break;
                  case "all":
                    isPassFilterArray.push(true);
                    break;
                  // Only actual by default
                  default:
                    isPassFilterArray.push(wbDbProduct?.isActual !== false);
                }

                if (isPassFilterArray.every((pass) => pass)) {
                  return {
                    variationInnerId: variation?._id,
                    marketProductInnerId: wbDbProduct?._id,
                    barcode: variation?.wbProduct.barcode ?? "",
                    articleWb: product["nmID"],
                    article: product["vendorCode"],
                    name:
                      (variation?.product.name ?? "") +
                      (["3 мл", "10 мл"].includes(variation?.volume)
                        ? ` - ${variation?.volume}`
                        : ""),
                    stockFBW,
                    stockFBS,
                  };
                }
              };
            }
          );

          async.parallel(productsFormatRequests, (err, products) => {
            if (err) {
              cb(err, null);
              return;
            }
            // Ok
            cb(null, [products, productApiFbwStocks, productsApiInfoList]);
          });
        },
      ],
      (err, results) => {
        if (err) {
          console.log(err);
          return res.status(400).json({
            message: "Error while getting list of products. Try again later.",
            err,
          });
        }

        let [products, productApiFbwStocks, productsApiInfoList] = results;

        // Clear product list of undefined after async
        products = products.filter((product) => !!product);

        // Sorting
        products.sort((product1, product2) =>
          product1.name.localeCompare(product2.name)
        );

        res.render("wb-stocks", {
          title: "WB Stocks",
          headers: {
            Article: "article",
            Name: "name",
            FBM: "stockFBW",
            FBS: "stockFBS",
          },
          updateBy: "barcode",
          products,
        });
        dbService.updateWbStocks(productsApiInfoList, productApiFbwStocks);
      }
    );
  } catch (error) {
    console.log(error);
    res.status(400).json({
      message: "Error while getting list of products. Try again later.",
      error,
    });
  }
};

exports.updateApiStock = (req, res) => {
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
    .catch((error) => {
      console.log(error);
      res.status(400).json({
        message: "Error while updating a product stock. Try again later.",
        error: error,
      });
    });
};
