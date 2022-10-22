const dbService = require("../services/dbService");
const async = require("async");
const { validationResult } = require("express-validator");
const wbService = require("../services/wbService");
const yandexService = require("../services/yandexService");
const ozonService = require("../services/ozonService");
const wooService = require("../services/wooService");

exports.getProductPage = (req, res) => {
  try {
    async.waterfall(
      [
        (callback) => {
          dbService.getProductById(req.params.id, callback);
        },
        (product, callback) => {
          dbService.getAllVariations(
            { product },
            [
              {
                path: "wooProduct",
                populate: { path: "parentVariable" },
              },
              "product yandexProduct wbProduct ozonProduct",
            ],
            (err, variations) => {
              if (err) {
                console.log(err);
                callback(err, null);
                return;
              }

              callback(null, product, variations);
            }
          );
        },
        (product, variations, callback) => {
          const variationStockRequests = variations.map((variation) => {
            return (callback) => {
              try {
                dbService.getVariationProductsStocks(
                  variation._id,
                  (err, results) => {
                    if (err) {
                      console.log(err);
                      callback(err, null);
                      return;
                    }

                    variation = results[0];
                    variation.stocks = results[1];

                    callback(null, variation);
                  }
                );
              } catch (e) {
                console.log(e);
                callback(e, null);
              }
            };
          });

          async.parallel(variationStockRequests, (err, results) => {
            if (err) {
              console.log(err);
              callback(err, null);
              return;
            }

            callback(null, [product, results]);
          });
        },
      ],
      async (err, results) => {
        if (err) {
          console.log(err);
          res.status(400).json({
            message: `Error while getting product page. Try again later.`,
            code: err.code,
            status: err.response?.status,
          });
          return;
        }

        const [product, variations] = results;

        variations.sort((variation1, variation2) => {
          const volumeSortRating = {
            "3 мл": 50,
            "6 мл": 40,
            "10 мл": 30,
            Набор: 20,
            Стикеры: 10,
          };

          return (
            volumeSortRating[variation2.volume] -
            volumeSortRating[variation1.volume]
          );
        });

        if (product) {
          res.render("product", {
            title: `${product.name}`,
            product,
            variations,
          });
        } else {
          res.render("product", {
            title: "Добавить новый товар",
          });
        }
      }
    );
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message: "Error while getting all products. Try again later.",
      code: err.code,
      status: err.response?.status,
    });
  }
};

exports.getDbMarketProductPage = async (req, res) => {
  try {
    let allProducts = await dbService.getAllProducts();

    allProducts.sort((product1, product2) =>
      product1.name.localeCompare(product2.name, "ru")
    );

    const marketType = req.params.marketType;
    const productId = req.params.product_id;

    if (["yandex", "wb", "ozon", "woo"].includes(marketType)) {
      // if id exist -> update product ELSE add new
      if (productId) {
        let marketProduct = null;
        let fbsStocks = null;
        switch (marketType) {
          case "wb":
            marketProduct = (
              await dbService.getWbProducts({ _id: productId })
            )[0];
            fbsStocks =
              (await wbService.getApiProductFbsStocks(marketProduct.barcode))
                .stocks?.[0].stock ?? 0;

            break;
          case "yandex":
            marketProduct = (
              await dbService.getYandexProducts({ _id: productId })
            )[0];
            fbsStocks = (
              await yandexService.getApiProductsList([marketProduct.sku])
            )[0].warehouses?.[0].stocks.find(
              (stockType) => stockType.type === "FIT"
            )?.count;

            break;
          case "ozon":
            marketProduct = (
              await dbService.getOzonProducts({ _id: productId })
            )[0];
            fbsStocks = (
              await ozonService.getProductsStockList({
                product_id: [marketProduct.sku],
                visibility: "ALL",
              })
            ).result.items[0].stocks[1]?.present;

            break;
          case "woo":
            marketProduct = (
              await dbService.getWooProducts(
                { _id: productId },
                "parentVariable"
              )
            )[0];

            switch (marketProduct.type) {
              case "simple":
                fbsStocks = (await wooService.getProductInfo(marketProduct.id))
                  .stock_quantity;
                break;
              case "variation":
                fbsStocks = (
                  await wooService.getProductVariationInfo(
                    marketProduct.parentVariable.id,
                    marketProduct.id
                  )
                ).stock_quantity;
                break;
            }
            break;
        }

        const variationFilter = {};
        variationFilter[`${marketType}Product`] = marketProduct;

        const variation = (
          await dbService.getAllVariations(variationFilter, ["product"])
        )[0];

        if (marketProduct) {
          res.render("marketProduct", {
            title: `${
              marketType[0].toUpperCase() + marketType.slice(1).toLowerCase()
            } - ${
              marketProduct.article ??
              marketProduct.sku ??
              marketProduct.id ??
              marketProduct._id
            } (БД)`,
            marketType,
            allProducts,
            marketProduct,
            variation,
            fbsStocks,
          });
        }
      } else {
        res.render("marketProduct", {
          title: `Добавить новый товар ${
            marketType[0].toUpperCase() + marketType.slice(1).toLowerCase()
          } (БД)`,
          marketType,
          allProducts,
        });
      }
    } else {
      res.status(400).json({
        message: "Выбран не вырный маркетплейс.",
      });
    }
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message: "Error while getting market product add page. Try again later.",
      code: err.code,
      status: err.response?.status,
    });
  }
};

exports.addUpdateDbMarketProduct = async (req, res) => {
  try {
    let errors = validationResult(req);

    if (!errors.isEmpty()) {
      // There are errors.
      console.log(errors);
      errors = errors.errors.map((error) => error.msg).join(". ");
      res.status(400).json(errors);
      return;
    }

    await dbService.addUpdateMarketProduct(req.body, (err, results) => {
      if (err) {
        console.log(err);

        if (err.code === 11000) {
          err.message = `Продукт с ${Object.keys(err.keyValue)[0]} - ${
            err.keyValue[Object.keys(err.keyValue)[0]]
          } уже существует`;
        }
        res.status(400).json({
          message: "Error while adding product to DB. Try again later.",
          code: err.code,
          status: err.response?.status,
        });
        return;
      }

      res.json({ marketType: req.body.marketType, results });
    });
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message: "Error while adding product to DB. Try again later.",
      code: err.code,
      status: err.response?.status,
    });
  }
};

exports.addUpdateDbProduct = async (req, res) => {
  try {
    let errors = validationResult(req);

    if (!errors.isEmpty()) {
      // There are errors.
      console.log(errors);
      errors = errors.errors.map((error) => error.msg).join(". ");
      res.status(400).json(errors);
      return;
    }

    await dbService.addUpdateProduct(req.body, (err, results) => {
      if (err) {
        console.log(err);

        if (err.code === 11000) {
          err.message = `Продукт с ${Object.keys(err.keyValue)[0]} - ${
            err.keyValue[Object.keys(err.keyValue)[0]]
          } уже существует`;
        }
        res.status(400).json({
          message: "Error while adding product to DB. Try again later.",
          code: err.code,
          status: err.response?.status,
        });
        return;
      }

      res.json(results);
    });
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message: "Error while adding product to DB. Try again later.",
      code: err.code,
      status: err.response?.status,
    });
  }
};

exports.addDbProductVariation = async (req, res) => {
  try {
    await dbService.addProductVariation(req.body, (err, results) => {
      if (err) {
        console.log(err);

        if (err.code === 11000) {
          err.message = `Вариация с ${Object.keys(err.keyValue)[0]} - ${
            err.keyValue[Object.keys(err.keyValue)[0]]
          } уже существует`;
        }
        res.status(400).json({
          message: "Error while adding variation to DB. Try again later.",
          code: err.code,
          status: err.response?.status,
        });
        return;
      }

      res.json(results);
    });
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message: "Error while adding variation to DB. Try again later.",
      code: err.code,
      status: err.response?.status,
    });
  }
};

exports.deleteDbProduct = async (req, res) => {
  try {
    await dbService.deleteProduct(req.params.id, (err, results) => {
      if (err) {
        console.log(err);
        res.status(400).json({
          message: "Error while deleting Product from DB. Try again later.",
          code: err.code,
          status: err.response?.status,
        });
        return;
      }

      res.json(results);
    });
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message: "Error while deleting Product from DB. Try again later.",
      code: err.code,
      status: err.response?.status,
    });
  }
};

exports.deleteDbProductVariation = async (req, res) => {
  try {
    await dbService.deleteProductVariation(req.params.id, (err, results) => {
      if (err) {
        console.log(err);

        res.status(400).json({
          message: "Error while deleting product variation. Try again later.",
          code: err.code,
          status: err.response?.status,
        });
        return;
      }

      res.json(results);
    });
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message:
        "Error while deleting product variation from DB. Try again later.",
      code: err.code,
      status: err.response?.status,
    });
  }
};

exports.getAllProductsPage = (req, res) => {
  try {
    async.parallel(
      {
        allProducts(callback) {
          dbService.getAllProducts(callback);
        },
      },
      async (err, results) => {
        if (err) {
          console.log(err);
          res.status(400).json({
            message: "Error while getting product page. Try again later.",
            code: err.code,
            status: err.response?.status,
          });
          return;
        }

        const { allProducts } = results;

        let filtratedProducts;
        // Filtration by actual (manual setup in DB)
        switch (req.query.isActual) {
          case "notActual":
            filtratedProducts = allProducts.filter(
              (product) => !product.isActual
            );
            break;
          case "all":
            filtratedProducts = allProducts;
            break;
          // Only actual by default
          default:
            filtratedProducts = allProducts.filter(
              (product) => product.isActual
            );
        }

        filtratedProducts.sort((product1, product2) =>
          product1.name.localeCompare(product2.name, "ru")
        );

        res.render("allProductsPage", {
          title: `Все продукты (БД)`,
          products: filtratedProducts,
        });
      }
    );
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message: "Error while getting all products page",
      code: err.code,
      status: err.response?.status,
    });
  }
};
