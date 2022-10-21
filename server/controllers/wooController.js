const wooService = require("../services/wooService");
const async = require("async");
const dbService = require("../services/dbService");

exports.getProductsList = async (req, res) => {
  try {
    const tableFilters = `${
      req.query.stock_status ? `&stock_status=${req.query.stock_status}` : ""
    }${req.query.category ? `&category=${req.query.category}` : ""}${
      req.query.orderby &&
      [
        "date",
        "id",
        "include",
        "title",
        "slug",
        "price",
        "popularity",
        "rating",
      ].includes(req.query.orderby)
        ? `&orderby=${req.query.orderby}`
        : ""
    }`;

    async.waterfall(
      [
        (cb) => {
          async.parallel(
            {
              // List of all products from DB with reference of Woo product sku to product name
              allDbVariations(callback) {
                dbService.getAllVariations(
                  {},
                  [
                    {
                      path: "wooProduct",
                      populate: { path: "parentVariable" },
                    },
                    "product",
                  ],
                  callback
                );
              },

              // List of all products fetched from Woo server
              productsApiList(callback) {
                wooService.getProductList(tableFilters, callback);
              },
              // List of wb products from DB
              wooDbProducts(callback) {
                dbService.getWooProducts({}, callback);
              },
            },
            cb
          );
        },
        (results, cb) => {
          const { productsApiList, wooDbProducts, allDbVariations } = results;

          console.log(productsApiList);

          const productsFormatRequests = productsApiList.map((product) => {
            return async function () {
              // Search fetched product from woo in DB
              const wooDbProduct = wooDbProducts.find(
                (wooDbProduct) => wooDbProduct.id === product.id
              );

              const variation = allDbVariations.find(
                (variation) =>
                  variation.wooProduct?.filter(
                    (wooProduct) => wooProduct.id === product.id
                  ).length > 0
              );

              // const stockFBS =
              //   productApiFbsStocks["stocks"].find(
              //     (fbsStock) => fbsStock["nmId"] === product["nmID"]
              //   )?.stock ?? 0;
              //
              // const stockFBW =
              //   productFbwStocks
              //     .filter((fbwStock) => fbwStock["nmId"] === product["nmID"])
              //     .reduce((total, current) => total + current.quantity, 0) ??
              //   0;

              // Filtration
              // let isPassFilterArray = [];
              // // by stock status
              // switch (req.query.stock_status) {
              //   // Filter only outofstock products (by FBS)
              //   case "outofstock":
              //     isPassFilterArray.push(stockFBS <= 0);
              //     break;
              //   // Filter only outofstock products (by FBO and FBS)
              //   case "outofstockall":
              //     isPassFilterArray.push(stockFBS <= 0 && stockFBW <= 0);
              //     break;
              //   // Filter only instock on FBS products
              //   case "instockFBS":
              //     isPassFilterArray.push(stockFBS > 0);
              //     break;
              //   // Filter only instock on FBW products
              //   case "instockFBM":
              //     isPassFilterArray.push(stockFBW > 0);
              //     break;
              //   // Filter only instock on FBW or FBS products (some of them)
              //   case "instockSome":
              //     isPassFilterArray.push(stockFBS > 0 || stockFBW > 0);
              //     break;
              // }
              //
              // // by actual (manual setup in DB)
              // switch (req.query.isActual) {
              //   case "notActual":
              //     isPassFilterArray.push(wbDbProduct?.isActual === false);
              //     break;
              //   case "all":
              //     isPassFilterArray.push(true);
              //     break;
              //   // Only actual by default
              //   default:
              //     isPassFilterArray.push(wbDbProduct?.isActual !== false);
              // }

              if (true || isPassFilterArray.every((pass) => pass)) {
                return {
                  variationInnerId: variation?.product._id,
                  marketProductInnerId: wooDbProduct?._id,
                  id: product.id,
                  name:
                    (variation?.product.name ?? "") +
                    (["3 мл", "10 мл"].includes(variation?.volume)
                      ? ` - ${variation?.volume}`
                      : ""),
                };
              }
            };
          });

          async.parallel(productsFormatRequests, (err, products) => {
            if (err) {
              cb(err, null);
              return;
            }
            // Ok
            // cb(null, [products, productApiFbwStocks, productsApiInfoList]);
            cb(null, [products, null, null]);
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
          product1.name.localeCompare(product2.name, "ru")
        );

        res.render("woo-stocks", {
          title: "Woo Stocks",
          headers: {
            // Article: "article",
            Name: "name",
            ID: "id",
            // FBM: "stockFBW",
            // FBS: "stockFBS",
          },
          // updateBy: "id",
          products,
        });
        // dbService.updateWbStocks(productsApiInfoList, productApiFbwStocks);
      }
    );
  } catch (error) {
    console.log(error);
    res
      .status(400)
      .send("Error while getting list of products. Try again later.");
  }
};

exports.getStockUpdateInfo = async (req, res) => {
  try {
    res.json(await wooService.getStockUpdateInfo(req.params.id));
  } catch (e) {
    res
      .status(400)
      .send("Error while getting stock info of product. Try again later.");
  }
};

exports.updateStock = (req, res) => {
  try {
    console.log(req.body);
    wooService
      .updateStock(req.body)
      .then(() => {
        res.send();
      })
      .catch((e) => {
        console.log(e);
        res.status(500).json(e);
      });
  } catch (e) {
    res
      .status(400)
      .send("Error while updating stock of product. Try again later.");
  }
};
