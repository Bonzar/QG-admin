const wbService = require("../services/wbService");
const productsDbService = require("../services/productsDbService");
const async = require("async");

exports.getProductsList = async (req, res) => {
  try {
    async.waterfall(
      [
        (cb) => {
          async.parallel(
            {
              // List of all products fetched right from WB servers
              productsInfoList(callback) {
                wbService.getProductsInfoList(null, callback);
              },
              // Stocks on our warehouse (for selling on WB)
              productFbsStocks(callback) {
                wbService.getProductFbsStocks(callback);
              },
              // Stocks on WB warehouse
              productFbwStocks(callback) {
                wbService.getProductFbwStocks(callback);
              },
              // List of all products from DB with reference of WB product sku to product name
              allVariations(callback) {
                productsDbService.getAllVariations(
                  "product wbProduct",
                  callback
                );
              },
              // List of wb products from DB
              wbDbProducts(callback) {
                productsDbService.getWbProducts(callback);
              },
            },
            cb
          );
        },
        (results, cb) => {
          const {
            productsInfoList,
            productFbsStocks,
            productFbwStocks,
            allVariations,
            wbDbProducts,
          } = results;

          const productsFormatRequests = productsInfoList.data["cards"].map(
            (product) => {
              return async function () {
                // Search fetched product from wb in DB
                const wbDbProduct = wbDbProducts.find(
                  (wbDbProduct) => wbDbProduct.sku === product["nmID"]
                );
                const variation = allVariations.find(
                  (variation) => variation.wbProduct?.sku === product["nmID"]
                );

                const stockFBS =
                  productFbsStocks["stocks"].find(
                    (fbsStock) => fbsStock["nmId"] === product["nmID"]
                  )?.stock ?? 0;

                const stockFBW =
                  productFbwStocks
                    .filter((fbwStock) => fbwStock["nmId"] === product["nmID"])
                    .reduce(
                      (total, current) => total + current.quantityFull,
                      0
                    ) ?? 0;

                // Filtration
                let isPassFilterArray = [];
                // by stock status
                switch (req.query.stock_status_wb) {
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
                // by actual (manual setup)
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
                    barcode: variation?.wbProduct.barcode ?? "",
                    articleWb: product["nmID"],
                    article: product["vendorCode"],
                    name: variation?.product.name ?? "",
                    stockFBW,
                    stockFBS,
                  };
                }
                // }
              };
            }
          );

          async.parallel(productsFormatRequests, cb);
        },
      ],
      (err, products) => {
        if (err) {
          console.log(err);
          return res.status(400).json({
            message: "Error while getting list of products. Try again later.",
            err,
          });
        }

        // Clear product list of undefined after async
        products = products.filter((product) => !!product);

        // Sorting
        products.sort((product1, product2) =>
          product1.name.localeCompare(product2.name)
        );

        res.render("wb-stocks", {
          title: "WB Stocks",
          headers: {
            Barcode: "barcode",
            Name: "name",
            FBM: "stockFBW",
            FBS: "stockFBS",
          },
          products,
        });
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

exports.updateStock = (req, res) => {
  wbService
    .updateStock(req.query.barcode, req.query.stock)
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
