const ozonService = require("../services/ozonService");
const async = require("async");
const dbService = require("../services/dbService");

exports.getProductsListPage = async (req, res) => {
  try {
    async.waterfall(
      [
        (cb) => {
          async.parallel(
            {
              // Stocks on WB warehouse
              productsApiList(callback) {
                ozonService.getApiProductsList({ visibility: "ALL" }, callback);
              },
              // List of all products from DB with reference of WB product sku to product name
              allVariations(callback) {
                dbService.getAllVariations({}, "product ozonProduct", callback);
              },
              // List of yandex products from DB
              ozonDbProducts(callback) {
                dbService.getOzonProducts({}, callback);
              },
            },
            cb
          );
        },
        (results, cb) => {
          const { ozonDbProducts, allVariations, productsApiList } = results;

          const { productsInfo, productsStockList } = productsApiList;

          const productsFormatRequests = productsInfo.map((product) => {
            return async function () {
              // Search fetched product from wb in DB
              const ozonDbProduct = ozonDbProducts.find(
                (ozonDbProduct) => ozonDbProduct.sku === product["id"]
              );
              const variation = allVariations.find(
                (variation) => variation.ozonProduct?.sku === product["id"]
              );

              const productStocks = productsStockList.find(
                (stockInfo) => stockInfo.product_id === product.id
              );

              const stockFBO = productStocks.stocks[0]?.present ?? 0;
              const stockFBS = productStocks.stocks[1]?.present ?? 0;

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
                  isPassFilterArray.push(stockFBS <= 0 && stockFBO <= 0);
                  break;
                // Filter only instock on FBS products
                case "instockFBS":
                  isPassFilterArray.push(stockFBS > 0);
                  break;
                // Filter only instock on FBW products
                case "instockFBM":
                  isPassFilterArray.push(stockFBO > 0);
                  break;
                // Filter only instock on FBW or FBS products (some of them)
                case "instockSome":
                  isPassFilterArray.push(stockFBS > 0 || stockFBO > 0);
                  break;
              }

              // by actual (manual setup in DB)
              switch (req.query.isActual) {
                case "notActual":
                  isPassFilterArray.push(ozonDbProduct?.isActual === false);
                  break;
                case "all":
                  isPassFilterArray.push(true);
                  break;
                // Only actual by default
                default:
                  isPassFilterArray.push(ozonDbProduct?.isActual !== false);
              }

              if (isPassFilterArray.every((pass) => pass)) {
                return {
                  variationInnerId: variation?.product._id,
                  marketProductInnerId: ozonDbProduct?._id,
                  sku: product.id,
                  article: product.offer_id,
                  name:
                    (variation?.product.name ?? "") +
                    (["3 мл", "10 мл"].includes(variation?.volume)
                      ? ` - ${variation?.volume}`
                      : ""),
                  stockFBO,
                  stockFBS,
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
            cb(null, [products, productsApiList]);
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

        let [products, productsApiList] = results;

        // Clear product list of undefined after async
        products = products.filter((product) => !!product);

        // Sorting
        products.sort((product1, product2) =>
          product1.name.localeCompare(product2.name, "ru")
        );

        res.render("ozon-stocks", {
          title: "Ozon stocks",
          headers: {
            Article: "article",
            Name: "name",
            FBM: "stockFBO",
            FBS: "stockFBS",
          },
          updateBy: "article",
          products,
        });
        dbService.updateOzonStocks(productsApiList);
      }
    );
  } catch (error) {
    console.log(error);
    res
      .status(400)
      .send("Error while getting list of products. Try again later.");
  }
};

exports.updateStock = async (req, res) => {
  try {
    ozonService
      .updateApiStock(req.query.id, req.query.stock)
      .then((result) => {
        res.json(result);
      })
      .catch((e) => {
        console.log(e);
        res.status(500).json(e);
      });
  } catch (error) {
    res
      .status(400)
      .send("Error while getting list of products. Try again later.");
  }
};
