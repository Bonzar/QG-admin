const yandexService = require("../services/yandexService");
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
                yandexService.getApiProductsList([], callback);
              },
              // List of all products from DB with reference of WB product sku to product name
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
          const { productsApiList, allDbVariations, yandexDbProducts } =
            results;

          const productsFormatRequests = productsApiList.map((product) => {
            return async function () {
              // Search fetched product from wb in DB
              const yandexDbProduct = yandexDbProducts.find(
                (yandexDbProduct) => yandexDbProduct.sku === product["shopSku"]
              );

              const variation = allDbVariations.find(
                (variation) =>
                  variation.yandexProduct?.filter(
                    (yandexProduct) => yandexProduct.sku === product["shopSku"]
                  ).length > 0
              );

              const stock =
                product.warehouses?.[0].stocks.find(
                  (stockType) => stockType.type === "FIT"
                )?.count ?? 0;

              // Filtration
              let isPassFilterArray = [];
              // by stock status
              if (req.query.stock_status === "outofstock") {
                isPassFilterArray.push(stock <= 0);
              }
              // by actual (manual setup in DB)
              switch (req.query.isActual) {
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

              if (isPassFilterArray.every((pass) => pass)) {
                return {
                  variationInnerId: variation?.product._id,
                  marketProductInnerId: yandexDbProduct?._id,
                  productSku: product.shopSku,
                  productName:
                    (variation?.product.name ?? "") +
                    (["3 мл", "10 мл"].includes(variation?.volume)
                      ? ` - ${variation?.volume}`
                      : ""),
                  productStock: stock,
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
            code: err.code,
            status: err.response?.status,
          });
        }

        let [products, productsApiList] = results;

        // Clear product list of undefined after async
        products = products.filter((product) => !!product);

        // Sorting
        products.sort((product1, product2) =>
          product1.productName.localeCompare(product2.productName, "ru")
        );

        res.render("yandex-stocks", {
          title: "Yandex Stocks",
          headers: {
            SKU: "productSku",
            Name: "productName",
            FBS: "productStock",
          },
          updateBy: "productSku",
          products,
        });
        dbService.updateYandexStocks(productsApiList);
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
